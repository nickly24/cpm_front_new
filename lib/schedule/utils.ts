import { SCHEDULE_DEFAULT_COLOR } from "./constants";
import type { CalendarViewMode, ScheduleLesson, ScheduleLessonFormData } from "./types";

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

export interface LessonLayoutItem {
  lesson: ScheduleLesson;
  start: number;
  end: number;
  column: number;
  columnCount: number;
}

/**
 * Раскладка пересекающихся занятий в колонки (как Apple Calendar).
 * Возвращает column / columnCount для left/width в %.
 */
export function layoutOverlappingLessons(
  lessons: ScheduleLesson[],
): LessonLayoutItem[] {
  const timed = lessons
    .map((lesson) => {
      const start = toMinutes(lesson.start_time);
      const end = toMinutes(lesson.end_time);
      if (start == null || end == null || end <= start) return null;
      return { lesson, start, end };
    })
    .filter((item): item is { lesson: ScheduleLesson; start: number; end: number } =>
      Boolean(item),
    )
    .sort((a, b) => a.start - b.start || a.end - b.end);

  if (!timed.length) return [];

  const placed: Array<{
    lesson: ScheduleLesson;
    start: number;
    end: number;
    column: number;
  }> = [];

  for (const item of timed) {
    const used = new Set<number>();
    for (const other of placed) {
      if (other.start < item.end && other.end > item.start) {
        used.add(other.column);
      }
    }
    let column = 0;
    while (used.has(column)) column += 1;
    placed.push({ ...item, column });
  }

  // Для каждого занятия columnCount = макс. колонок среди всех, с которыми оно пересекается (кластер)
  return placed.map((item) => {
    const cluster = placed.filter(
      (other) => other.start < item.end && other.end > item.start,
    );
    // Расширяем кластер транзитивно
    const clusterIds = new Set(cluster.map((entry) => entry.lesson._id));
    let grew = true;
    while (grew) {
      grew = false;
      for (const candidate of placed) {
        if (clusterIds.has(candidate.lesson._id)) continue;
        const overlapsCluster = placed.some(
          (member) =>
            clusterIds.has(member.lesson._id) &&
            member.start < candidate.end &&
            member.end > candidate.start,
        );
        if (overlapsCluster) {
          clusterIds.add(candidate.lesson._id);
          grew = true;
        }
      }
    }
    const clusterMembers = placed.filter((entry) =>
      clusterIds.has(entry.lesson._id),
    );
    const columnCount = Math.max(
      1,
      ...clusterMembers.map((entry) => entry.column + 1),
    );
    return {
      lesson: item.lesson,
      start: item.start,
      end: item.end,
      column: item.column,
      columnCount,
    };
  });
}

export function lessonLayoutStyle(
  item: LessonLayoutItem,
  startMinute: number,
  totalMinutes: number,
  options?: { minHeightPercent?: number; gapPercent?: number },
): { top: string; height: string; left: string; width: string } {
  const minHeight = options?.minHeightPercent ?? 3.5;
  const gap = options?.gapPercent ?? 0.6;
  const top = ((item.start - startMinute) / totalMinutes) * 100;
  const height = ((item.end - item.start) / totalMinutes) * 100;
  const colWidth = 100 / item.columnCount;
  const left = item.column * colWidth + gap / 2;
  const width = colWidth - gap;

  return {
    top: `${top}%`,
    height: `${Math.max(height, minHeight)}%`,
    left: `${left}%`,
    width: `${Math.max(width, 8)}%`,
  };
}

export function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Local calendar date as YYYY-MM-DD */
export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateISO(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function todayISO(): string {
  return formatDateISO(new Date());
}

export function addDaysISO(dateISO: string, days: number): string {
  const date = parseDateISO(dateISO);
  date.setDate(date.getDate() + days);
  return formatDateISO(date);
}

/** Monday of the week containing dateISO (ISO week, Mon–Sun). */
export function startOfWeekISO(dateISO: string): string {
  const date = parseDateISO(dateISO);
  const day = date.getDay(); // 0 Sun … 6 Sat
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return formatDateISO(date);
}

export function endOfWeekISO(dateISO: string): string {
  return addDaysISO(startOfWeekISO(dateISO), 6);
}

export function startOfMonthISO(dateISO: string): string {
  const date = parseDateISO(dateISO);
  date.setDate(1);
  return formatDateISO(date);
}

export function endOfMonthISO(dateISO: string): string {
  const date = parseDateISO(dateISO);
  date.setMonth(date.getMonth() + 1, 0);
  return formatDateISO(date);
}

/** Month grid: Mon-start weeks covering the month. */
export function getMonthGridDates(dateISO: string): string[] {
  const monthStart = startOfMonthISO(dateISO);
  const gridStart = startOfWeekISO(monthStart);
  const monthEnd = endOfMonthISO(dateISO);
  const gridEnd = endOfWeekISO(monthEnd);
  const dates: string[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    dates.push(cursor);
    cursor = addDaysISO(cursor, 1);
  }
  return dates;
}

export function getFetchRange(
  selectedDate: string,
  view: CalendarViewMode,
): { dateFrom: string; dateTo: string } {
  if (view === "day") {
    return { dateFrom: selectedDate, dateTo: selectedDate };
  }
  if (view === "week") {
    return {
      dateFrom: startOfWeekISO(selectedDate),
      dateTo: endOfWeekISO(selectedDate),
    };
  }
  const grid = getMonthGridDates(selectedDate);
  return { dateFrom: grid[0], dateTo: grid[grid.length - 1] };
}

export function shiftSelectedDate(
  selectedDate: string,
  view: CalendarViewMode,
  direction: -1 | 1,
): string {
  if (view === "day") {
    return addDaysISO(selectedDate, direction);
  }
  if (view === "week") {
    return addDaysISO(selectedDate, direction * 7);
  }
  const date = parseDateISO(selectedDate);
  date.setMonth(date.getMonth() + direction);
  return formatDateISO(date);
}

export function formatDayHeading(dateISO: string): string {
  const date = parseDateISO(dateISO);
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatMonthHeading(dateISO: string): string {
  const date = parseDateISO(dateISO);
  const raw = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatWeekdayShort(dateISO: string): string {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(
    parseDateISO(dateISO),
  );
}

export function groupScheduleByDate(
  schedule: ScheduleLesson[],
): Record<string, ScheduleLesson[]> {
  const grouped: Record<string, ScheduleLesson[]> = {};

  for (const lesson of schedule) {
    const key = lesson.date;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(lesson);
  }

  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) =>
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

  const fallbackStart = 8 * 60;
  const fallbackEnd = 18 * 60;

  if (!allStarts.length || !allEnds.length) {
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

export function getNowLinePercent(
  startMinute: number,
  totalMinutes: number,
  forDateISO: string,
): number | null {
  if (forDateISO !== todayISO()) {
    return null;
  }
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < startMinute || minutes > startMinute + totalMinutes) {
    return null;
  }
  return ((minutes - startMinute) / totalMinutes) * 100;
}

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return `rgba(91, 141, 239, ${alpha})`;
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Soft tint mixed onto white — fully opaque (no grid bleed-through). */
export function hexTintOpaque(hex: string, amount = 0.18): string {
  const normalized = hex.replace("#", "");
  const fallback = [91, 141, 239];
  const rgb =
    normalized.length === 6
      ? [
          Number.parseInt(normalized.slice(0, 2), 16),
          Number.parseInt(normalized.slice(2, 4), 16),
          Number.parseInt(normalized.slice(4, 6), 16),
        ]
      : fallback;
  const mix = (c: number) => Math.round(255 * (1 - amount) + c * amount);
  return `rgb(${mix(rgb[0])}, ${mix(rgb[1])}, ${mix(rgb[2])})`;
}

export function createEmptyLessonForm(
  date: string = todayISO(),
): ScheduleLessonFormData {
  return {
    date,
    start_time: "09:00",
    end_time: "10:30",
    lesson_name: "",
    teacher_name: "",
    location: "",
    classroom: "",
    color: SCHEDULE_DEFAULT_COLOR,
    is_changed: false,
    is_in_person: true,
    is_for_all: true,
    is_public: true,
    school_id: null,
  };
}

export function lessonToFormData(lesson: ScheduleLesson): ScheduleLessonFormData {
  return {
    date: lesson.date,
    start_time: lesson.start_time,
    end_time: lesson.end_time,
    lesson_name: lesson.lesson_name,
    teacher_name: lesson.teacher_name,
    location: lesson.location,
    classroom: lesson.classroom,
    color: lesson.color || SCHEDULE_DEFAULT_COLOR,
    is_changed: Boolean(lesson.is_changed),
    is_in_person: lesson.is_in_person !== false,
    is_for_all: lesson.is_for_all !== false,
    is_public: lesson.is_public !== false,
    school_id: lesson.school_id ?? null,
  };
}

export function daysAround(centerISO: string, before = 14, after = 14): string[] {
  const days: string[] = [];
  for (let offset = -before; offset <= after; offset += 1) {
    days.push(addDaysISO(centerISO, offset));
  }
  return days;
}
