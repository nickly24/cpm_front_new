export const SCHEDULE_DAYS = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
] as const;

export type ScheduleDay = (typeof SCHEDULE_DAYS)[number];

export const SCHEDULE_DAY_SHORT: Record<ScheduleDay, string> = {
  Понедельник: "Пн",
  Вторник: "Вт",
  Среда: "Ср",
  Четверг: "Чт",
  Пятница: "Пт",
  Суббота: "Сб",
  Воскресенье: "Вс",
};

/** Количество цветовых вариантов карточек занятий. */
export const SCHEDULE_TONE_COUNT = 7;
