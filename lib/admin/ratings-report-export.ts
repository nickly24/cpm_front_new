import type { RatingsReportColumn, RatingsReportData, RatingsReportStudent, RatingsReportValue } from "@/lib/admin/ratings-report-types";
import { formatScore, valueMapKey } from "@/lib/admin/ratings-report-utils";
import * as XLSX from "xlsx";
function columnTitle(column: RatingsReportColumn): string {
  if (column.group_label) return `${column.group_label}: ${column.label}`;
  return column.subtitle ? `${column.label} (${column.subtitle})` : column.label;
}
export function buildRatingsReportWorkbook(report: RatingsReportData, students: RatingsReportStudent[], valueMap: Map<string, Pick<RatingsReportValue, "score" | "status" | "details">>) {
  const published = report.versionId !== undefined || students.some(student => student.place !== undefined);
  const headerRow = [...(published ? ["Место", "ID аккаунта"] : []), "Группа", "Класс", "Школа", "ФИО", ...report.columns.map(columnTitle)];
  const rows = students.map(student => [
    ...(published ? [student.place ?? "", student.student_id] : []), student.group_name ?? "", student.class ?? "",
    student.school_short_name ?? student.school_name ?? "", student.full_name,
    ...report.columns.map(column => valueMap.get(valueMapKey(student.student_id, column.key))?.score ?? (published ? "" : 0)),
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headerRow, ...rows]), "Рейтинг");
  if (published) {
    const details = students.flatMap(student => report.columns.filter(column => column.kind !== "summary").map(column => {
      const cell = valueMap.get(valueMapKey(student.student_id, column.key));
      return [student.student_id, student.full_name, column.kind, columnTitle(column), cell?.score ?? "", cell?.status ?? "", cell?.details ? JSON.stringify(cell.details) : ""];
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["ID аккаунта", "ФИО", "Тип", "Работа", "Балл", "Статус", "Детали исходной публикации"], ...details]), "Детализация");
    const freshness = report.ratingFreshness;
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ["Версия", report.versionId ?? ""], ["Начало периода", report.period?.date_from ?? ""], ["Конец периода", report.period?.date_to ?? ""],
      ["Данные на", freshness?.asOf ?? ""], ["Ревизия", freshness?.calculatedRevision ?? ""], ["Актуальность", freshness?.isStale ? "Требуется пересчёт" : "Актуален"],
      ["Причина", freshness?.reason ?? ""], ["Экзамены", freshness?.examsMode ?? ""], ["Внешние тесты", freshness?.externalTestsMode ?? ""],
    ]), "Версия");
  }
  return workbook;
}
export function exportRatingsReportExcel(report: RatingsReportData, students: RatingsReportStudent[], valueMap: Map<string, Pick<RatingsReportValue, "score" | "status" | "details">>, fileName?: string): void {
  const suffix = report.period ? `${report.period.date_from}_${report.period.date_to}` : "snapshot";
  XLSX.writeFile(buildRatingsReportWorkbook(report, students, valueMap), fileName ?? `reyting_${suffix}.xlsx`);
}
export { formatScore };
