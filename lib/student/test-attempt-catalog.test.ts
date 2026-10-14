import { describe, expect, it } from "vitest";
import { formatAttemptDeadline, mergeLocalAttempt } from "./test-attempt-catalog";
import { getAttemptErrorMessage } from "./test-attempt-api";
import type { AttemptV2Bundle } from "./test-attempt-v2-store";

const local = {
  attemptId: "local", localStatus: "sealed_pending_upload", finalSnapshot: {},
  time: { answerDeadlineEpochMs: 1000, uploadDeadlineEpochMs: 2000, serverOffsetMs: 100,
    lastEffectiveNowEpochMs: 1200, answerDeadlineMoscow: "answer", uploadDeadlineMoscow: "upload" },
  questions: [{ questionId: 1 }], committedByQuestion: { "1": {} },
} as unknown as AttemptV2Bundle;

describe("deadline presentation and saved attempts", () => {
  it("allows sending at the upload boundary and closes immediately after it", () => {
    const test = { id: "test", status: "available" as const };
    const boundary = mergeLocalAttempt(test, local, 1900);
    expect(boundary.status).toBe("pending_upload");
    expect(boundary.canSubmitExpired).toBe(true);
    const closed = mergeLocalAttempt(test, local, 1901);
    expect(closed.status).toBe("upload_window_closed");
    expect(closed.canSubmitExpired).toBe(false);
    expect(closed.canResume).toBe(false);
    expect(closed.canStart).toBe(false);
    expect(closed.canRequestHelp).toBe(true);
    expect(closed.activeAttempt?.uploadDeadline).toBe("upload");
  });
  it("never reopens a server-closed or already accepted attempt from local data", () => {
    expect(mergeLocalAttempt({ id: "test", status: "upload_window_closed", canRequestHelp: true }, local, 1000).canSubmitExpired).toBe(false);
    const accepted = { id: "test", status: "completed" as const, isCompleted: true };
    expect(mergeLocalAttempt(accepted, local)).toBe(accepted);
  });
  it("uses Moscow date and time including a next-day delivery deadline", () => {
    expect(formatAttemptDeadline("2026-10-13T22:15:30Z")).toBe("14.10.2026, 01:15:30 МСК");
  });
  it.each(["Failed to fetch", "NetworkError when attempting to fetch resource", "Load failed", "AbortError: The operation was aborted", "transport_error"])("translates %s without exposing English transport details", (raw) => {
    const message = getAttemptErrorMessage(raw);
    expect(message).toContain("Ответы сохранены");
    expect(message).toContain("автоматически");
    expect(message).not.toContain("fetch");
  });
  it("keeps immutable-answer errors separate from connectivity failures", () => {
    expect(getAttemptErrorMessage("answer_locked")).toBe("Ответ на этот вопрос уже зафиксирован");
  });
});
