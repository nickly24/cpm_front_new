import { getAttendancePalette } from "@/lib/attendance/attendance-palette";
import type {
  AttendanceReportEntry,
  AttendanceReportStudent,
  CellMapKey,
  ReportSortDir,
  ReportSortKey,
} from "./attendance-report-types";
import { matchesReportGroupFilter } from "@/lib/reports/report-group-filter";

const PALETTE_CLASS: Record<
  ReturnType<typeof getAttendancePalette>,
  string
> = {
  present: "palettePresent",
  excused: "paletteExcused",
  remoteA: "paletteRemoteA",
  remoteB: "paletteRemoteB",
  remoteC: "paletteRemoteC",
  late: "paletteLate",
  joined: "paletteJoined",
  hybrid: "paletteHybrid",
};

export function cellToneClass(typeCode: string | undefined): string {
  if (!typeCode) return "cellEmpty";
  return PALETTE_CLASS[getAttendancePalette(typeCode)];
}

export function cellMapKey(
  studentId: number,
  classDayId: number,
): CellMapKey {
  return `${studentId}:${classDayId}`;
}

export function buildCellMap(
  entries: AttendanceReportEntry[],
): Map<CellMapKey, AttendanceReportEntry> {
  const map = new Map<CellMapKey, AttendanceReportEntry>();
  for (const entry of entries) {
    map.set(cellMapKey(entry.student_id, entry.class_day_id), entry);
  }
  return map;
}

function compareStrings(
  left: string | null | undefined,
  right: string | null | undefined,
  dir: ReportSortDir,
): number {
  const a = (left ?? "").toLocaleLowerCase("ru");
  const b = (right ?? "").toLocaleLowerCase("ru");
  const cmp = a.localeCompare(b, "ru");
  return dir === "asc" ? cmp : -cmp;
}

function compareNumbers(
  left: number | null | undefined,
  right: number | null | undefined,
  dir: ReportSortDir,
): number {
  const a = left ?? -1;
  const b = right ?? -1;
  const cmp = a - b;
  return dir === "asc" ? cmp : -cmp;
}

export function sortReportStudents(
  students: AttendanceReportStudent[],
  key: ReportSortKey,
  dir: ReportSortDir,
): AttendanceReportStudent[] {
  const list = [...students];
  list.sort((left, right) => {
    if (key === "group") {
      return compareStrings(left.group_name, right.group_name, dir);
    }
    if (key === "class") {
      return compareNumbers(left.class, right.class, dir);
    }
    if (key === "school") {
      return compareStrings(
        left.school_short_name,
        right.school_short_name,
        dir,
      );
    }
    return compareStrings(left.full_name, right.full_name, dir);
  });
  return list;
}

/** Поиск по ФИО: все слова запроса должны встречаться в имени (порядок не важен). */
export function matchesReportFioSearch(
  fullName: string | null | undefined,
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const haystack = (fullName ?? "").toLowerCase();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return tokens.every((token) => haystack.includes(token));
}

export function filterReportStudents(
  students: AttendanceReportStudent[],
  searchFio: string,
  classFilter: string,
  schoolFilter: string,
  groupFilter: string,
): AttendanceReportStudent[] {
  return students.filter((student) => {
    if (!matchesReportFioSearch(student.full_name, searchFio)) {
      return false;
    }
    if (classFilter !== "all" && String(student.class ?? "") !== classFilter) {
      return false;
    }
    if (
      schoolFilter !== "all" &&
      String(student.school_id ?? "") !== schoolFilter
    ) {
      return false;
    }
    if (!matchesReportGroupFilter(student, groupFilter)) {
      return false;
    }
    return true;
  });
}

export function uniqueFilterOptions(students: AttendanceReportStudent[]) {
  const classes = new Map<string, string>();
  const schools = new Map<string, string>();
  const groups = new Map<string, string>();

  for (const student of students) {
    if (student.class != null) {
      const key = String(student.class);
      classes.set(key, String(student.class));
    }
    if (student.school_id != null && student.school_short_name) {
      const key = String(student.school_id);
      schools.set(key, student.school_short_name);
    }
    if (student.group_id != null && student.group_name) {
      const key = String(student.group_id);
      groups.set(key, student.group_name);
    }
  }

  return {
    classes: [...classes.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => Number(a.value) - Number(b.value)),
    schools: [...schools.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru")),
    groups: [...groups.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru")),
  };
}
