import type {
  AnswerDraft,
  AttemptQuestion,
  StoredAttemptAnswer,
  TestAttempt,
} from "./test-attempt-types";

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
