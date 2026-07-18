import type {
  RatingsReportSortDir,
  RatingsReportSortKey,
  RatingsReportStudent,
  RatingsReportValue,
} from "@/lib/admin/ratings-report-types";
import { matchesReportGroupFilter } from "@/lib/reports/report-group-filter";

export function valueMapKey(studentId: number, columnKey: string): string {
  return `${studentId}:${columnKey}`;
}

export function buildValueMap(values: RatingsReportValue[]): Map<string, RatingsReportValue> {
  const map = new Map<string, RatingsReportValue>();
  for (const item of values) {
    map.set(valueMapKey(item.student_id, item.column_key), item);
  }
  return map;
}

export function uniqueFilterOptions(students: RatingsReportStudent[]) {
  const classes = new Map<string, string>();
  const schools = new Map<string, string>();
  const groups = new Map<string, string>();

  for (const student of students) {
    if (student.class != null && student.class !== "") {
      const value = String(student.class);
      classes.set(value, value);
    }
    const schoolLabel = student.school_short_name || student.school_name;
    if (schoolLabel) {
      const value = String(student.school_id ?? schoolLabel);
      schools.set(value, schoolLabel);
    }
    if (student.group_name) {
      const value = String(student.group_id ?? student.group_name);
      groups.set(value, student.group_name);
    }
  }

  const toOptions = (entries: Map<string, string>) =>
    [...entries.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));

  return {
    classes: toOptions(classes),
    schools: toOptions(schools),
    groups: toOptions(groups),
  };
}

export function filterReportStudents(
  students: RatingsReportStudent[],
  {
    searchFio,
    classFilter,
    schoolFilter,
    groupFilter,
  }: {
    searchFio: string;
    classFilter: string;
    schoolFilter: string;
    groupFilter: string;
  },
): RatingsReportStudent[] {
  const query = searchFio.trim().toLowerCase();
  return students.filter((student) => {
    if (classFilter !== "all" && String(student.class ?? "") !== classFilter) {
      return false;
    }
    if (
      schoolFilter !== "all" &&
      String(student.school_id ?? student.school_short_name ?? student.school_name ?? "") !== schoolFilter
    ) {
      return false;
    }
    if (!matchesReportGroupFilter(student, groupFilter)) {
      return false;
    }
    if (!query) {
      return true;
    }
    return (
      student.full_name.toLowerCase().includes(query) ||
      String(student.student_id).includes(query) ||
      (student.group_name ?? "").toLowerCase().includes(query)
    );
  });
}

export function sortReportStudents(
  students: RatingsReportStudent[],
  sortKey: RatingsReportSortKey,
  sortDir: RatingsReportSortDir,
): RatingsReportStudent[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...students].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "fio") {
      cmp = a.full_name.localeCompare(b.full_name, "ru");
    } else if (sortKey === "class") {
      cmp = String(a.class ?? "").localeCompare(String(b.class ?? ""), "ru", {
        numeric: true,
      });
    } else if (sortKey === "group") {
      cmp = (a.group_name ?? "").localeCompare(b.group_name ?? "", "ru");
    } else if (sortKey === "school") {
      cmp = (a.school_short_name ?? a.school_name ?? "").localeCompare(
        b.school_short_name ?? b.school_name ?? "",
        "ru",
      );
    } else if (sortKey === "final") {
      cmp = a.final - b.final;
    }
    return cmp * dir;
  });
}

export function formatReportPeriod(period: {
  date_from: string;
  date_to: string;
} | null): string {
  if (!period) {
    return "Период не указан";
  }
  return `${period.date_from} — ${period.date_to}`;
}

export function formatScore(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return value.toFixed(value % 1 === 0 ? 0 : 2);
}
