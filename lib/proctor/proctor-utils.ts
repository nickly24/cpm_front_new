export type DeadlineTone = "muted" | "ok" | "soon" | "urgent" | "overdue";

export function formatDateForInput(dateValue: string | null | undefined): string {
  if (!dateValue) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
    return dateValue.split("T")[0] ?? "";
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatProctorDate(
  value: string | null | undefined,
  fallback = "Не указан",
): string {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleDateString("ru-RU");
}

export function getDeadlineTone(deadline: string | null | undefined): DeadlineTone {
  if (!deadline) {
    return "muted";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime())) {
    return "muted";
  }
  deadlineDate.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil(
    (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) {
    return "overdue";
  }
  if (diffDays <= 2) {
    return "urgent";
  }
  if (diffDays <= 7) {
    return "soon";
  }
  return "ok";
}

export function getProctorDeadlineLabel(deadline: string | null | undefined): string {
  if (!deadline) {
    return "Дедлайн не указан";
  }
  return formatProctorDate(deadline);
}
