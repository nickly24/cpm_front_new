import {
  SCHEDULE_DAYS,
  SCHEDULE_TONE_COUNT,
  type ScheduleDay,
} from "./constants";
import type { ScheduleLesson } from "./types";

export function toMinutes(timeStr: string | undefined): number | null {
  if (!timeStr || !timeStr.includes(":")) {
    return null;
  }

  const [h, m] = timeStr.split(":").map(Number);

  if (Number.isNaN(h) || Number.isNaN(m)) {
    return null;
  }

  return h * 60 + m;
}

export function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function getTodayDayName(): ScheduleDay {
  const raw = new Intl.DateTimeFormat("ru-RU", { weekday: "long" }).format(
    new Date(),
  );
  const normalized = raw.charAt(0).toUpperCase() + raw.slice(1);

  if (SCHEDULE_DAYS.includes(normalized as ScheduleDay)) {
    return normalized as ScheduleDay;
  }

  return "Понедельник";
}

export function groupScheduleByDay(
  schedule: ScheduleLesson[],
): Record<string, ScheduleLesson[]> {
  const grouped: Record<string, ScheduleLesson[]> = {};

  for (const lesson of schedule) {
    const day = lesson.day_of_week;
    if (!grouped[day]) {
      grouped[day] = [];
    }
    grouped[day].push(lesson);
  }

  for (const day of Object.keys(grouped)) {
    grouped[day].sort((a, b) =>
      (a.start_time || "").localeCompare(b.start_time || ""),
    );
  }

  return grouped;
}

export function getTimelineBounds(schedule: ScheduleLesson[]) {
  const allStarts = schedule
    .map((lesson) => toMinutes(lesson.start_time))
    .filter((value): value is number => value != null);
  const allEnds = schedule
    .map((lesson) => toMinutes(lesson.end_time))
    .filter((value): value is number => value != null);

  if (!allStarts.length || !allEnds.length) {
    const fallbackStart = 8 * 60;
    const fallbackEnd = 18 * 60;
    const hourMarks: number[] = [];

    for (let minute = fallbackStart; minute <= fallbackEnd; minute += 60) {
      hourMarks.push(minute);
    }

    return {
      startMinute: fallbackStart,
      endMinute: fallbackEnd,
      hourMarks,
      totalMinutes: fallbackEnd - fallbackStart,
    };
  }

  const minStart = Math.min(...allStarts);
  const maxEnd = Math.max(...allEnds);
  const paddedStart = Math.max(0, Math.floor((minStart - 30) / 60) * 60);
  const paddedEnd = Math.min(24 * 60, Math.ceil((maxEnd + 30) / 60) * 60);
  const hourMarks: number[] = [];

  for (let minute = paddedStart; minute <= paddedEnd; minute += 60) {
    hourMarks.push(minute);
  }

  return {
    startMinute: paddedStart,
    endMinute: paddedEnd,
    hourMarks,
    totalMinutes: Math.max(60, paddedEnd - paddedStart),
  };
}

export function createEmptyLessonForm(
  day: ScheduleDay = getTodayDayName(),
): import("./types").ScheduleLessonFormData {
  return {
    day_of_week: day,
    start_time: "09:00",
    end_time: "10:30",
    lesson_name: "",
    teacher_name: "",
    location: "",
  };
}

export function lessonToFormData(
  lesson: ScheduleLesson,
): import("./types").ScheduleLessonFormData {
  return {
    day_of_week: (SCHEDULE_DAYS.includes(lesson.day_of_week as ScheduleDay)
      ? lesson.day_of_week
      : "Понедельник") as ScheduleDay,
    start_time: lesson.start_time,
    end_time: lesson.end_time,
    lesson_name: lesson.lesson_name,
    teacher_name: lesson.teacher_name,
    location: lesson.location,
  };
}

/** Стабильный индекс тона 0…6 по названию предмета. */
export function getLessonToneIndex(lessonName: string): number {
  const normalized = lessonName.trim().toLowerCase();
  let hash = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }

  return hash % SCHEDULE_TONE_COUNT;
}
