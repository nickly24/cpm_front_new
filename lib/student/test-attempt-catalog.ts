import type { StudentTestItem } from "./tests-types";
import { effectiveNowAfterReload, type AttemptV2Bundle } from "./test-attempt-v2-store";

export function formatAttemptDeadline(value?: string | number): string {
  if (value == null || !Number.isFinite(new Date(value).getTime())) return "—";
  return `${new Date(value).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК`;
}

export function mergeLocalAttempt(test: StudentTestItem, local: AttemptV2Bundle, clientNow = Date.now()): StudentTestItem {
  if (test.isCompleted || local.localStatus === "uploaded") return test;
  const now = effectiveNowAfterReload(local.time, clientNow);
  const closed = test.canRequestHelp || local.localStatus === "upload_window_closed" || now > local.time.uploadDeadlineEpochMs;
  const sealed = Boolean(test.canSubmitExpired) || Boolean(local.finalSnapshot) || ["sealing", "sealed_pending_upload", "uploading", "upload_window_closed"].includes(local.localStatus) || now >= local.time.answerDeadlineEpochMs;
  return {
    ...test,
    status: closed ? "upload_window_closed" : sealed ? "pending_upload" : "running",
    canStart: false, canResume: !closed && !sealed, canSubmitExpired: !closed && sealed, canRequestHelp: Boolean(closed),
    activeAttempt: {
      id: local.attemptId, expiresAt: local.time.answerDeadlineMoscow, uploadDeadline: local.time.uploadDeadlineMoscow,
      remainingSeconds: Math.max(0, Math.floor((local.time.answerDeadlineEpochMs - now) / 1000)),
      answeredCount: Object.keys(local.committedByQuestion).length, totalQuestions: local.questions.length, expired: sealed,
    },
  };
}
