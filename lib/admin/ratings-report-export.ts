import type {
  RatingsReportColumn,
  RatingsReportData,
  RatingsReportStudent,
} from "@/lib/admin/ratings-report-types";
import { formatScore, valueMapKey } from "@/lib/admin/ratings-report-utils";
import * as XLSX from "xlsx";

function fixedHeaders(): { key: string; title: string }[] {
  return [
    { key: "_group", title: "Группа" },
    { key: "_class", title: "Класс" },
    { key: "_school", title: "Школа" },
    { key: "_fio", title: "ФИО" },
  ];
}

function columnTitle(column: RatingsReportColumn): string {
  if (column.group_label) {
    return `${column.group_label}: ${column.label}`;
  }
  if (column.subtitle) {
    return `${column.label} (${column.subtitle})`;
  }
  return column.label;
}

export function exportRatingsReportExcel(
  report: RatingsReportData,
  students: RatingsReportStudent[],
  valueMap: Map<string, { score: number }>,
  fileName?: string,
): void {
  const period = report.period;
  const fileSuffix = period
    ? `${period.date_from}_${period.date_to}`
    : "snapshot";
  const outputName = fileName ?? `reyting_${fileSuffix}.xlsx`;

  const headerRow = [
    ...fixedHeaders().map((item) => item.title),
    ...report.columns.map((column) => columnTitle(column)),
  ];

  const rows = students.map((student) => {
    const row: (string | number)[] = [
      student.group_name ?? "",
      student.class ?? "",
      student.school_short_name ?? student.school_name ?? "",
      student.full_name,
    ];

    for (const column of report.columns) {
      const cell = valueMap.get(valueMapKey(student.student_id, column.key));
      row.push(cell?.score ?? 0);
    }

    return row;
  });

  const sheet = XLSX.utils.aoa_to_sheet([headerRow, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Рейтинг");
  XLSX.writeFile(workbook, outputName);
}

export { formatScore };
