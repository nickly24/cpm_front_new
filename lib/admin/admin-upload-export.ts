import type { UserImportReportRow } from "@/lib/admin/admin-upload-types";
import * as XLSX from "xlsx";

const TEMPLATE_HEADERS = ["ФИО", "Класс", "Школа", "Проктор", "Telegram"];

export const TEST_IMPORT_SAMPLE = {
  title: "Вводный тест по Python",
  direction: "Python",
  startDate: "2026-07-01T10:00",
  endDate: "2026-07-31T23:59",
  timeLimitMinutes: 30,
  published: true,
  visible: false,
  questions: [
    {
      questionId: 1,
      type: "single",
      text: "Что выведет print(2 + 2)?",
      points: 1,
      answers: [
        { id: "a", text: "3", isCorrect: false },
        { id: "b", text: "4", isCorrect: true },
      ],
    },
    {
      questionId: 2,
      type: "multiple",
      text: "Какие типы данных есть в Python?",
      points: 2,
      answers: [
        { id: "a", text: "str", isCorrect: true },
        { id: "b", text: "list", isCorrect: true },
        { id: "c", text: "varchar", isCorrect: false },
      ],
    },
    {
      questionId: 3,
      type: "text",
      text: "Как называется функция вывода в консоль?",
      points: 1,
      answers: [],
      correctAnswers: ["print", "print()"],
    },
  ],
};

export function downloadTestImportSample(directionName = "Python"): void {
  const sample = {
    ...TEST_IMPORT_SAMPLE,
    direction: directionName,
  };
  const blob = new Blob([JSON.stringify(sample, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "primer_importa_testa_cpm.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadUserImportTemplate(): void {
  const sheet = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ["Иванов Иван Петрович", 10, "Лицей №1", "Сидорова Анна Ивановна", "@ivanov"],
    ["Петрова Мария", 7, "Лицей №1", "Сидорова Анна Ивановна", "@petrova"],
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
    "Telegram",
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
    row.tg_name ?? "",
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
