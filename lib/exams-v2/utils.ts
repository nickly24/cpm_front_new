import type { AttemptState, Grade, Threshold } from "./types";

export const GRADES: readonly Grade[] = [0, 1, 2, 3, 4, 5];
export const typeLabel = (type: string) =>
  type === "classic" ? "Классический экзамен" : "Экзамен вне системы LMS";
export const statusLabel = (status: string) =>
  ({
    not_started: "Не начат",
    pending_ready: "Сбор комиссии",
    in_progress: "Идёт экзамен",
    completed: "Завершён",
    open: "Ожидается оценка",
    consensus: "Согласован",
    replaced: "Заменён",
    disputed: "Расхождение",
    voided: "Отменён",
  })[status] ?? status;
export function formatScore(value: number | null | undefined): string {
  return value == null
    ? "—"
    : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(
        value,
      );
}
export function formatDate(value: string | null | undefined): string {
  if (!value) return "Не указано";
  const date = new Date(
    value.length === 10 ? `${value}T12:00:00+03:00` : value,
  );
  if (!Number.isFinite(date.getTime())) return "Не указано";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    ...(value.length > 10 ? { timeStyle: "short" as const } : {}),
    timeZone: "Europe/Moscow",
  }).format(date);
}
/** datetime-local deliberately represents Moscow, not the browser's local timezone. */
export function toMoscowInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() + 3 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}
export function fromMoscowInput(value: string): string | null {
  return value ? `${value}:00+03:00` : null;
}
export function thresholdError(
  thresholds: Threshold[],
  maxScore: number,
): string | null {
  if (maxScore < 5)
    return "Максимум должен быть не меньше 5: нужны шесть оценок от 0 до 5.";
  if (
    thresholds.length !== 6 ||
    thresholds.some(
      (t, i) =>
        t.grade !== i ||
        !Number.isInteger(t.minScore) ||
        t.minScore < 0 ||
        t.minScore > maxScore ||
        (i > 0 && t.minScore <= thresholds[i - 1].minScore),
    ) ||
    thresholds[0].minScore !== 0
  )
    return "Пороги — целые числа, строго возрастающие от 0 до максимума экзамена.";
  return null;
}
export function acceptAttempt(
  current: AttemptState | null,
  incoming: AttemptState,
  attemptId: number,
): boolean {
  return (
    incoming.id === attemptId &&
    (!current ||
      current.id !== attemptId ||
      incoming.stateVersion >= current.stateVersion)
  );
}
export function voteBody(
  presentedQuestionId: number,
  roundId: number,
  value: 0 | 0.5 | 1,
) {
  return { presentedQuestionId, roundId, value };
}
export function selectionBody(
  presentedQuestionId: number,
  expectedStateVersion: number,
) {
  return { presentedQuestionId, expectedStateVersion };
}
