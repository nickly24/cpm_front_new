import { beforeEach, describe, expect, it, vi } from "vitest";
const domainMock = vi.fn();
let identity = { context_revision: "rev-a", user: { account_id: 9, id: 123, organization_id: 1001, division_id: 1001, role: "admin", organization_admin: true, permissions: {} }, organizations: [{ id: 1001, name: "О", divisions: [{ id: 1001, name: "А" }, { id: 1002, name: "Б" }] }] };
vi.mock("./client", () => ({ domain: (...args: unknown[]) => domainMock(...args), getIdentity: () => identity }));
import { examsAdminGet, examsAdminMutate, examsParseImport, mapImport, examsCapabilities } from "./exams-admin";
import { ownerPerson, ownerResult, ownerOutsideResult, ownerValidation } from "./exams-shared";
const key = "314b2194-1372-43df-a370-7a1b5f307422";
const ownerExam = { id: 81, name: "Устный", exam_type: "classic", direction_id: 3, owner_division_id: 1001, connected_division_ids: [1001], connected: true, revision: 7, config: { start_at: "2026-10-08T09:00:00+03:00", end_at: null, revision: 4 }, readiness: { is_configured: true }, parts: [] };
beforeEach(() => { domainMock.mockReset(); identity = { ...identity, context_revision: "rev-a" }; });
describe("exams administration owner boundary", () => {
    it("uses live BFF capability projection when local identity rights are stale", async () => {
        const projected = {apiVersion: "v2", canReadAdminExams: true, canManageOutside: false, canCreateClassic: false};
        domainMock.mockResolvedValue(projected);
        expect(await examsAdminGet("/api/exams/capabilities")).toEqual(projected);
        expect(domainMock).toHaveBeenCalledWith("/exams/capabilities", {signal: undefined});
    });
    it("keeps import capability separate from general exam editing", async () => {
        domainMock.mockResolvedValue({ apiVersion: "v2", canReadAdminExams: true, canCreateClassic: true, canManageOutside: true, canImportExams: false });
        expect(await examsAdminGet("/api/exams/capabilities")).toMatchObject({ canCreateClassic: true, canImportExams: false });
        expect(domainMock.mock.calls[0][0]).toBe("/exams/capabilities");
    });
    it("renders structured readiness codes even when owner has no prose message", () => {
        expect(ownerValidation([{code: "start_at_required", entity_id: 0}])[0]).toMatchObject({code: "start_at_required", message: "start_at_required"});
    });

    it("uses auth account ID, retaining zero grades and points", () => { expect(ownerPerson({ account_id: 9, id: 123, full_name: "Ученик" }).id).toBe(9); expect(ownerResult({ id: 1, attempt_no: 1, raw_total: 0, rounded_total: 0, max_score: 5, effective_grade: 0 }).grade).toBe(0); expect(ownerOutsideResult({ id: 2, student: { account_id: 9 }, points: 0, grade: 0 }).points).toBe(0); });
    it("does not fabricate a score for an in-progress attempt", async () => { domainMock.mockResolvedValue({ id: 2, student: { account_id: 9 }, status: "in_progress", result: null }); const response = await examsAdminGet("/api/exams/81/classic/attempts/2") as {
        attempt: {
            result: unknown;
            grade: unknown;
        };
    }; expect(response.attempt.result).toBeNull(); expect(response.attempt.grade).toBeNull(); });
    it("translates config CAS and explicit null dates independently from exam revision", async () => { domainMock.mockResolvedValue({ changed: true }); await examsAdminMutate({ path: "/api/exams/81/classic/config", method: "PATCH", body: { startAt: null, endAt: null, expectedConfigVersion: 4 }, key }); const [path, options] = domainMock.mock.calls[0]; expect(path).toBe("/exams/81/config"); expect(options.method).toBe("PUT"); expect(JSON.parse(options.body)).toEqual({ expected_revision: 4, start_at: null, end_at: null }); expect(options.headers["Idempotency-Key"]).toBe(key); });
    it("translates nested scoring thresholds and the optional tie-breaker part", async () => { domainMock.mockResolvedValue({}); await examsAdminMutate({ path: "/api/exams/81/classic/scoring", method: "PATCH", body: { expectedConfigVersion: 5, thresholds: [{ grade: 0, minScore: 0 }], fractionalMode: "round_up", tieBreakerPartId: null }, key }); expect(JSON.parse(domainMock.mock.calls[0][1].body)).toEqual({ expected_revision: 5, fractional_mode: "round_up", tie_breaker_part_id: 0, thresholds: [{ grade: 0, min_score: 0 }] }); });
    it("sends outside result numeric values and account identifiers to owner", async () => { domainMock.mockResolvedValue({}); await examsAdminMutate({ path: "/api/exams/81/outside-lms/results", method: "POST", body: { studentId: 9, points: 0, grade: 0, examinator: "Иван" }, key }); expect(domainMock.mock.calls[0][0]).toBe("/exams/81/outside-results"); expect(JSON.parse(domainMock.mock.calls[0][1].body)).toEqual({ student_account_id: 9, points: 0, grade: 0, examinator: "Иван" }); });
    it("keeps physical-delete confirmation in headers and revision in JSON", async () => { domainMock.mockResolvedValue({ deleted: true }); await examsAdminMutate({ path: "/api/exams/81/classic/questions/4?expectedVersion=3", method: "DELETE", confirmationToken: "hash", key }); expect(domainMock.mock.calls[0][0]).toBe("/exams/81/questions/4"); expect(JSON.parse(domainMock.mock.calls[0][1].body)).toEqual({ expected_revision: 3 }); expect(domainMock.mock.calls[0][1].headers["X-Exam-Confirmation"]).toBe("hash"); });
    it("does not swallow rejected deletes", async () => { domainMock.mockRejectedValue(Object.assign(new Error("preview_changed"), { status: 409 })); await expect(examsAdminMutate({ path: "/api/exams/81", method: "DELETE", body: { expectedVersion: 7 }, key })).rejects.toMatchObject({ status: 409 }); });
    it("read-back maps outside IDs without profile lookups", async () => { domainMock.mockResolvedValue({ items: [{ id: 1, student: { account_id: 9, full_name: "Первый" }, points: 0, grade: 0, revision: 3 }, { id: 2, student: { account_id: 10, full_name: "Второй" }, points: 2, grade: 5, revision: 1 }], total: 2 }); const result = await examsAdminGet("/api/exams/81/outside-lms/results", { sort: "grade_desc", page: 1, limit: 1 }) as {
        items: {
            studentId: number;
            grade: number;
        }[];
        pagination: {
            total: number;
        };
    }; expect(result.items[0]).toMatchObject({ studentId: 10, grade: 5 }); expect(result.pagination.total).toBe(2); });
    it("searches, sorts and paginates all catalogue pages, with bank scope preserved", async () => { const rows = Array.from({ length: 201 }, (_, i) => ({ ...ownerExam, id: i + 1, name: i === 200 ? "Unique" : "Common" })); domainMock.mockImplementation((path: string) => path === "/core/directions" ? Promise.resolve([{ id: 3, name: "Математика" }]) : path.startsWith("/exams?") ? Promise.resolve({ items: path.includes("offset=200") ? rows.slice(200) : rows.slice(0, 200), total: 201 }) : Promise.resolve({ ...ownerExam, ...rows[Number(path.split("/")[2]) - 1] })); const response = await examsAdminGet("/api/exams", { scope: "bank", search: "Unique", page: 1, limit: 20 }) as {
        items: {
            id: number;
        }[];
        pagination: {
            total: number;
        };
    }; expect(response.items.map(x => x.id)).toEqual([201]); expect(response.pagination.total).toBe(1); expect(domainMock.mock.calls.some(([path]) => path.includes("scope=bank") && path.includes("offset=200"))).toBe(true); });
    it("preserves UUID import sessions and computes errors on included rows", () => { const session = mapImport({ id: key, revision: 2, state: "editable", rows: [{ row_id: "r1", source_row: 2, input: { studentId: 9 }, errors: ["student_not_found"], excluded: true }, { row_id: "r2", source_row: 3, input: { points: 0 }, errors: [], excluded: false }] }, 81); expect(session.id).toBe(key); expect(session.summary).toMatchObject({ included: 1, excluded: 1, errors: 0 }); expect(session.rows[0].errors[0].code).toBe("student_not_found"); });
    it("edits and commits the exact owner import session with CAS", async () => { domainMock.mockResolvedValue({ committed: true, counts: { results_created: 1 } }); await examsAdminMutate({ path: `/api/exams/81/imports/outside/sessions/${key}/commit`, method: "POST", body: { expectedPreviewVersion: 2 }, key }); expect(domainMock.mock.calls[0][0]).toBe(`/exams/81/imports/outside/${key}/commit`); expect(JSON.parse(domainMock.mock.calls[0][1].body)).toEqual({ expected_revision: 2 }); });
    it("uploads XLSX as FormData without a manual content type", async () => { domainMock.mockResolvedValue({ id: key, revision: 1, rows: [] }); await examsParseImport(81, "outside", new File(["fixture"], "outside.xlsx"), key); const [path, options] = domainMock.mock.calls[0]; expect(path).toBe("/exams/81/imports/outside"); expect(options.body).toBeInstanceOf(FormData); expect(options.headers["Content-Type"]).toBeUndefined(); });
    it("uses independent privilege CAS rather than composite assignment writes", async () => { domainMock.mockResolvedValue({}); await examsAdminMutate({ path: "/api/exams/81/classic/students/9/privilege", method: "PUT", body: { replacementLimit: 2, expectedPrivilegeVersion: 0 }, key }); expect(JSON.parse(domainMock.mock.calls[0][1].body)).toEqual({ expected_revision: 0, replacement_limit: 2 }); await expect(examsAdminMutate({ path: "/api/exams/81/classic/assignments", method: "POST", body: { studentId: 9, commissionId: 1, replacementLimit: 2 }, key })).rejects.toThrow("Привилегии"); });
    it("does not claim preview expiration from a service without that contract", async () => { domainMock.mockImplementation((path: string) => path.endsWith("delete-preview") ? Promise.resolve({ revision: 7, confirmation: "hash" }) : path === "/core/directions" ? Promise.resolve([]) : path === "/exams/81" ? Promise.resolve({ ...ownerExam, connected: false }) : Promise.resolve({ items: [], total: 0 })); expect(await examsAdminGet("/api/exams/81/delete-preview")).toMatchObject({ confirmationToken: "hash", expiresAt: null, version: 7 }); });
    it("gives a viewer read capability without create/edit capability", () => { identity = { ...identity, user: { ...identity.user, role: "staff_admin", organization_admin: false, permissions: { exams: { view: true, edit: false } } } }; expect(examsCapabilities()).toMatchObject({ canReadAdminExams: true, canCreateClassic: false, canManageOutside: false }); });
});
