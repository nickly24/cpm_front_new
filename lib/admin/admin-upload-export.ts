import type { UserImportReportRow } from "@/lib/admin/admin-upload-types";
import * as XLSX from "xlsx";

const TEMPLATE_HEADERS = ["ФИО", "Класс", "Школа", "Проктор"];

export function downloadUserImportTemplate(): void {
  const sheet = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ["Иванов Иван Петрович", 10, "Лицей №1", "Сидорова Анна Ивановна"],
    ["Петрова Мария", 9, "Лицей №1", "Сидорова Анна Ивановна"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Ученики");
  XLSX.writeFile(workbook, "shablon_import_uchenikov.xlsx");
}

const REPORT_STATUS_LABEL: Record<string, string> = {
  created: "Создан",
  skipped: "Пропущен",
};

export function exportUserImportReportExcel(
  rows: UserImportReportRow[],
  jobId: number,
): void {
  const header = [
    "Строка",
    "ФИО",
    "Класс",
    "Школа",
    "Проктор",
    "Группа",
    "Логин",
    "Пароль",
    "Статус",
    "Комментарий",
  ];

  const body = rows.map((row) => [
    row.row,
    row.full_name,
    row.class ?? "",
    row.school_name ?? "",
    row.proctor_name ?? "",
    row.group_name ?? (row.message === "Без группы" ? "Без группы" : ""),
    row.login ?? "",
    row.password ?? "",
    REPORT_STATUS_LABEL[row.status] ?? row.status,
    row.message ?? "",
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Импорт");
  XLSX.writeFile(workbook, `import_users_job_${jobId}.xlsx`);
}
