import type { SubmissionState } from "@/lib/homework-files/types";

export const submissionLabels: Record<SubmissionState, string> = {
  none: "Нет файла", uploading: "Загружается", processing: "Обрабатывается",
  draft: "Черновик", submitted: "В очереди", in_review: "На проверке",
  revision_requested: "На доработке", graded: "Проверено",
};

/** Reject malformed or fractional input before JSON can turn NaN into null. */
export function parseHomeworkScore(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const score = Number(trimmed);
  return score >= 0 && score <= 100 ? score : null;
}

export function homeworkDate(value?: string | null, time = true): string {
  if (!value) return "Не указана";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Не указана";
  return date.toLocaleString("ru-RU", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Moscow",
    ...(time ? { hour: "2-digit", minute: "2-digit" } as const : {}),
  });
}

export function homeworkFileSize(bytes?: number | null): string {
  if (bytes == null) return "PDF";
  return bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} КБ` : `${(bytes / 1048576).toFixed(1)} МБ`;
}

export function staffError(reason: unknown, fallback = "Не удалось выполнить действие. Попробуйте ещё раз."): string {
  return reason instanceof Error ? reason.message : fallback;
}

export interface StaffHomeworkIdentity {
  id: number;
  homework_id: number;
  student_id: number;
  student_name: string;
  homework_name: string;
  group_name: string | null;
}
