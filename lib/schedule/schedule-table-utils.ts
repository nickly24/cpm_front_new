import { SCHEDULE_DEFAULT_COLOR } from "@/lib/schedule/constants";
import type {
  ScheduleBulkRequest,
  ScheduleLesson,
  ScheduleLessonFormData,
} from "@/lib/schedule/types";
import { addDaysISO, startOfWeekISO } from "@/lib/schedule/utils";

export interface ScheduleTableRow {
  /** Stable client key for React */
  key: string;
  /** Existing lesson id, or null for new draft rows */
  lessonId: string | null;
  date: string;
  start_time: string;
  end_time: string;
  lesson_name: string;
  teacher_name: string;
  location: string;
  classroom: string;
  color: string;
  is_changed: boolean;
}

function newClientKey(): string {
  return `row_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function emptyTableRow(date: string): ScheduleTableRow {
  return {
    key: newClientKey(),
    lessonId: null,
    date,
    start_time: "",
    end_time: "",
    lesson_name: "",
    teacher_name: "",
    location: "",
    classroom: "",
    color: SCHEDULE_DEFAULT_COLOR,
    is_changed: false,
  };
}

export function lessonToTableRow(lesson: ScheduleLesson): ScheduleTableRow {
  return {
    key: `existing_${lesson._id}`,
    lessonId: lesson._id,
    date: lesson.date,
    start_time: lesson.start_time,
    end_time: lesson.end_time,
    lesson_name: lesson.lesson_name,
    teacher_name: lesson.teacher_name,
    location: lesson.location,
    classroom: lesson.classroom,
    color: lesson.color || SCHEDULE_DEFAULT_COLOR,
    is_changed: Boolean(lesson.is_changed),
  };
}

export function weekDatesFrom(selectedDate: string): string[] {
  const start = startOfWeekISO(selectedDate);
  return Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
}

export function buildInitialTableRows(
  lessons: ScheduleLesson[],
  weekDates: string[],
  emptyPerDay = 1,
): ScheduleTableRow[] {
  const byDate = new Map<string, ScheduleTableRow[]>();
  for (const date of weekDates) {
    byDate.set(date, []);
  }

  const sorted = [...lessons].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.start_time || "").localeCompare(b.start_time || ""),
  );

  for (const lesson of sorted) {
    const list = byDate.get(lesson.date);
    if (list) {
      list.push(lessonToTableRow(lesson));
    }
  }

  const rows: ScheduleTableRow[] = [];
  for (const date of weekDates) {
    const dayRows = byDate.get(date) ?? [];
    rows.push(...dayRows);
    for (let i = 0; i < emptyPerDay; i += 1) {
      rows.push(emptyTableRow(date));
    }
  }
  return rows;
}

export function isRowBlank(row: ScheduleTableRow): boolean {
  return (
    !row.start_time.trim() &&
    !row.end_time.trim() &&
    !row.lesson_name.trim() &&
    !row.teacher_name.trim() &&
    !row.location.trim() &&
    !row.classroom.trim() &&
    !row.is_changed
  );
}

export function isRowFilledEnough(row: ScheduleTableRow): boolean {
  return Boolean(
    row.start_time.trim() &&
      row.end_time.trim() &&
      row.lesson_name.trim() &&
      row.teacher_name.trim() &&
      row.location.trim() &&
      row.classroom.trim(),
  );
}

function rowPayload(
  row: ScheduleTableRow,
  isPublic: boolean,
  schoolId: number | null,
): ScheduleLessonFormData {
  return {
    date: row.date,
    start_time: row.start_time.trim(),
    end_time: row.end_time.trim(),
    lesson_name: row.lesson_name.trim(),
    teacher_name: row.teacher_name.trim(),
    location: row.location.trim(),
    classroom: row.classroom.trim(),
    color: (row.color || SCHEDULE_DEFAULT_COLOR).toUpperCase(),
    is_changed: Boolean(row.is_changed),
    is_public: isPublic,
    school_id: isPublic ? null : schoolId,
  };
}

function snapshotMap(rows: ScheduleTableRow[]): Map<string, ScheduleTableRow> {
  const map = new Map<string, ScheduleTableRow>();
  for (const row of rows) {
    if (row.lessonId) {
      map.set(row.lessonId, row);
    }
  }
  return map;
}

function rowsEqual(a: ScheduleTableRow, b: ScheduleTableRow): boolean {
  return (
    a.date === b.date &&
    a.start_time === b.start_time &&
    a.end_time === b.end_time &&
    a.lesson_name === b.lesson_name &&
    a.teacher_name === b.teacher_name &&
    a.location === b.location &&
    a.classroom === b.classroom &&
    a.color.toUpperCase() === b.color.toUpperCase() &&
    Boolean(a.is_changed) === Boolean(b.is_changed)
  );
}

export function buildBulkDiff(
  snapshot: ScheduleTableRow[],
  current: ScheduleTableRow[],
  isPublic: boolean,
  schoolId: number | null,
): { request: ScheduleBulkRequest; incompleteKeys: string[] } | { error: string } {
  const snap = snapshotMap(snapshot);
  const currentIds = new Set(
    current.filter((r) => r.lessonId).map((r) => r.lessonId as string),
  );

  const deletes: string[] = [];
  for (const id of snap.keys()) {
    if (!currentIds.has(id)) {
      deletes.push(id);
    }
  }

  const creates: ScheduleLessonFormData[] = [];
  const updates: Array<ScheduleLessonFormData & { _id: string }> = [];
  const incompleteKeys: string[] = [];

  for (const row of current) {
    if (isRowBlank(row)) continue;
    if (!isRowFilledEnough(row)) {
      incompleteKeys.push(row.key);
      continue;
    }
    if (!row.lessonId) {
      creates.push(rowPayload(row, isPublic, schoolId));
      continue;
    }
    const original = snap.get(row.lessonId);
    if (!original || !rowsEqual(original, row)) {
      updates.push({
        _id: row.lessonId,
        ...rowPayload(row, isPublic, schoolId),
      });
    }
  }

  if (incompleteKeys.length) {
    return {
      error:
        "Заполните все поля в начатых строках (время, предмет, преподаватель, локация, аудитория) или очистите их",
    };
  }

  if (!creates.length && !updates.length && !deletes.length) {
    return { error: "Нет изменений для сохранения" };
  }

  return {
    request: { creates, updates, deletes },
    incompleteKeys,
  };
}

export function isTableDirty(
  snapshot: ScheduleTableRow[],
  current: ScheduleTableRow[],
): boolean {
  const result = buildBulkDiff(snapshot, current, true, null);
  if ("error" in result) {
    // incomplete rows or "no changes" — still dirty if incomplete or structural delete
    const snap = snapshotMap(snapshot);
    const currentIds = new Set(
      current.filter((r) => r.lessonId).map((r) => r.lessonId as string),
    );
    for (const id of snap.keys()) {
      if (!currentIds.has(id)) return true;
    }
    for (const row of current) {
      if (!isRowBlank(row) && !row.lessonId) return true;
      if (row.lessonId) {
        const original = snap.get(row.lessonId);
        if (original && !rowsEqual(original, row)) return true;
        if (!original) return true;
      }
      if (!isRowBlank(row) && !isRowFilledEnough(row)) return true;
    }
    return false;
  }
  const { creates, updates, deletes } = result.request;
  return creates.length > 0 || updates.length > 0 || deletes.length > 0;
}

export function formatWeekRangeLabel(weekStart: string, weekEnd: string): string {
  const from = new Date(`${weekStart}T12:00:00`);
  const to = new Date(`${weekEnd}T12:00:00`);
  const fmt = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  });
  return `${fmt.format(from)} — ${fmt.format(to)}`;
}

export function formatDayBandLabel(dateISO: string): string {
  const date = new Date(`${dateISO}T12:00:00`);
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}
