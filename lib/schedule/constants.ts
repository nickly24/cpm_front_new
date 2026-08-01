export const SCHEDULE_DEFAULT_COLOR = "#5B8DEF";

export const SCHEDULE_PRESET_COLORS = [
  "#5B8DEF",
  "#E85D75",
  "#34C759",
  "#AF52DE",
  "#FF9F0A",
  "#64D2FF",
  "#FF6B6B",
  "#8E8E93",
] as const;

/** Короткие подписи дней (пн=0 … вс=6, ISO week). */
export const WEEKDAY_SHORT_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

export const WEEKDAY_FULL_RU = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
] as const;
