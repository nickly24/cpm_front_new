import type {
  AdminTestChangeCommit,
  AdminTestChangeEventType,
  AdminTestChangeLogItem,
} from "@/lib/admin/admin-tests-types";

const EVENT_LABELS: Record<AdminTestChangeEventType, string> = {
  question_added: "Вопрос добавлен",
  question_removed: "Вопрос удалён",
  question_updated: "Вопрос изменён",
  question_reordered: "Вопрос переставлен",
  metadata_updated: "Настройки теста",
};

const FIELD_LABELS: Record<string, string> = {
  type: "тип",
  text: "текст",
  points: "баллы",
  title: "название",
  direction: "направление",
  startDate: "дата начала",
  endDate: "дата окончания",
  timeLimitMinutes: "лимит времени",
  published: "видимость для студентов",
  visible: "показ ответов",
};

function trimText(value: unknown, max = 72): string {
  const text = String(value ?? "").trim();
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function getChangeEventLabel(eventType: AdminTestChangeEventType): string {
  return EVENT_LABELS[eventType] ?? eventType;
}

export function formatChangeTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function summarizeChangeEvent(item: AdminTestChangeLogItem): string {
  const diff = item.diff ?? {};
  const parts: string[] = [];

  const fieldChanges = diff.fieldChanges as
    | Record<string, { before?: unknown; after?: unknown }>
    | undefined;
  if (fieldChanges) {
    for (const key of Object.keys(fieldChanges)) {
      const label = FIELD_LABELS[key] ?? key;
      const change = fieldChanges[key];
      parts.push(`${label}: «${trimText(change.before, 40)}» → «${trimText(change.after, 40)}»`);
    }
  }

  const answers = diff.answers as
    | { added?: unknown[]; removed?: unknown[]; updated?: unknown[] }
    | undefined;
  if (answers) {
    if (answers.added?.length) parts.push(`добавлено ответов: ${answers.added.length}`);
    if (answers.removed?.length) parts.push(`удалено ответов: ${answers.removed.length}`);
    if (answers.updated?.length) parts.push(`изменено ответов: ${answers.updated.length}`);
  }

  const correctAnswers = diff.correctAnswers as
    | { added?: string[]; removed?: string[] }
    | undefined;
  if (correctAnswers) {
    if (correctAnswers.added?.length) {
      parts.push(`добавлены текстовые ответы: ${correctAnswers.added.length}`);
    }
    if (correctAnswers.removed?.length) {
      parts.push(`удалены текстовые ответы: ${correctAnswers.removed.length}`);
    }
  }

  if (diff.added === true) {
    parts.push(`добавлен вопрос №${item.questionId ?? "?"}`);
  }
  if (diff.removed === true) {
    parts.push(`удалён вопрос №${item.questionId ?? "?"}`);
  }
  if (diff.fromQuestionId != null && diff.toQuestionId != null) {
    parts.push(`перестановка №${diff.fromQuestionId} → №${diff.toQuestionId}`);
  }

  if (parts.length > 0) return parts.join("; ");

  const after = item.after as { text?: string } | null;
  const before = item.before as { text?: string } | null;
  if (after?.text && before?.text && after.text !== before.text) {
    return `текст: «${trimText(before.text, 40)}» → «${trimText(after.text, 40)}»`;
  }
  if (after?.text) return trimText(after.text);
  if (before?.text) return trimText(before.text);

  return getChangeEventLabel(item.eventType);
}

export function groupChangesIntoCommits(items: AdminTestChangeLogItem[]): AdminTestChangeCommit[] {
  const commits: AdminTestChangeCommit[] = [];

  for (const item of items) {
    const actorName = item.actor?.fullName?.trim() || "Администратор";
    const commitKey = `${item.changedAt}|${item.actor?.userId ?? "unknown"}|${item.context?.source ?? ""}`;
    const last = commits[commits.length - 1];

    if (last && last.id === commitKey) {
      last.events.push(item);
      continue;
    }

    commits.push({
      id: commitKey,
      changedAt: item.changedAt,
      actorName,
      source: item.context?.source,
      events: [item],
    });
  }

  return commits;
}

export function canvasQuestionIdFromNumber(questionId: number): string {
  return `q_${questionId}`;
}
