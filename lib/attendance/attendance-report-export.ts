import * as XLSX from "xlsx";
import type {
  AttendanceReportClassDay,
  AttendanceReportEntry,
  AttendanceReportStudent,
} from "@/lib/attendance/attendance-report-types";
import { buildCellMap, cellMapKey } from "@/lib/attendance/attendance-report-utils";

function formatDayHeader(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}.${month}.${year}`;
}

export function exportAttendanceReportExcel(
  students: AttendanceReportStudent[],
  classDays: AttendanceReportClassDay[],
  entries: AttendanceReportEntry[],
  period: { date_from: string; date_to: string },
): void {
  const cellMap = buildCellMap(entries);
  const header = [
    "Группа",
    "Класс",
    "Школа",
    "ФИО",
    ...classDays.map((day) => formatDayHeader(day.date)),
  ];

  const rows = students.map((student) => {
    const row: (string | number)[] = [
      student.group_name ?? "",
      student.class ?? "",
      student.school_short_name ?? "",
      student.full_name,
    ];
    for (const day of classDays) {
      const entry = cellMap.get(cellMapKey(student.student_id, day.id));
      row.push(entry?.type_name ?? "");
    }
    return row;
  });

  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Посещаемость");
  XLSX.writeFile(
    workbook,
    `poseshchaemost_${period.date_from}_${period.date_to}.xlsx`,
  );
}
