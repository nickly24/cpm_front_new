import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/lib/auth/types";
const mocks = vi.hoisted(() => ({ request: vi.fn(), identity: { user: { account_id: 10, id: 900, organization_id: 1, division_id: 2, role: "admin", organization_admin: true, full_name: "Администратор" } as User, context_revision: "scope-a" } }));
vi.mock("./client", () => ({ domain: (...args: unknown[]) => mocks.request(...args), getIdentity: () => mocks.identity }));
import { getHomeworkAudit, getHomeworkSettings, homeworkAuditAction, homeworkSettingsAccess, pendingHomeworkSettings, reconcileHomeworkSettings, saveHomeworkSettings, validateHomeworkSettings, type HomeworkSettings } from "./homework-settings-audit";
const defaults: HomeworkSettings = { max_source_bytes: 10485760, max_output_bytes: 10485760, max_pages: 35, dpi: 120, jpeg_quality: 75, presign_ttl_seconds: 300, upload_stale_seconds: 1800 };
const row = (id: number) => ({ id, actor_id: id % 2 ? null : 10, action: "settings.update", entity_id: "2", created_at: "2026-10-09T10:00:00Z" });
const storage = new Map<string, string>();
beforeEach(() => {
  mocks.request.mockReset(); storage.clear();
  mocks.identity.user = { account_id: 10, id: 900, organization_id: 1, division_id: 2, role: "admin", organization_admin: true, full_name: "Администратор" };
  mocks.identity.context_revision = "scope-a";
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
});

describe("Homework limits and scoped audit", () => {
  it("uses selected BFF cabinet and the exact owner Settings DTO", async () => {
    mocks.request.mockResolvedValue(defaults);
    expect(await getHomeworkSettings()).toEqual(defaults);
    expect(mocks.request.mock.calls[0][0]).toBe("/homework/settings");
    expect(await saveHomeworkSettings({ ...defaults, extra: "ignored" } as HomeworkSettings)).toEqual(defaults);
    expect(mocks.request.mock.calls[1][1]).toEqual({ method: "PUT", body: JSON.stringify(defaults) });
    expect(pendingHomeworkSettings()).toBeNull();
  });
  it.each([{ max_source_bytes: 0 }, { max_output_bytes: 104857601 }, { max_pages: 201 }, { dpi: 71 }, { jpeg_quality: 96 }, { presign_ttl_seconds: 59 }, { upload_stale_seconds: 599 }, { dpi: 120.5 }])("rejects limits outside owner constraints %j before a write", async patch => {
    await expect(saveHomeworkSettings({ ...defaults, ...patch })).rejects.toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("allows settings reads with monitoring rights, but neither settings writes nor audit with delegated edit rights", async () => {
    mocks.identity.user = { ...mocks.identity.user, role: "staff_admin", organization_admin: false, permissions: { monitoring: { view: true, edit: false }, assignments: { view: true, edit: true } } };
    mocks.request.mockResolvedValue(defaults);
    expect(await getHomeworkSettings()).toEqual(defaults);
    await expect(saveHomeworkSettings(defaults)).rejects.toMatchObject({ status: 403 });
    await expect(getHomeworkAudit()).rejects.toMatchObject({ status: 403 });
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it("requires explicit organization_admin and actual view flags", () => {
    expect(homeworkSettingsAccess({ ...mocks.identity.user, organization_admin: false }).writeSettings).toBe(false);
    expect(homeworkSettingsAccess({ ...mocks.identity.user, role: "staff_admin", organization_admin: true, permissions: { assignments: { view: false, edit: true } } })).toEqual({ readSettings: false, writeSettings: false, readAudit: false });
    expect(homeworkSettingsAccess({ ...mocks.identity.user, role: "supervisor" }).readSettings).toBe(false);
  });
  it("rejects a late response after selected context changes", async () => {
    mocks.request.mockImplementation(async () => { mocks.identity.context_revision = "scope-b"; return defaults; });
    await expect(getHomeworkSettings()).rejects.toMatchObject({ code: "context_changed" });
  });
  it("retains an uncertain write across remount and prevents another PUT until a canonical GET confirms it", async () => {
    mocks.request.mockRejectedValueOnce(Object.assign(new Error("lost response"), { status: 0 }));
    await expect(saveHomeworkSettings(defaults)).rejects.toMatchObject({ code: "settings_outcome_unknown" });
    expect(pendingHomeworkSettings()).toEqual(defaults);
    await expect(saveHomeworkSettings({ ...defaults, max_pages: 36 })).rejects.toMatchObject({ code: "settings_pending" });
    expect(mocks.request).toHaveBeenCalledTimes(1);
    mocks.request.mockResolvedValue(defaults);
    expect(await reconcileHomeworkSettings()).toEqual({ current: defaults, applied: true });
    expect(mocks.request.mock.calls[1][0]).toBe("/homework/settings");
    expect(mocks.request.mock.calls[1][1]).toEqual({ signal: undefined });
    expect(pendingHomeworkSettings()).toBeNull();
  });
  it("adopts differing canonical settings without resending an uncertain command", async () => {
    mocks.request.mockRejectedValueOnce(Object.assign(new Error("unavailable"), { status: 503 }));
    await expect(saveHomeworkSettings(defaults)).rejects.toThrow();
    const current = { ...defaults, max_pages: 36 };
    mocks.request.mockResolvedValueOnce(current);
    expect(await reconcileHomeworkSettings()).toEqual({ current, applied: false });
    expect(mocks.request.mock.calls.filter(call => call[1]?.method === "PUT")).toHaveLength(1);
  });
  it("keeps unknown results pending if canonical reread fails, and isolates the journal by account/organization/division", async () => {
    mocks.request.mockRejectedValue(Object.assign(new Error("lost"), { status: 0 }));
    await expect(saveHomeworkSettings(defaults)).rejects.toThrow();
    await expect(reconcileHomeworkSettings()).rejects.toThrow();
    expect(pendingHomeworkSettings()).toEqual(defaults);
    mocks.identity.user.division_id = 3;
    expect(pendingHomeworkSettings()).toBeNull();
    mocks.identity.user.division_id = 2; mocks.identity.user.account_id = 11;
    expect(pendingHomeworkSettings()).toBeNull();
    mocks.identity.user.account_id = 10;
    expect(pendingHomeworkSettings()).toEqual(defaults);
  });
  it("removes a definitive rejected command but preserves malformed successful responses as unknown", async () => {
    mocks.request.mockRejectedValueOnce(Object.assign(new Error("invalid_settings"), { status: 400 }));
    await expect(saveHomeworkSettings(defaults)).rejects.toMatchObject({ status: 400 });
    expect(pendingHomeworkSettings()).toBeNull();
    mocks.request.mockResolvedValueOnce({ ...defaults, max_pages: 0 });
    await expect(saveHomeworkSettings(defaults)).rejects.toMatchObject({ code: "settings_outcome_unknown" });
    expect(pendingHomeworkSettings()).toEqual(defaults);
  });
  it("does not send a mutation when recovery journal storage is unavailable", async () => {
    vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => { throw new Error("blocked"); } });
    await expect(saveHomeworkSettings(defaults)).rejects.toMatchObject({ code: "journal_unavailable" });
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("proves the next page with an extra row without inventing total or has_more owner fields", async () => {
    mocks.request.mockResolvedValueOnce({ items: [row(21), row(22), row(23)] });
    expect(await getHomeworkAudit(20, 2)).toEqual({ items: [row(21), row(22)], hasMore: true, nextCursor: 22 });
    expect(mocks.request.mock.calls[0][0]).toBe("/homework/audit?limit=3&after=20");
    mocks.request.mockResolvedValueOnce({ items: [row(23), row(24)] });
    expect(await getHomeworkAudit(22, 2)).toEqual({ items: [row(23), row(24)], hasMore: false, nextCursor: 24 });
  });
  it.each([{ items: [row(2), row(2)] }, { items: [row(2), row(1)] }, { items: [{ ...row(2), actor_id: 0 }] }, { items: [{ ...row(2), created_at: "invalid" }] }])("rejects malformed or overlapping audit pages %j", async ({ items }) => {
    mocks.request.mockResolvedValueOnce({ items });
    await expect(getHomeworkAudit(1, 50)).rejects.toThrow();
  });
  it("validates cursor limits and requires a selected division before any request", async () => {
    await expect(getHomeworkAudit(-1)).rejects.toMatchObject({ status: 400 });
    await expect(getHomeworkAudit(0, 200)).rejects.toMatchObject({ status: 400 });
    mocks.identity.user.division_id = null;
    await expect(getHomeworkSettings()).rejects.toMatchObject({ code: "division_required" });
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("preserves unknown audit actions instead of silently hiding them", () => {
    expect(homeworkAuditAction("settings.update")).toBe("Изменены настройки");
    expect(homeworkAuditAction("future.action")).toBe("future.action");
    expect(validateHomeworkSettings(defaults)).toEqual(defaults);
  });
});
