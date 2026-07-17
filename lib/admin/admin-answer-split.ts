import type { AdminTestQuestionType } from "@/lib/admin/admin-tests-types";
import type { DraftAnswerNode, DraftQuestionNode } from "@/lib/admin/admin-test-drafts-types";
import { convertQuestionAnswersOnTypeChange } from "@/lib/admin/admin-test-draft-convert";

export type AnswerSplitDelimiter =
  | "auto"
  | ","
  | ";"
  | "/"
  | "|"
  | "newline"
  | "custom";

export const ANSWER_SPLIT_DELIMITER_OPTIONS: Array<{
  value: AnswerSplitDelimiter;
  label: string;
}> = [
  { value: "auto", label: "Авто" },
  { value: ",", label: "Запятая ," },
  { value: ";", label: "Точка с запятой ;" },
  { value: "/", label: "Слэш /" },
  { value: "|", label: "Палка |" },
  { value: "newline", label: "Новая строка" },
  { value: "custom", label: "Свой" },
];

const AUTO_CANDIDATES = [",", ";", "/", "|", "\n"] as const;

function countOccurrences(text: string, delimiter: string): number {
  if (!delimiter) {
    return 0;
  }
  if (delimiter === "\n") {
    return (text.match(/\r?\n/g) || []).length;
  }
  let count = 0;
  let index = 0;
  while (index < text.length) {
    const found = text.indexOf(delimiter, index);
    if (found < 0) {
      break;
    }
    count += 1;
    index = found + delimiter.length;
  }
  return count;
}

export function detectDelimiter(text: string): string {
  const source = text ?? "";
  let best = ",";
  let bestScore = -1;
  for (const candidate of AUTO_CANDIDATES) {
    const score = countOccurrences(source, candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return bestScore > 0 ? best : ",";
}

export function splitAnswerText(
  text: string,
  delimiter: string,
): string[] {
  const source = text ?? "";
  if (!delimiter) {
    const trimmed = source.trim();
    return trimmed ? [trimmed] : [];
  }

  const parts =
    delimiter === "\n"
      ? source.split(/\r?\n/)
      : source.split(delimiter);

  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const value = part.replace(/\s+/g, " ").trim();
    if (!value) {
      continue;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    cleaned.push(value);
  }
  return cleaned;
}

export function splitAnswerWithMode(
  text: string,
  mode: AnswerSplitDelimiter,
  customDelimiter = "",
): { delimiter: string; parts: string[] } {
  const delimiter =
    mode === "auto"
      ? detectDelimiter(text)
      : mode === "custom"
        ? customDelimiter
        : mode === "newline"
          ? "\n"
          : mode;
  return {
    delimiter,
    parts: splitAnswerText(text, delimiter),
  };
}

type UidFactory = (prefix: string) => string;

function partsToAnswerNodes(
  parts: string[],
  targetType: AdminTestQuestionType,
  uid: UidFactory,
): DraftAnswerNode[] {
  if (targetType === "text") {
    return parts.map((text) => ({
      id: uid("text"),
      kind: "textAnswer" as const,
      text,
      isCorrect: true,
    }));
  }

  return parts.map((text, index) => ({
    id: uid("a"),
    kind: "answer" as const,
    text,
    isCorrect: targetType === "multiple" ? true : index === 0,
  }));
}

function ensureChoiceMinimum(
  answers: DraftAnswerNode[],
  uid: UidFactory,
): DraftAnswerNode[] {
  const next = [...answers];
  while (next.filter((answer) => answer.kind === "answer").length < 2) {
    next.push({
      id: uid("a"),
      kind: "answer",
      text: "",
      isCorrect: false,
    });
  }
  return next;
}

/**
 * Заменяет выбранный ответ на разобранные куски и при необходимости
 * меняет тип вопроса. Остальные ответы сохраняются (с конвертацией вида).
 */
export function applyAnswerSplitToQuestion(
  question: DraftQuestionNode,
  sourceAnswerId: string,
  parts: string[],
  targetType: AdminTestQuestionType,
  uid: UidFactory,
): DraftQuestionNode {
  const cleanedParts = parts
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (cleanedParts.length === 0) {
    return question;
  }

  const sourceIndex = question.answers.findIndex(
    (answer) => answer.id === sourceAnswerId,
  );
  if (sourceIndex < 0) {
    return question;
  }

  const others = question.answers.filter((answer) => answer.id !== sourceAnswerId);
  const convertedOthers =
    question.type === targetType
      ? others.map((answer) => ({ ...answer }))
      : convertQuestionAnswersOnTypeChange(
          question.type,
          targetType,
          others,
          uid,
        ).filter((answer) => {
          // convert может добавить пустые placeholder'ы — убираем пустые,
          // если есть реальные куски
          return Boolean(answer.text.trim()) || cleanedParts.length < 2;
        });

  const partNodes = partsToAnswerNodes(cleanedParts, targetType, uid);
  const insertAt = Math.min(sourceIndex, convertedOthers.length);
  const nextAnswers = [
    ...convertedOthers.slice(0, insertAt),
    ...partNodes,
    ...convertedOthers.slice(insertAt),
  ];

  let answers =
    targetType === "text"
      ? nextAnswers.filter((answer) => answer.kind === "textAnswer")
      : ensureChoiceMinimum(
          nextAnswers.filter((answer) => answer.kind === "answer"),
          uid,
        );

  if (targetType === "single") {
    const firstCorrect = answers.findIndex(
      (answer) => answer.kind === "answer" && answer.isCorrect,
    );
    answers = answers.map((answer, index) =>
      answer.kind === "answer"
        ? { ...answer, isCorrect: index === (firstCorrect >= 0 ? firstCorrect : 0) }
        : answer,
    );
  }

  if (targetType === "text" && answers.length === 0) {
    answers = partsToAnswerNodes(cleanedParts, "text", uid);
  }

  return {
    ...question,
    type: targetType,
    answers,
  };
}
