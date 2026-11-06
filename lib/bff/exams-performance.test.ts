import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ domain: vi.fn(), identity: { context_revision: "one", user: { account_id: 91, organization_id: 7, division_id: 11, role: "student" } } }));
vi.mock("./client", () => ({ domain: state.domain, getIdentity: () => state.identity }));
import { examsAdminGet } from "./exams-admin";
import { examsConductGet } from "./exams-conduct";
import { examsStudentGet } from "./exams-student";
import { examOwnerPage, examPageQuery } from "./exams-shared";

beforeEach(() => { state.domain.mockReset(); state.identity.context_revision = "one"; state.identity.user.division_id = 11; });

describe("bounded exam reads", () => {
  it.each([
    ["classic/parts", {}, "parts?limit=20&offset=40", { id: 3, code: "А", bank_size: 5000 }],
    ["classic/questions", { partId: 3, search: "Вопрос" }, "questions?part_id=3&q=%D0%92%D0%BE%D0%BF%D1%80%D0%BE%D1%81&limit=20&offset=40", { id: 5, part_id: 3, part_code: "А" }],
    ["classic/commissions", { search: "Комиссия" }, "commissions?q=%D0%9A%D0%BE%D0%BC%D0%B8%D1%81%D1%81%D0%B8%D1%8F&limit=20&offset=40", { id: 4, members: [{ account_id: 91 }], assigned_students_count: 400 }],
    ["classic/assignments", { status: "in_progress" }, "assignments?status=in_progress&limit=20&offset=40", { id: 1, student: { account_id: 91 }, status: "in_progress" }],
    ["classic/attempts", { status: "completed", attemptNo: 2 }, "attempts?status=completed&attempt_no=2&limit=20&offset=40", { id: 1, status: "completed", result: { effective_grade: 0 } }],
    ["classic/privileges", {}, "privileges?limit=20&offset=40", { student: { account_id: 91 }, replacement_limit: 2 }],
    ["classic/results", { grade: 0, hasAppeal: false }, "results?grade=0&has_appeal=false&completed_only=true&limit=20&offset=40", { id: 7, status: "completed", student: { account_id: 91 }, effective_grade: 0, first_attempt_id: 5, retake_assignment_id: 8, retake_status: "completed" }],
  ] as const)("reads just the requested %s page, even when total is 5000", async (suffix, params, expected, row) => {
    state.domain.mockResolvedValue({ items: Array.from({ length: 20 }, () => row), total: 5000, limit: 20, offset: 40 });
    const result = await examsAdminGet(`/api/exams/31/${suffix}`, { ...params, page: 3 }) as { items: unknown[]; pagination: { total: number; page: number; hasNext: boolean } };
    expect(result.items).toHaveLength(20); expect(result.pagination).toMatchObject({ total: 5000, page: 3, hasNext: true });
    expect(state.domain).toHaveBeenCalledTimes(1); expect(state.domain.mock.calls[0][0]).toBe(`/exams/31/${expected}`);
  });
  it("keeps an account label for a privilege created before assignment", async () => {
    state.domain.mockResolvedValue({ items: [{ student_account_id: 91, student: { account_id: 91, full_name: "" }, replacement_limit: 2 }], total: 1 });
    expect(await examsAdminGet("/api/exams/31/classic/privileges")).toMatchObject({ items: [{ student: { id: 91, fullName: "Аккаунт 91" }, replacementLimit: 2 }] });
  });
  it("gets overview aggregates without downloading any counted collections", async () => {
    state.domain.mockImplementation((path: string) => path === "/core/directions" ? [] : { exam: { id: 31, connected: true }, counts: { parts: 8, questions: 5000, commissions: 100, assignments: 500, results: 300, pending: 20, in_progress: 10, completed: 300 } });
    expect(await examsAdminGet("/api/exams/31/overview")).toMatchObject({ classic: { partsCount: 8, questionsCount: 5000, commissionsCount: 100, assignmentsCount: 500, resultsCount: 300, attempts: { pending: 20, inProgress: 10, completed: 300 } } });
    expect(state.domain.mock.calls.map(call => call[0])).toEqual(["/exams/31/overview", "/core/directions"]);
  });
  it("loads available training as a single page without question text or progress prefetch", async () => {
    state.domain.mockResolvedValue({ items: [{ id: 31, name: "Алгебра", parts_count: 4, cards_count: 5000 }], total: 100, limit: 12, offset: 12 });
    const result = await examsStudentGet("/api/student/exams/training", { page: 2, limit: 12 }) as { items: Record<string, unknown>[]; pagination: { total: number } };
    expect(result.items[0]).toMatchObject({ exam_id: 31, parts_count: 4, total_cards: 5000 }); expect(result.items[0]).not.toHaveProperty("learned_cards");
    expect(result.pagination.total).toBe(100); expect(state.domain.mock.calls.map(call => call[0])).toEqual(["/exams?scope=division&training=true&limit=12&offset=12"]);
  });
  it("discards an in-flight page after a cabinet switch and retries in the current scope", async () => {
    let release!: (value: unknown) => void;
    state.domain.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const first = examsConductGet("/api/examiner/exams/31/students");
    state.identity.context_revision = "two"; state.identity.user.division_id = 12;
    release({ items: [{ id: 1, student: { account_id: 100 } }], total: 1 });
    await expect(first).rejects.toMatchObject({ status: 409, code: "context_changed" });
    state.domain.mockResolvedValueOnce({ items: [{ id: 2, student: { account_id: 200 } }], total: 1 });
    expect(await examsConductGet("/api/examiner/exams/31/students")).toMatchObject({ items: [{ assignmentId: 2, student: { id: 200 } }] });
    expect(state.domain).toHaveBeenCalledTimes(2);
  });
  it("does not retry a failed list in the background, and an explicit retry repeats only that page", async () => {
    state.domain.mockRejectedValueOnce(new TypeError("lost response")).mockResolvedValueOnce({ items: [], total: 0, limit: 20, offset: 0 });
    await expect(examsAdminGet("/api/exams/31/classic/questions", { page: 8 })).rejects.toThrow("lost response"); expect(state.domain).toHaveBeenCalledTimes(1);
    expect(await examsAdminGet("/api/exams/31/classic/questions", { page: 8 })).toMatchObject({ items: [], pagination: { page: 8, total: 0 } });
    expect(state.domain.mock.calls.map(call => call[0])).toEqual(Array(2).fill("/exams/31/questions?limit=20&offset=140"));
  });
  it("does not expose an aborted page", async () => {
    const controller = new AbortController(); state.domain.mockImplementation(() => { controller.abort(); return { items: [], total: 0 }; });
    await expect(examOwnerPage("/exams", {}, {}, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
  it.each([{ items: Array(21).fill({}), total: 500 }, { items: [], total: -1 }, { items: [], total: 1, offset: 3 }, { items: [], total: 1, limit: 200 }])("rejects a malformed owner page %#", async value => {
    state.domain.mockResolvedValue(value); await expect(examOwnerPage("/exams")).rejects.toMatchObject({ status: 502, code: "invalid_response" }); expect(state.domain).toHaveBeenCalledTimes(1);
  });
  it("normalizes page bounds and never sends caller-selected account or cabinet", () => {
    expect(examPageQuery({ page: 2.7, limit: 999, account_id: 999, division_id: 88 }, { q: "Имя" })).toBe("q=%D0%98%D0%BC%D1%8F&limit=200&offset=200");
    expect(examPageQuery({ page: Infinity, limit: Infinity })).toBe("limit=20&offset=0");
  });
});
