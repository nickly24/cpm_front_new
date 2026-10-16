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
  snapshots?: { name: string; color: string; mark: string; count: number }[];
}

export function summarizeStudentAttendance(
  studentId: number,
  classDays: AttendanceReportClassDay[],
  cellMap: Map<string, AttendanceReportEntry>,
): StudentAttendanceSummary {
  const byPalette: Partial<Record<AttendancePalette, number>> = {};
  let marked = 0;
  const snapshots = new Map<string, { name: string; color: string; mark: string; count: number }>();

  for (const day of classDays) {
    const entry = cellMap.get(cellMapKey(studentId, day.id));
    if (!entry) continue;
    marked += 1;
    if (entry.snapshot) {
      const key = JSON.stringify([entry.type_name, entry.snapshot.color, entry.snapshot.mark]);
      const value = snapshots.get(key) ?? { name: entry.type_name, ...entry.snapshot, count: 0 };
      value.count++; snapshots.set(key, value);
      continue;
    }
    const palette = getAttendancePalette(entry.type_code);
    byPalette[palette] = (byPalette[palette] ?? 0) + 1;
  }

  const total = classDays.length;
  return {
    total,
    marked,
    empty: total - marked,
    byPalette,
    ...(snapshots.size ? { snapshots: [...snapshots.values()] } : {}),
  };
}
