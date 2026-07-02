import type {
  AnswerDraft,
  AttemptQuestion,
  StoredAttemptAnswer,
  TestAttempt,
} from "./test-attempt-types";

export type QuestionSyncState = "empty" | "pending" | "syncing" | "synced";

export function getQuestionSyncState(
  questionId: number,
  attempt: TestAttempt,
  pendingQuestionIds: number[],
  syncing: boolean,
): QuestionSyncState {
  const hasLocal = attempt.answers.some(
    (answer) => answer.questionId === questionId,
  );
  if (!hasLocal) {
    return "empty";
  }
  if (pendingQuestionIds.includes(questionId)) {
    return syncing ? "syncing" : "pending";
  }
  return "synced";
}

export function questionSyncStateLabel(state: QuestionSyncState): string {
  switch (state) {
    case "pending":
      return "Сохранено на устройстве";
    case "syncing":
      return "Отправляем на сервер…";
    case "synced":
      return "На сервере";
    default:
      return "";
  }
}

export function formatRemainingSeconds(total: number): string {
  const seconds = Math.max(0, Math.floor(total));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function getStoredAnswer(
  attempt: TestAttempt,
  questionId: number,
): StoredAttemptAnswer | null {
  return (
    attempt.answers.find((answer) => answer.questionId === questionId) ?? null
  );
}

export function createEmptyDraft(question: AttemptQuestion): AnswerDraft {
  if (question.type === "single") {
    return { type: "single", selectedAnswer: null };
  }

  if (question.type === "multiple") {
    return { type: "multiple", selectedAnswers: [] };
  }

  return { type: "text", textAnswer: "" };
}

export function draftFromStoredAnswer(
  stored: StoredAttemptAnswer,
): AnswerDraft {
  if (stored.type === "single") {
    return {
      type: "single",
      selectedAnswer: stored.selectedAnswer ?? null,
    };
  }

  if (stored.type === "multiple") {
    return {
      type: "multiple",
      selectedAnswers: stored.selectedAnswers ?? [],
    };
  }

  return {
    type: "text",
    textAnswer: stored.textAnswer ?? "",
  };
}

export function isDraftValid(draft: AnswerDraft): boolean {
  if (draft.type === "single") {
    return draft.selectedAnswer != null;
  }

  if (draft.type === "multiple") {
    return draft.selectedAnswers.length > 0;
  }

  return draft.textAnswer.trim().length > 0;
}

export function draftToStoredAnswer(
  questionId: number,
  draft: AnswerDraft,
): StoredAttemptAnswer {
  if (draft.type === "single") {
    return {
      questionId,
      type: "single",
      selectedAnswer: draft.selectedAnswer ?? undefined,
    };
  }

  if (draft.type === "multiple") {
    return {
      questionId,
      type: "multiple",
      selectedAnswers: draft.selectedAnswers,
    };
  }

  return {
    questionId,
    type: "text",
    textAnswer: draft.textAnswer.trim(),
  };
}

/** Слияние лёгкого ответа сервера с локальным пакетом вопросов. */
export function mergeAttemptFromServer(
  local: TestAttempt,
  server: TestAttempt,
  options?: { preserveQuestionIds?: number[] },
): TestAttempt {
  const preserveQuestionIds = new Set(options?.preserveQuestionIds ?? []);
  const serverAnswerIds = new Set(
    server.answers.map((answer) => answer.questionId),
  );
  const preservedLocalAnswers = local.answers.filter(
    (answer) =>
      preserveQuestionIds.has(answer.questionId) &&
      !serverAnswerIds.has(answer.questionId),
  );
  const answers = [...server.answers, ...preservedLocalAnswers];
  const answeredIds = new Set(
    answers.map((answer) => answer.questionId),
  );
  const questions = local.questions.map((question) => ({
    ...question,
    locked: answeredIds.has(question.questionId),
  }));

  return {
    ...local,
    status: server.status,
    expiresAt: server.expiresAt,
    remainingSeconds: server.remainingSeconds,
    timeExpired: server.timeExpired,
    answers,
    answeredCount: answers.length,
    totalQuestions: server.totalQuestions,
    questionOrder: server.questionOrder,
    questions,
  };
}

export function toggleMultipleAnswer(
  draft: Extract<AnswerDraft, { type: "multiple" }>,
  optionId: number,
): AnswerDraft {
  const selected = new Set(draft.selectedAnswers);

  if (selected.has(optionId)) {
    selected.delete(optionId);
  } else {
    selected.add(optionId);
  }

  return {
    type: "multiple",
    selectedAnswers: Array.from(selected),
  };
}
