import { beforeEach, describe, expect, it, vi } from "vitest";
const { domain, identity } = vi.hoisted(() => ({ domain: vi.fn(), identity: { context_revision: "one", user: { account_id: 9, organization_id: 1, division_id: 1001 } } }));
vi.mock("./client", () => ({ domain, getIdentity: () => identity }));
vi.mock("@/lib/config", () => ({ BFF_EXTERNAL_TESTS_DEV: true }));
import { adaptAttempt, answerValue, finalizePayload, studentCatalog, studentCommits, studentFinalize, studentPracticeAnswer, studentReview, studentSubmit } from "./tests-student";
import type { FinalAttemptSnapshot } from "@/lib/student/test-attempt-v2-store";

const rawAttempt = {
  id: "attempt", account_id: 9, organization_id: 1, division_id: 1001, test_id: "test", test_version_id: "version", practice: false,
  status: "in_progress", started_at: "2026-10-08T09:00:00.123Z", completed_at: null, answer_deadline: "2026-10-08T09:30:00.123Z", upload_deadline: "2026-10-09T09:30:00.123Z", server_time: "2026-10-08T09:01:00.123Z",
  question_order: [2, 1], questions: [{ question_id: 2, type: "single" as const, text: "Вопрос", points: 5, answers: [{ id: "a", text: "Да", is_correct: true }] }],
  answers: [{ question_id: 2, value: "a" }], commits: [{ commit_id: "saved-commit-id-0001", sequence: 8, question_id: 2, value: "a", answered_at: "2026-10-08T09:00:01.123Z" }], calculation_status: "not_submitted", submission_id: null, result: null,
};

const catalogRow = (id: string, access: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  id, organization_id: 1, division_id: 1001, account_id: 9, direction_id: 7, title: id, direction_name: "Алгебра",
  start_at: "2026-10-08T09:00:00Z", end_at: "2026-10-08T10:00:00Z", time_limit_minutes: 30, status: "available",
  access: { test_id: id, division_id: 1001, official_access_allowed: true, review_access_allowed: false, practice_access_allowed: false,
    official_reason: "allowed", attempt_id: null, submission_id: null, calculation_status: "not_submitted", server_time: rawAttempt.server_time, ...access },
  active_attempt: null, session: null, is_external: false, has_result: false, rate: null, ...extra,
});
const catalogPage = (items: ReturnType<typeof catalogRow>[], total = items.length, limit = 5, offset = 0) => ({ items, total, limit, offset, server_time: rawAttempt.server_time });
beforeEach(() => { domain.mockReset(); identity.context_revision = "one"; identity.user.division_id = 1001; identity.user.organization_id = 1; });

describe("student tests owner contract", () => {
  it("maps pinned identity/deadlines/commits and strips answer keys from an official attempt", () => {
    const attempt = adaptAttempt(rawAttempt);
    expect(attempt.studentId).toBe(9);
    expect(attempt.divisionId).toBe(1001);
    expect(attempt.questionOrder).toEqual([2, 1]);
    expect(attempt.remainingSeconds).toBe(1740);
    expect(attempt.serverCommits?.[0].sequence).toBe(8);
    expect(attempt.questions[0].answers?.[0]).toEqual({ id: "a", text: "Да" });
  });

  it("translates all answer types into exact owner values", () => {
    expect(answerValue({ questionId: 1, type: "single", selectedAnswer: "a" })).toEqual({ question_id: 1, value: "a" });
    expect(answerValue({ questionId: 2, type: "multiple", selectedAnswers: ["b", "a"] })).toEqual({ question_id: 2, value: ["a", "b"] });
    expect(answerValue({ questionId: 3, type: "text", textAnswer: " Ответ " })).toEqual({ question_id: 3, value: " Ответ " });
  });

  it("sends the final snapshot without the incompatible legacy envelope or hash", async () => {
    const snapshot = { testVersionId: "version", completedAtMoscow: "2026-10-08T09:01:00.123Z", reason: "manual", snapshotHash: "local-hash", answers: [{ questionId: 1, type: "single", selectedAnswer: "a", commitId: "commit", sequence: 1, committedAtMoscow: "2026-10-08T09:00:10.123Z" }] } as FinalAttemptSnapshot;
    expect(finalizePayload(snapshot)).toEqual({ test_version_id: "version", completed_at: snapshot.completedAtMoscow, reason: "manual", answers: [{ question_id: 1, value: "a" }] });
    domain.mockResolvedValue({ submission_id: "submission", submission_status: "accepted", calculation_status: "queued", result: null });
    const response = await studentFinalize("attempt", snapshot);
    expect(response).toEqual({ success: true, sessionId: "submission", submissionStatus: "accepted", calculationStatus: "queued" });
    expect(response).not.toHaveProperty("score");
  });

  it("uses compact commit acknowledgments without reloading the attempt", async () => {
    domain.mockResolvedValue({ acknowledged_commit_ids: ["new-commit-id-0001"], server_answer_count: 1, server_time: rawAttempt.server_time });
    const response = await studentCommits("attempt", [{ questionId: 2, type: "single", selectedAnswer: "a", commitId: "new-commit-id-0001", sequence: 9, committedAtMoscow: "2026-10-08T09:00:12.123Z" }]);
    expect(response.ackedCommitIds).toEqual(["new-commit-id-0001"]);
    expect(response.serverAnswerCount).toBe(1);
    expect(response.serverNowEpochMs).toBe(Date.parse(rawAttempt.server_time));
    expect(domain).toHaveBeenCalledTimes(1);
    expect(JSON.parse(domain.mock.calls[0][1].body).commits[0]).toEqual({ question_id: 2, value: "a", commit_id: "new-commit-id-0001", sequence: 9, answered_at: "2026-10-08T09:00:12.123Z" });
  });

  it("uses the permitted training feedback contract", async () => {
    domain.mockResolvedValue({ feedback: { is_correct: false, points: 0, correct_answer: ["a", "b"] }, answered_count: 1, total_questions: 2 });
    const result = await studentPracticeAnswer("practice", { questionId: 1, type: "multiple", selectedAnswers: ["a"] });
    expect(result.feedback?.correct.correctOptionIds).toEqual(["a", "b"]);
    expect(result.feedback?.isCorrect).toBe(false);
  });

  it("finishes training with the required empty JSON owner DTO", async () => {
    domain.mockImplementation(async (path: string, request: RequestInit) => {
      expect(path).toBe("/tests/attempts/practice/submit");
      expect(request.method).toBe("POST");
      expect(request.body).toBe("{}");
      return { ...rawAttempt, practice: true, status: "practice_completed", result: { score: 100, earned_points: 5, max_points: 5 } };
    });
    const result = await studentSubmit("practice");
    expect(result.success).toBe(true);
    expect(result.isPractice).toBe(true);
    expect(result.score).toBe(100);
    expect(result.stats?.correctAnswers).toBeUndefined();
    expect(result.stats?.accuracy).toBeUndefined();
    expect(result).not.toHaveProperty("sessionId");
  });

  it("reports question accuracy separately from weighted training points", async () => {
    domain.mockResolvedValue({ ...rawAttempt, practice: true, status: "practice_completed", question_order: [1, 2, 3], result: { score: 50, earned_points: 5, max_points: 10, question_results: [
      { question_id: 1, points: 0, is_correct: false },
      { question_id: 2, points: 0, is_correct: false },
      { question_id: 3, points: 5, is_correct: true },
    ] } });
    const result = await studentSubmit("practice");
    expect(result.score).toBe(50);
    expect(result.stats).toEqual({ totalQuestions: 3, totalPoints: 5, correctAnswers: 1, accuracy: 33.3 });
  });

  it("does not reveal review answers when the owner rejects visibility or calculation", async () => {
    domain.mockRejectedValue(Object.assign(new Error("calculation_pending"), { status: 409 }));
    await expect(studentReview("submission")).rejects.toThrow("calculation_pending");
    expect(domain).toHaveBeenCalledTimes(1);
  });

  it("keeps the pinned randomized review order and omits excluded questions", async () => {
    domain.mockResolvedValue({ submission: { test_id: "test", result: { score: 50 } }, questions: [1, 2, 3].map(id => ({ question_id: id, type: "text", text: String(id), correct_answers: ["Да"] })), answers: [], question_order: [3, 2, 1], question_results: [], excluded_question_ids: [2] });
    const result = await studentReview("submission");
    expect(result.review?.items.map(q => q.questionId)).toEqual([3, 1]);
    expect(result.review?.questionOrder).toEqual([3, 1]);
  });

});


describe("paginated student catalog", () => {
  it("asks the owner for one page with filters and no historical attempts or submissions", async () => {
    domain.mockImplementation(async (path: string) => {
      if (path === "/core/directions") return [{ id: 7, name: "Алгебра" }];
      expect(path).toMatch(/^\/tests\/student-catalog\?/);
      const query = new URLSearchParams(path.split("?")[1]);
      expect(Object.fromEntries(query)).toEqual({ direction_id: "7", q: "Ноль", limit: "5", offset: "10", overview: "false", include_external: "true", status: "completed", date_from: "2026-10-01", date_to: "2026-10-31" });
      return catalogPage([catalogRow("zero", { submission_id: "submission", official_access_allowed: false, calculation_status: "ready", review_access_allowed: true }, { status: "completed", session: { id: "submission", completed_at: rawAttempt.server_time, score: 0, calculation_status: "ready" } })], 11, 5, 10);
    });
    const result = await studentCatalog("Алгебра", 3, 5, false, { search: " Ноль ", status: "completed", dates: { startDate: "2026-10-01", endDate: "2026-10-31" } });
    expect(result.tests.map(t => t.id)).toEqual(["zero"]);
    expect(result.sessions[0].score).toBe(0);
    expect(result.pagination).toEqual({ current_page: 3, total_pages: 3, total_items: 11, items_per_page: 5 });
    expect(domain).toHaveBeenCalledTimes(2);
    expect(domain.mock.calls.some(([path]) => path.includes("/attempts") || path.includes("/submissions"))).toBe(false);
  });

  it("takes totals from the owner and never traverses the remaining pages", async () => {
    domain.mockResolvedValue(catalogPage([catalogRow("first")], 10000));
    const result = await studentCatalog(null, 1, 5, false);
    expect(result.pagination?.total_items).toBe(10000);
    expect(domain).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["resume_attempt", "running", true, false, false],
    ["pending_upload", "pending_upload", false, true, false],
    ["upload_deadline_passed", "upload_window_closed", false, false, true],
  ] as const)("maps %s from a compact pinned attempt summary", async (reason, status, resume, submit, help) => {
    const attempt = { id: "attempt", answer_deadline: rawAttempt.answer_deadline, upload_deadline: rawAttempt.upload_deadline, answered_count: 1, total_questions: 2 };
    domain.mockResolvedValue(catalogPage([catalogRow("test", { attempt_id: "attempt", official_reason: reason, official_access_allowed: resume }, { status, active_attempt: attempt })]));
    const item = (await studentCatalog(null, 1, 5, true)).tests[0];
    expect(item.status).toBe(status);
    expect(item.canStart).toBe(false);
    expect(item.canResume).toBe(resume);
    expect(item.canSubmitExpired).toBe(submit);
    expect(item.canRequestHelp).toBe(help);
    expect(item.activeAttempt).toMatchObject({ expiresAt: rawAttempt.answer_deadline, uploadDeadline: rawAttempt.upload_deadline, answeredCount: 1, totalQuestions: 2 });
    expect(domain).toHaveBeenCalledTimes(1);
    expect(domain.mock.calls[0][0]).toContain("overview=true");
  });

  it("keeps external tests in the same server page and preserves a zero result", async () => {
    domain.mockResolvedValue(catalogPage([catalogRow("online"), catalogRow("external", {}, { is_external: true, access: null, status: "external", date: "2026-10-08", has_result: true, rate: 0 })], 6));
    const result = await studentCatalog(null, 1, 5, false);
    expect(result.tests[1]).toMatchObject({ status: "external", isExternal: true, hasResult: true, rate: 0, canStart: false });
    expect(result.pagination?.total_items).toBe(6);
    expect(result.sessions).toEqual([]);
  });

  it("does not expose a score while calculation is pending", async () => {
    domain.mockResolvedValue(catalogPage([catalogRow("pending", { submission_id: "submission", calculation_status: "queued", official_access_allowed: false }, { status: "checking", session: { id: "submission", completed_at: rawAttempt.server_time, score: 100, calculation_status: "queued" } })]));
    const result = await studentCatalog(null, 1, 5, false);
    expect(result.sessions[0].score).toBeUndefined();
    expect(result.tests[0].activeAttempt).toBeNull();
  });

  it.each(["organization", "division", "account", "test", "attempt", "session"])("rejects a malformed %s scope", async boundary => {
    const row = catalogRow("test");
    if (boundary === "organization") row.organization_id = 2;
    if (boundary === "division") row.division_id = 1002;
    if (boundary === "account") row.account_id = 10;
    if (boundary === "test") row.access.test_id = "other";
    if (boundary === "attempt") Object.assign(row, { active_attempt: { id: "foreign" } });
    if (boundary === "session") Object.assign(row, { session: { id: "foreign" } });
    domain.mockResolvedValue(catalogPage([row]));
    await expect(studentCatalog(null, 1, 5, false)).rejects.toThrow("Некорректная область");
  });

  it("rejects a cabinet change before displaying the page", async () => {
    domain.mockImplementation(async () => { identity.context_revision = "two"; return catalogPage([catalogRow("first")]); });
    await expect(studentCatalog(null, 1, 5, false)).rejects.toThrow("Кабинет изменился");
  });

  it("passes cancellation to the only page request and rejects an aborted result", async () => {
    const controller = new AbortController();
    domain.mockImplementation(async (_path, init) => { expect(init.signal).toBe(controller.signal); controller.abort(); return catalogPage([]); });
    await expect(studentCatalog(null, 1, 5, false, { signal: controller.signal })).rejects.toThrow();
    expect(domain).toHaveBeenCalledTimes(1);
  });

  it("reloads direction identifiers for the next operation", async () => {
    let id = 7;
    domain.mockImplementation(async (path: string) => {
      if (path === "/core/directions") return [{ id, name: "Алгебра" }];
      expect(new URLSearchParams(path.split("?")[1]).get("direction_id")).toBe(String(id));
      return catalogPage([]);
    });
    await studentCatalog("Алгебра", 1, 5, false);
    id = 8;
    await studentCatalog("Алгебра", 1, 5, false);
    expect(domain.mock.calls.filter(([path]) => path === "/core/directions")).toHaveLength(2);
  });
});
