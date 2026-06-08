import type {
  AttendanceReportClassDay,
  AttendanceReportEntry,
} from "@/lib/attendance/attendance-report-types";
import { cellMapKey } from "@/lib/attendance/attendance-report-utils";
import type { AttendancePalette } from "@/lib/attendance/attendance-palette";
import { getAttendancePalette } from "@/lib/attendance/attendance-palette";

export interface StudentAttendanceSummary {
  total: number;
  marked: number;
  empty: number;
  byPalette: Partial<Record<AttendancePalette, number>>;
}

export function summarizeStudentAttendance(
  studentId: number,
  classDays: AttendanceReportClassDay[],
  cellMap: Map<string, AttendanceReportEntry>,
): StudentAttendanceSummary {
  const byPalette: Partial<Record<AttendancePalette, number>> = {};
  let marked = 0;

  for (const day of classDays) {
    const entry = cellMap.get(cellMapKey(studentId, day.id));
    if (!entry) continue;
    marked += 1;
    const palette = getAttendancePalette(entry.type_code);
    byPalette[palette] = (byPalette[palette] ?? 0) + 1;
  }

  const total = classDays.length;
  return {
    total,
    marked,
    empty: total - marked,
    byPalette,
  };
}
