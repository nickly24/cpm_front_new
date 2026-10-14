import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ domain: vi.fn(), blob: vi.fn(), identity: { context_revision: "one", user: { account_id: 9, organization_id: 7, division_id: 11, role: "staff_admin", organization_admin: false, permissions: {} as Record<string, { view: boolean; edit: boolean }> }, organizations: [{ id: 7, name: "Организация", divisions: [{ id: 11, name: "А", permissions: {} as Record<string, { view: boolean; edit: boolean }> }, { id: 12, name: "Б", permissions: {} as Record<string, { view: boolean; edit: boolean }> }] }] } }));
vi.mock("./client", () => ({ domain: state.domain, bffBlobRequest: state.blob, getIdentity: () => state.identity }));
import { examsAdminGet, examsDownloadTemplate, mapImport } from "./exams-admin";
import { ownerExam } from "./exams-shared";
import type { ExamSummary, ImportSession, Page } from "@/lib/exams-v2/types";

const sessionId = "6ba28a19-0d22-4d04-9988-18ba37c67a47";
const importPath = `/api/exams/31/imports/questions/sessions/${sessionId}`;
const summaryExam = { id: 31, name: "Экзамен", exam_type: "classic", direction_id: 4, revision: 1, exam_date: "2026-10-09", start_at: "2026-10-08T21:15:00Z", end_at: "2026-10-09T12:00:00Z", training_enabled: true };
function preview(total: number, offset = 0) {
  const end = Math.min(total, offset + 200);
  return { id: sessionId, exam_id: 31, kind: "questions", organization_id: 7, division_id: 11, account_id: 9, revision: 8, state: "editable", filename: "questions.xlsx", source_hash: "a".repeat(64), validation_hash: "b".repeat(64), expires_at: "2026-10-11T10:00:00Z", result: null,
    total, limit: 200, offset, has_more: end < total, next_offset: end < total ? end : null,
    summary: { total_rows: total, included_rows: total, excluded_rows: 0, error_rows: total ? 1 : 0, valid_rows: Math.max(0, total - 1) },
    rows: Array.from({ length: end - offset }, (_, i) => ({ row_id: `r${offset + i}`, source_row: offset + i + 2, input: { question_text: `Вопрос ${offset + i}`, answer_text: "Ответ" }, excluded: false, errors: offset + i === total - 1 ? ["invalid_part"] : [] })) };
}
beforeEach(() => { state.domain.mockReset(); state.blob.mockReset(); state.identity.context_revision = "one"; state.identity.user.role = "staff_admin"; state.identity.user.organization_admin = false; state.identity.user.permissions = {}; state.identity.organizations[0].divisions.forEach(d => { d.permissions = {}; }); });

describe("exam catalogue and import owner audit", () => {
  it("requires explicit editing rights in each connected division for shared content and keeps organization admin authority", async () => {
    const detail = { ...summaryExam, exam_type: "outside_lms", owner_division_id: 11, connected_division_ids: [11, 12], connected: true };
    state.domain.mockImplementation((path: string) => path === "/exams/31" ? detail : path === "/core/directions" ? [] : { items: [], total: 0 });
    state.identity.user.permissions = { exams: { view: true, edit: true } };
    expect(await examsAdminGet("/api/exams/31/overview")).toMatchObject({ canEditContent: false });
    state.identity.organizations[0].divisions[1].permissions = { exams: { view: true, edit: false } };
    expect(await examsAdminGet("/api/exams/31/overview")).toMatchObject({ canEditContent: false });
    state.identity.organizations[0].divisions[1].permissions = { exams: { view: true, edit: true } };
    expect(await examsAdminGet("/api/exams/31/overview")).toMatchObject({ canEditContent: true });
    state.identity.user.permissions.exams.edit = false;
    expect(await examsAdminGet("/api/exams/31/overview")).toMatchObject({ canEditContent: false });
    state.identity.user.role = "admin"; state.identity.user.organization_admin = true;
    expect(await examsAdminGet("/api/exams/31/overview")).toMatchObject({ canEditContent: true });
  });
  it("filters the owner before pagination, fetches directions once and uses complete summaries without detail reads", async () => {
    state.domain.mockImplementation((path: string) => path === "/core/directions" ? [{ id: 4, name: "Математика" }] : { total: 3, items: [{ ...summaryExam, id: 33 }, { ...summaryExam, id: 31 }, { ...summaryExam, id: 32 }] });
    const result = await examsAdminGet("/api/exams", { dateFrom: "2026-10-09", dateTo: "2026-10-09", sort: "date_desc", limit: 2 }) as Page<ExamSummary>;
    expect(result.items.map(e => e.id)).toEqual([33, 32]);
    expect(result.items[0]).toMatchObject({ examDate: "2026-10-09", startAt: summaryExam.start_at, endAt: summaryExam.end_at, trainingEnabled: true, readiness: "unknown" });
    expect(state.domain.mock.calls.map(call => call[0])).toEqual(["/core/directions", "/exams?scope=division&date_from=2026-10-09&date_to=2026-10-09&sort=date_desc&limit=200&offset=0"]);
  });
  it("retains explicit unset dates/windows and distinguishes unknown readiness from an actual incomplete check", () => {
    expect(ownerExam({ ...summaryExam, exam_date: null, start_at: null, end_at: null, config: { start_at: "2026-10-01T10:00:00Z" } })).toMatchObject({ examDate: null, startAt: null, endAt: null, readiness: "unknown" });
    expect(ownerExam({ ...summaryExam, readiness: { configured: false } }).readiness).toBe("incomplete");
    expect(ownerExam({ ...summaryExam, readiness: { configured: true } }).readiness).toBe("ready");
  });
  it("preserves owner creation ordering when creation timestamps are absent from the public summary", async () => {
    state.domain.mockImplementation((path: string) => path === "/core/directions" ? [] : { total: 2, items: [{ ...summaryExam, id: 31 }, { ...summaryExam, id: 45 }] });
    const result = await examsAdminGet("/api/exams", { sort: "created_desc" }) as Page<ExamSummary>;
    expect(result.items.map(e => e.id)).toEqual([31, 45]);
    expect(state.domain.mock.calls[1][0]).toContain("sort=created_desc");
  });
  it("preserves the owner's case-insensitive direction ordering and stable ID ties", async () => {
    state.domain.mockImplementation((path: string) => path === "/core/directions" ? [{ id: 4, name: "Математика" }, { id: 5, name: "математика" }] : { total: 2, items: [{ ...summaryExam, id: 31, direction_id: 4 }, { ...summaryExam, id: 45, direction_id: 5 }] });
    const result = await examsAdminGet("/api/exams", { sort: "direction_asc" }) as Page<ExamSummary>;
    expect(result.items.map(e => e.id)).toEqual([31, 45]);
    expect(state.domain.mock.calls[1][0]).toContain("sort=direction_asc");
  });
  it("collects all 5000 rows under the first revision and keeps canonical counts and hashes when filtering late errors", async () => {
    state.domain.mockImplementation((path: string) => preview(5000, Number(new URL(path, "http://bff.invalid").searchParams.get("offset"))));
    const result = await examsAdminGet(importPath, { onlyErrors: true }) as { session: ImportSession };
    expect(state.domain).toHaveBeenCalledTimes(25);
    expect(state.domain.mock.calls[0][0]).not.toContain("expected_revision");
    expect(state.domain.mock.calls.slice(1).every(call => String(call[0]).includes("expected_revision=8"))).toBe(true);
    expect(result.session.rows.map(r => r.rowId)).toEqual(["r4999"]);
    expect(result.session.pagination?.total).toBe(1);
    expect(result.session).toMatchObject({ previewVersion: 8, status: "editable", filename: "questions.xlsx", sourceHash: "a".repeat(64), validationHash: "b".repeat(64), ownerSummary: { total_rows: 5000, error_rows: 1 }, summary: { total: 5000, included: 5000, errors: 1, creatable: 4999 } });
  });
  it("uses the owner's full summary even when parse/mutation returns only its first page", () => {
    const value = mapImport(preview(251), 31);
    expect(value.summary).toMatchObject({ total: 251, included: 251, errors: 1, creatable: 250 });
    expect(value.ownerSummary?.total_rows).toBe(251);
  });
  it.each(["revision", "total", "state", "source_hash", "validation_hash"])("rejects changed %s on a later page instead of combining previews", async field => {
    state.domain.mockImplementation((path: string) => path.includes("offset=0") ? preview(251) : { ...preview(251, 200), [field]: field === "revision" ? 9 : field === "total" ? 252 : field === "state" ? "committed" : "c".repeat(64) });
    await expect(examsAdminGet(importPath)).rejects.toMatchObject({ status: 409, code: "preview_modified" });
    expect(state.domain).toHaveBeenCalledTimes(2);
  });
  it("preserves an owner CAS rejection without retrying the GET or any command", async () => {
    state.domain.mockResolvedValueOnce(preview(251)).mockRejectedValueOnce(Object.assign(new Error("preview_modified"), { status: 409, code: "preview_modified" }));
    await expect(examsAdminGet(importPath)).rejects.toMatchObject({ status: 409, code: "preview_modified" });
    expect(state.domain).toHaveBeenCalledTimes(2);
  });
  it.each([
    { total: 5001 }, { total: -1 }, { revision: 0 }, { state: "unknown" }, { rows: null }, { rows: [] }, { has_more: false }, { next_offset: 199 }, { source_hash: "invalid" }, { division_id: 12 }, { summary: { total_rows: 251 } },
  ])("rejects a malformed or oversized preview %# before exposing rows", async change => {
    state.domain.mockResolvedValue({ ...preview(251), ...change });
    await expect(examsAdminGet(importPath)).rejects.toMatchObject({ status: 502, code: "invalid_response" });
    expect(state.domain).toHaveBeenCalledTimes(1);
  });
  it("rejects duplicate rows across pages even with unchanged revision and total", async () => {
    const second = preview(251, 200); second.rows[0].row_id = "r0";
    state.domain.mockResolvedValueOnce(preview(251)).mockResolvedValueOnce(second);
    await expect(examsAdminGet(importPath)).rejects.toMatchObject({ status: 502, code: "invalid_response" });
  });
  it("stops after a cabinet change without exposing the old preview", async () => {
    state.domain.mockImplementation((path: string) => { const offset = path.includes("offset=200") ? 200 : 0; if (offset) state.identity.context_revision = "two"; return preview(251, offset); });
    await expect(examsAdminGet(importPath)).rejects.toMatchObject({ status: 409, code: "context_changed" });
  });
  it("accepts an empty preview with the owner's explicit zero counts", async () => {
    state.domain.mockResolvedValue(preview(0));
    const value = await examsAdminGet(importPath) as { session: ImportSession };
    expect(value.session.summary.total).toBe(0); expect(value.session.rows).toEqual([]);
  });
  it("accepts migrated sessions without retained original-file metadata while locking their validation hash and revision", async () => {
    state.domain.mockImplementation((path: string) => ({ ...preview(251, path.includes("offset=200") ? 200 : 0), source_hash: "", filename: "" }));
    const value = await examsAdminGet(importPath) as { session: ImportSession };
    expect(value.session).toMatchObject({ sourceHash: "", filename: "", validationHash: "b".repeat(64), summary: { total: 251 } });
    expect(state.domain.mock.calls[1][0]).toContain("expected_revision=8");
  });
  it("downloads native XLSX through the protected BFF blob boundary", async () => {
    const blob = new Blob(["xlsx"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); state.blob.mockResolvedValue(blob);
    const signal = new AbortController().signal;
    expect(await examsDownloadTemplate(31, "assignments", signal)).toBe(blob);
    expect(state.blob).toHaveBeenCalledWith("/exams/31/imports/assignments/template", { signal });
    expect(state.domain).not.toHaveBeenCalled();
  });
  it("rejects JSON-success bytes and preserves an access-denied download as a failure", async () => {
    state.blob.mockResolvedValueOnce(new Blob(['{"error":"access_denied"}'], { type: "application/json" }));
    await expect(examsDownloadTemplate(31, "outside")).rejects.toMatchObject({ status: 502, code: "invalid_response" });
    state.blob.mockRejectedValueOnce(Object.assign(new Error("denied"), { status: 403, code: "access_denied" }));
    await expect(examsDownloadTemplate(31, "outside")).rejects.toMatchObject({ status: 403, code: "access_denied" });
  });
});
