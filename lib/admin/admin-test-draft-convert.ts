import type { AdminTestQuestionType } from "@/lib/admin/admin-tests-types";
import type { DraftAnswerNode } from "@/lib/admin/admin-test-drafts-types";

type UidFactory = (prefix: string) => string;

function ensureMinChoiceAnswers(answers: DraftAnswerNode[], uid: UidFactory): DraftAnswerNode[] {
  const next = [...answers];
  while (next.filter((answer) => answer.kind === "answer").length < 2) {
    next.push({ id: uid("a"), kind: "answer", text: "", isCorrect: false });
  }
  return next;
}

function ensureMinTextAnswers(answers: DraftAnswerNode[], uid: UidFactory): DraftAnswerNode[] {
  if (answers.some((answer) => answer.kind === "textAnswer")) {
    return answers;
  }
  return [{ id: uid("text"), kind: "textAnswer", text: "", isCorrect: true }];
}

function normalizeSingleCorrect(answers: DraftAnswerNode[]): DraftAnswerNode[] {
  const correctIndex = answers.findIndex((answer) => answer.kind === "answer" && answer.isCorrect);
  if (correctIndex < 0) {
    return answers.map((answer) =>
      answer.kind === "answer" ? { ...answer, isCorrect: false } : answer,
    );
  }
  return answers.map((answer, index) =>
    answer.kind === "answer"
      ? { ...answer, isCorrect: index === correctIndex }
      : answer,
  );
}

function choiceToTextAnswers(answers: DraftAnswerNode[], uid: UidFactory): DraftAnswerNode[] {
  const converted = answers
    .filter((answer) => answer.kind === "answer" && answer.isCorrect)
    .map((answer) => ({
      id: answer.id,
      kind: "textAnswer" as const,
      text: answer.text,
      isCorrect: true,
    }));
  return ensureMinTextAnswers(converted, uid);
}

function textToChoiceAnswers(
  answers: DraftAnswerNode[],
  toType: "single" | "multiple",
  uid: UidFactory,
): DraftAnswerNode[] {
  const converted = answers
    .filter((answer) => answer.kind === "textAnswer")
    .map((answer, index) => ({
      id: answer.id,
      kind: "answer" as const,
      text: answer.text,
      isCorrect: toType === "multiple" ? true : index === 0,
    }));
  const padded = ensureMinChoiceAnswers(converted, uid);
  return toType === "single" ? normalizeSingleCorrect(padded) : padded;
}

export function convertQuestionAnswersOnTypeChange(
  fromType: AdminTestQuestionType,
  toType: AdminTestQuestionType,
  answers: DraftAnswerNode[],
  uid: UidFactory,
): DraftAnswerNode[] {
  if (fromType === toType) {
    return answers.map((answer) => ({ ...answer }));
  }

  const isChoice = (type: AdminTestQuestionType) => type === "single" || type === "multiple";
  const fromChoice = isChoice(fromType);
  const toChoice = isChoice(toType);

  if (fromChoice && toType === "text") {
    return choiceToTextAnswers(answers, uid);
  }

  if (fromType === "text" && toChoice) {
    return textToChoiceAnswers(answers, toType, uid);
  }

  if (fromChoice && toChoice) {
    const choiceAnswers = answers
      .filter((answer) => answer.kind === "answer")
      .map((answer) => ({ ...answer }));
    const padded = ensureMinChoiceAnswers(choiceAnswers, uid);
    if (toType === "single") {
      return normalizeSingleCorrect(padded);
    }
    return padded;
  }

  if (fromType === "text") {
    return answers
      .filter((answer) => answer.kind === "textAnswer")
      .map((answer) => ({ ...answer, isCorrect: true }));
  }

  return ensureMinChoiceAnswers(
    answers.filter((answer) => answer.kind === "answer").map((answer) => ({ ...answer })),
    uid,
  );
}
