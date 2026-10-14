import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ identity: { context_revision: "r1", user: { role: "admin", account_id: 9, organization_id: 1001, division_id: 12 as number | null, organization_admin: true } }, domain: vi.fn() }));
vi.mock("./client", () => ({ domain: state.domain, getIdentity: () => state.identity }));
import { archiveCoreOrganizationCatalog, coreOrganizationAccountMemberships, coreOrganizationAccounts, coreOrganizationCatalog, coreOrganizationRoles, pendingCoreOrganizationCommand, recoverCoreOrganizationCommand, revokeCoreOrganizationParticipation, saveCoreOrganizationName, saveCoreOrganizationParticipation } from "./core-organization";
const organization = { id: 1001, name: "Организация", is_active: 1 };
const role = { id: 3, name: "Редактор", permissions: [] };
const student = { account_id: 45, profile_id: 2, role: "student", login: "student", full_name: "Ученик", is_active: 1, owner_organization_id: 1001 };
const staff = { ...student, account_id: 46, profile_id: 8, role: "staff_admin", login: "staff" };
const member = { division_id: 12, division_name: "Первое", role_id: null as number | null, role_name: null as string | null, group_id: 8 as number | null, can_revoke: true };
let storage: Map<string, string>, divisions: { id: number; name: string; is_active: number }[], directions: { id: number; name: string }[], accounts: typeof student[], memberships: typeof member[];
let canAssign: boolean;
const writes = () => state.domain.mock.calls.filter(call => call[1]?.method);
beforeEach(() => {
  state.domain.mockReset(); state.identity.context_revision = "r1";
  Object.assign(state.identity.user, { role: "admin", account_id: 9, organization_id: 1001, division_id: 12, organization_admin: true });
  storage = new Map(); vi.stubGlobal("sessionStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  divisions = [{ id: 12, name: "Первое", is_active: 1 }, { id: 13, name: "Второе", is_active: 1 }]; directions = [{ id: 20, name: "Право" }]; accounts = [student, staff]; memberships = [member]; canAssign = true;
  state.domain.mockImplementation(async (path: string, options?: RequestInit) => {
    if (options?.method) return options.method === "POST" ? { id: 30 } : null;
    const url = new URL(path, "http://local");
    if (url.pathname === "/core/organization") return organization;
    if (url.pathname === "/core/divisions") return divisions;
    if (url.pathname === "/core/directions") return directions;
    if (url.pathname === "/core/roles") return { roles: [role], sections: ["users"] };
    if (url.pathname === "/core/organization/users") { const offset = Number(url.searchParams.get("offset")); return accounts.slice(offset, offset + 200); }
    const match = url.pathname.match(/^\/core\/organization\/users\/(\d+)\/memberships$/);
    if (match) { const account = accounts.find(row => row.account_id === Number(match[1])); return { account_id: account?.account_id, owner_organization_id: account?.owner_organization_id, can_assign: canAssign, can_revoke: true, memberships }; }
    throw new Error(`Unexpected route ${path}`);
  });
});
describe("Core organization public contract", () => {
  it("reads accessible catalogs for staff but never treats delegated edit or an organization flag as full admin", async () => {
    state.identity.user.role = "staff_admin";
    expect(await coreOrganizationCatalog()).toMatchObject({ organization, divisions, directions });
    state.domain.mockClear();
    await expect(saveCoreOrganizationName("division", "Новое")).rejects.toThrow("администратору организации");
    await expect(coreOrganizationAccounts()).rejects.toThrow("администратору организации");
    expect(state.domain).not.toHaveBeenCalled();
  });
  it("requires the live full-admin organization flag for every write", async () => {
    state.identity.user.organization_admin = false;
    await expect(saveCoreOrganizationParticipation(13, 45, null)).rejects.toThrow("администратору организации");
    await expect(archiveCoreOrganizationCatalog("direction", 20)).rejects.toThrow("администратору организации");
    expect(state.domain).not.toHaveBeenCalled();
  });
  it("uses nonpaginated catalogs and detects a changed revision during a read", async () => {
    state.domain.mockImplementationOnce(async () => { state.identity.context_revision = "r2"; return organization; });
    await expect(coreOrganizationCatalog()).rejects.toThrow("Кабинет изменился");
    expect(state.domain.mock.calls.map(call => call[0])).toEqual(["/core/organization", "/core/divisions", "/core/directions"]);
  });
  it("fully paginates organization accounts and never carries password/token extras into the UI DTO", async () => {
    accounts = Array.from({ length: 205 }, (_, index) => ({ ...student, account_id: index + 100, password: "secret", token: "token" }));
    const rows = await coreOrganizationAccounts();
    expect(rows).toHaveLength(205); expect(rows[204].account_id).toBe(304);
    expect(JSON.stringify(rows)).not.toMatch(/secret|token/);
    expect(state.domain.mock.calls.map(call => call[0])).toEqual(["/core/organization/users?limit=200&offset=0", "/core/organization/users?limit=200&offset=200"]);
  });
  it("loads all scoped memberships from the dedicated owner DTO without any global roster scan", async () => {
    memberships = [member, { ...member, division_id: 13, division_name: "Второе", role_id: 3, role_name: "Редактор", group_id: null }];
    expect(await coreOrganizationAccountMemberships(46)).toMatchObject({ account_id: 46, can_assign: true, memberships: [{ division_id: 12 }, { division_id: 13, role_id: 3 }] });
    expect(state.domain.mock.calls).toEqual([["/core/organization/users/46/memberships", { signal: undefined }]]);
    expect(await coreOrganizationRoles()).toEqual([role]);
  });
  it("rejects a wrong account identity in the membership response", async () => {
    state.domain.mockResolvedValueOnce({ account_id: 55, memberships: [] });
    await expect(coreOrganizationAccountMemberships(45)).rejects.toThrow("неверные участия");
  });
  it("renames the current organization with PUT and no invented organization create, CAS or idempotency", async () => {
    expect(await saveCoreOrganizationName("organization", "  Новая организация  ")).toBe(1001);
    expect(writes()).toEqual([["/core/organization", { method: "PUT", body: '{"name":"Новая организация"}' }]]);
    expect(pendingCoreOrganizationCommand()).toBeNull();
  });
  it("writes exact owner fields for new divisions and direction rename", async () => {
    expect(await saveCoreOrganizationName("division", "Новый кабинет")).toBe(30);
    await saveCoreOrganizationName("direction", "Новое право", 20);
    expect(writes()).toEqual([["/core/divisions", { method: "POST", body: '{"name":"Новый кабинет"}' }], ["/core/directions/20", { method: "PUT", body: '{"name":"Новое право"}' }]]);
  });
  it("validates names and cross-organization object IDs before writes", async () => {
    await expect(saveCoreOrganizationName("division", "  ")).rejects.toThrow("название");
    await expect(saveCoreOrganizationName("direction", "а".repeat(201))).rejects.toThrow("200");
    await expect(saveCoreOrganizationName("organization", "Чужая", 777)).rejects.toThrow("другая организация");
    await expect(saveCoreOrganizationName("division", "Нет", 999)).rejects.toThrow("не доступен");
    expect(writes()).toHaveLength(0);
  });
  it("does not mutate a stale context after preflight", async () => {
    state.domain.mockImplementationOnce(async () => { state.identity.user.division_id = 13; return divisions; });
    await expect(saveCoreOrganizationName("division", "Новое")).rejects.toThrow("Кабинет изменился");
    expect(writes()).toHaveLength(0); expect(storage.size).toBe(0);
  });
  it("journals before an unknown create and confirms a single new matching ID without resending POST", async () => {
    divisions.push({ id: 14, name: "Дубликат", is_active: 1 });
    state.domain.mockImplementation(async (path: string, options?: RequestInit) => {
      if (!options?.method) return divisions;
      expect(pendingCoreOrganizationCommand()).toMatchObject({ kind: "division", method: "POST", before_ids: [12, 13, 14] });
      throw Object.assign(new Error("lost"), { status: 0 });
    });
    await expect(saveCoreOrganizationName("division", "Дубликат")).rejects.toThrow("Ответ на изменение");
    await expect(saveCoreOrganizationName("division", "Дубликат")).rejects.toThrow("предыдущего");
    await expect(recoverCoreOrganizationCommand()).rejects.toThrow("не подтверждён");
    divisions.push({ id: 30, name: "Дубликат", is_active: 1 }); await recoverCoreOrganizationCommand();
    expect(writes()).toHaveLength(1); expect(pendingCoreOrganizationCommand()).toBeNull();
  });
  it("never treats two concurrent matching new objects as confirmed creation", async () => {
    state.domain.mockResolvedValueOnce(divisions).mockRejectedValueOnce(Object.assign(new Error("lost"), { status: 503 }));
    await expect(saveCoreOrganizationName("division", "Общее")).rejects.toThrow("Ответ на изменение");
    state.domain.mockResolvedValueOnce([...divisions, { id: 30, name: "Общее" }, { id: 31, name: "Общее" }]);
    await expect(recoverCoreOrganizationCommand()).rejects.toThrow("не подтверждён");
    expect(pendingCoreOrganizationCommand()).not.toBeNull();
  });
  it("preserves uncertainty if context changes after the server accepted a write", async () => {
    state.domain.mockResolvedValueOnce(directions).mockImplementationOnce(async () => { state.identity.context_revision = "r2"; return { id: 20 }; });
    await expect(saveCoreOrganizationName("direction", "Изменено", 20)).rejects.toThrow("Ответ на изменение");
    expect(pendingCoreOrganizationCommand()).toMatchObject({ kind: "direction", id: 20 });
  });
  it("archives only the selected catalog object and explains protected history/members as known rejections", async () => {
    state.domain.mockResolvedValueOnce(divisions).mockRejectedValueOnce(Object.assign(new Error("division_has_members"), { status: 409, code: "division_has_members" }));
    await expect(archiveCoreOrganizationCatalog("division", 12)).rejects.toThrow("есть участники");
    expect(writes()).toEqual([["/core/divisions/12", { method: "DELETE" }]]); expect(pendingCoreOrganizationCommand()).toBeNull();
  });
  it("confirms lost direction archive only when its active owner entry is absent", async () => {
    state.domain.mockResolvedValueOnce(directions).mockRejectedValueOnce(Object.assign(new Error("lost"), { status: 504 }));
    await expect(archiveCoreOrganizationCatalog("direction", 20)).rejects.toThrow("Ответ на изменение");
    await expect(recoverCoreOrganizationCommand()).rejects.toThrow("не подтверждён");
    directions = []; await recoverCoreOrganizationCommand(); expect(pendingCoreOrganizationCommand()).toBeNull();
  });
  it("adds existing student account ID to another division without moving its profile/group or using profile ID", async () => {
    await saveCoreOrganizationParticipation(13, 45, null);
    expect(writes()).toEqual([["/core/divisions/13/memberships/45", { method: "PUT", body: '{"role_id":null}' }]]);
  });
  it("sets a staff membership role only from the current organization's live role catalog", async () => {
    await expect(saveCoreOrganizationParticipation(13, 46, null)).rejects.toThrow("действующую роль");
    await expect(saveCoreOrganizationParticipation(13, 46, 444)).rejects.toThrow("действующую роль");
    await saveCoreOrganizationParticipation(13, 46, 3);
    expect(writes()).toEqual([["/core/divisions/13/memberships/46", { method: "PUT", body: '{"role_id":3}' }]]);
  });
  it("refuses foreign-owned new assignments and student administrative roles even if stale UI enabled them", async () => {
    accounts = [{ ...student, owner_organization_id: 999 }]; canAssign = false;
    await expect(saveCoreOrganizationParticipation(13, 45, null)).rejects.toThrow("организации владельца");
    accounts = [student]; canAssign = true;
    await expect(saveCoreOrganizationParticipation(13, 45, 3)).rejects.toThrow("только сотруднику");
    expect(writes()).toHaveLength(0);
  });
  it("honors can_revoke independently from foreign-owned can_assign without adding a stricter policy", async () => {
    accounts = [{ ...student, owner_organization_id: 999 }]; canAssign = false;
    await revokeCoreOrganizationParticipation(12, 45);
    expect(writes()).toEqual([["/core/divisions/12/memberships/45", { method: "DELETE" }]]);
  });
  it("does not revoke absent or owner-protected participation", async () => {
    memberships = [{ ...member, can_revoke: false }];
    await expect(revokeCoreOrganizationParticipation(12, 45)).rejects.toThrow("не разрешает");
    await expect(revokeCoreOrganizationParticipation(13, 45)).rejects.toThrow("уже отсутствует");
    expect(writes()).toHaveLength(0);
  });
  it("preserves zero-rating and last-membership protections and clears the journal on known rejection", async () => {
    const original = state.domain.getMockImplementation()!;
    state.domain.mockImplementation(async (path, options) => {
      if (options?.method) throw Object.assign(new Error("rating_exists"), { status: 409, code: "rating_exists" });
      return original(path, options);
    });
    await expect(revokeCoreOrganizationParticipation(12, 45)).rejects.toThrow("нулевой рейтинг");
    expect(pendingCoreOrganizationCommand()).toBeNull();
  });
  it("recovers uncertain staff role assignment from the canonical membership GET without reassigning", async () => {
    const original = state.domain.getMockImplementation()!;
    state.domain.mockImplementation(async (path, options) => {
      if (options?.method) throw Object.assign(new Error("lost"), { status: 502 });
      return original(path, options);
    });
    await expect(saveCoreOrganizationParticipation(12, 46, 3)).rejects.toThrow("Ответ на изменение");
    await expect(recoverCoreOrganizationCommand()).rejects.toThrow("не подтверждён");
    memberships = [{ ...member, role_id: 3, role_name: "Редактор" }]; await recoverCoreOrganizationCommand();
    expect(writes()).toHaveLength(1); expect(pendingCoreOrganizationCommand()).toBeNull();
    expect(state.domain.mock.calls.at(-1)?.[0]).toBe("/core/organization/users/46/memberships");
  });
  it("recovers unknown revocation from membership absence and retains other division participation", async () => {
    const original = state.domain.getMockImplementation()!;
    state.domain.mockImplementation(async (path, options) => { if (options?.method) throw Object.assign(new Error("lost"), { status: 0 }); return original(path, options); });
    await expect(revokeCoreOrganizationParticipation(12, 45)).rejects.toThrow("Ответ на изменение");
    memberships = [{ ...member, division_id: 13, division_name: "Второе" }]; await recoverCoreOrganizationCommand();
    expect(pendingCoreOrganizationCommand()).toBeNull(); expect(writes()).toHaveLength(1);
  });
  it("confirms lost DELETE plus membership 404 only after complete organization account absence", async () => {
    const original = state.domain.getMockImplementation()!;
    state.domain.mockImplementation(async (path, options) => { if (options?.method) throw Object.assign(new Error("lost"), { status: 0 }); return original(path, options); });
    await expect(revokeCoreOrganizationParticipation(12, 45)).rejects.toThrow("Ответ на изменение");
    state.domain.mockImplementation(async (path, options) => {
      if (path === "/core/organization/users/45/memberships") throw Object.assign(new Error("not_found"), { status: 404, code: "not_found" });
      return original(path, options);
    });
    await expect(recoverCoreOrganizationCommand()).rejects.toThrow("не подтверждён");
    accounts = [staff]; await recoverCoreOrganizationCommand();
    expect(writes()).toHaveLength(1); expect(pendingCoreOrganizationCommand()).toBeNull();
  });
  it("never confirms lost PUT from an account 404 or an unavailable canonical owner", async () => {
    const original = state.domain.getMockImplementation()!;
    state.domain.mockImplementation(async (path, options) => { if (options?.method) throw Object.assign(new Error("lost"), { status: 0 }); return original(path, options); });
    await expect(saveCoreOrganizationParticipation(13, 45, null)).rejects.toThrow("Ответ на изменение");
    state.domain.mockImplementation(async path => {
      if (path.includes("/memberships")) throw Object.assign(new Error("not_found"), { status: 404, code: "not_found" });
      return original(path);
    });
    await expect(recoverCoreOrganizationCommand()).rejects.toMatchObject({ status: 404 });
    expect(pendingCoreOrganizationCommand()).not.toBeNull(); expect(writes()).toHaveLength(1);
  });
});
