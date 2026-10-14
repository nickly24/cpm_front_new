import { afterEach, describe, expect, it, vi } from "vitest";
const { domain, identity } = vi.hoisted(() => ({ domain: vi.fn(), identity: { context_revision: "a", user: { account_id: 91, id: 123, role: "examinator", organization_id: 7, division_id: 8, permissions: {} } } }));
vi.mock("./client", () => ({ domain, getIdentity: () => identity }));
import { conductAttempt, conductQuestion, conductRound, examsConductGet, examsConductMutate } from "./exams-conduct";
afterEach(() => { domain.mockReset(); identity.context_revision = "a"; });
describe("oral exam boundary", () => {
  it("preserves own zero vote and absent consensus without exposing missing private votes", () => {
    const round = conductRound({ id: 2, round_no: 3, status: "open", votes_count: 1, required_votes: 2, has_voted: true, own_vote: 0 });
    expect(round).toMatchObject({ myVote: 0, consensus: null, hasVoted: true, votesReceived: 1, votesRequired: 2 });
    expect(round).not.toHaveProperty("votes");
  });
  it("renders disputed previous rounds while retaining the current private round", () => {
    const question = conductQuestion({ id: 4, status: "open", rounds: [{ id: 1, round_no: 1, status: "disputed", votes: [{ examinator_account_id: 91, full_name: "А", value: 0 }, { examinator_account_id: 92, full_name: "Б", value: 1 }] }, { id: 2, round_no: 2, status: "open" }], round: { id: 2, round_no: 2, status: "open" }, can_replace: false });
    expect(question.lastCompletedRound?.votes?.map(v => v.value)).toEqual([0, 1]);
    expect(question.round?.votes).toBeUndefined(); expect(question.canReplace).toBe(false);
  });
  it("does not fabricate an unfinished result; uses account IDs and completed zero grade", () => {
    expect(conductAttempt({ id: 1, student: { account_id: 91, profile_id: 123 }, status: "in_progress", result: { grade: 5 } })).toMatchObject({ student: { id: 91 }, result: null });
    expect(conductAttempt({ status: "completed", result: { grade: 0, raw_total: 0, rounded_total: 0, max_score: 5 } }).result).toMatchObject({ grade: 0, rawTotal: 0 });
  });
  it("keeps history generation and UUID when ensuring an assignment", async () => {
    domain.mockResolvedValue({ created: true, attempt: { id: 50, exam_id: 10, status: "pending_ready" }, receipt: { outcome: "created", applied_state_version: 1 } });
    await examsConductMutate({ path: "/api/examiner/exams/10/assignments/20/attempts/ensure", method: "POST", key: "stable-uuid", body: { expectedHistoryGeneration: 3 } });
    expect(domain).toHaveBeenCalledWith("/exams/10/assignments/20/attempts/ensure", expect.objectContaining({ headers: { "Idempotency-Key": "stable-uuid" }, body: '{"expected_history_generation":3}' }));
    domain.mockClear(); await examsConductMutate({ path: "/api/examiner/exams/10/attempts/50/vote", method: "POST", key: "vote-key", body: { presentedQuestionId: 6, roundId: 7, value: 0 } });
    expect(domain).toHaveBeenCalledWith("/exams/10/attempts/50/vote", expect.objectContaining({ body: '{"presented_question_id":6,"round_id":7,"value":0}' }));
  });
  it("distinguishes identical attempt IDs belonging to different exams and refuses bare IDs", async () => {
    domain.mockImplementation(async (path: string) => path.includes("/attempts/") ? { id: 50, exam_id: path.includes("/11/") ? 11 : 10, status: "pending_ready" } : { name: "Выбранный экзамен" });
    for (const examId of [10, 11]) {
      const data = await examsConductGet(`/api/examiner/exams/${examId}/attempts/50`) as { attempt: { examId: number } };
      expect(data.attempt.examId).toBe(examId);
    }
    domain.mockClear();
    await expect(examsConductGet("/api/examiner/attempts/50")).rejects.toMatchObject({ code: "exam_required" });
    await expect(examsConductMutate({ path: "/api/examiner/attempts/50/vote", method: "POST", key: "key", body: {} })).rejects.toMatchObject({ code: "exam_required" });
    expect(domain).not.toHaveBeenCalled();
  });
  it("passes immutable protocol and round pagination anchors to the owner", async () => {
    domain.mockResolvedValue({ items: [], total: 80, through_sequence_no: 25 });
    const page = await examsConductGet("/api/exams/10/classic/attempts/50/questions?page=3&limit=10&throughSequenceNo=25") as { throughSequenceNo: number; pagination: { page: number } };
    expect(domain.mock.calls[0][0]).toBe("/exams/10/attempts/50/protocol?limit=10&offset=20&through_sequence_no=25"); expect(page).toMatchObject({ throughSequenceNo: 25, pagination: { page: 3 } });
  });
  it("does not widen user lookup rights for exams-only staff", async () => {
    await expect(examsConductGet("/api/exams/lookups/students")).rejects.toMatchObject({ status: 403 }); expect(domain).not.toHaveBeenCalled();
  });
});
