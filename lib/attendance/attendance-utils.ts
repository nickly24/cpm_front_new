import type { ClassDay } from "./attendance-types";

export const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

export const MONTH_NAMES_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

export const WEEKDAY_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
export const WEEKDAY_FULL = [
  "Воскресенье",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
];

export function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getMonthRange(year: number, month: number) {
  const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const dateTo = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { dateFrom, dateTo };
}

export function formatClassDayLabel(day: Pick<ClassDay, "date" | "comment">): string {
  if (!day.date) return "";
  const date = new Date(`${day.date}T12:00:00`);
  const dayNum = date.getDate();
  const month = MONTH_NAMES[date.getMonth()];
  const weekday = WEEKDAY_SHORT[date.getDay()];
  const base = `${dayNum} ${month} (${weekday})`;
  return day.comment ? `${base} — ${day.comment}` : base;
}

export function formatClassDayLong(day: Pick<ClassDay, "date" | "comment">): string {
  if (!day.date) return "";
  const date = new Date(`${day.date}T12:00:00`);
  const dayNum = date.getDate();
  const month = MONTH_NAMES_GENITIVE[date.getMonth()];
  const weekday = WEEKDAY_FULL[date.getDay()];
  const base = `${dayNum} ${month}, ${weekday}`;
  return day.comment ? `${base} · ${day.comment}` : base;
}

export function formatCardDate(dateStr: string) {
  const date = new Date(`${dateStr}T12:00:00`);
  return {
    dayMonth: `${date.getDate()} ${MONTH_NAMES_GENITIVE[date.getMonth()]}`,
    weekday: WEEKDAY_FULL[date.getDay()],
  };
}

export function normalizeScannedStudentId(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.replace(/^0+/, "") || trimmed;
}

export function yearOptions(center = new Date().getFullYear(), span = 3): number[] {
  return Array.from({ length: span * 2 + 1 }, (_, index) => center - span + index);
}
