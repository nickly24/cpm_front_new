import { domain, getIdentity } from "./client";
import * as XLSX from "xlsx";

export type CoreReportKind = "tests" | "exams" | "attendance";
export interface CoreReportStudent {
  account_id: number; profile_id: number; full_name: string; class: number | null;
  group_id: number | null; group_name: string | null; school_id: number | null; school_name: string | null;
}
export interface CoreReportItem {
  id: string; name: string; date: string; kind: string; direction_id?: number; direction_name?: string;
  target_id?: string; source_revision?: number;
}
export interface CoreReportCell {
  account_id: number; item_id: string; status: string; score: number | null;
  submission_id?: string; calculation_revision?: number; attempt_no?: number; has_appeal?: boolean;
  result_id?: number; result_version?: number; mark?: string; type_name?: string; type_code?: string;
  recorded?: boolean; external_result_id?: string;
}
export interface CoreReport {
  source: CoreReportKind; organization_id: number; division_id: number; date_from: string; date_to: string; as_of: string;
  students: CoreReportStudent[]; items: CoreReportItem[]; cells: CoreReportCell[]; limitations: string[];
  source_revision?: number; unmarked_is_absent?: boolean;
  source_input_hash?: string; external_source_version?: string;
}
export interface CoreReportFilter { search?: string; group?: string; school?: string; class?: string; direction?: string }

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export async function coreReport(kind: CoreReportKind, period: { dateFrom: string; dateTo: string }, signal?: AbortSignal): Promise<CoreReport> {
  if (!datePattern.test(period.dateFrom) || !datePattern.test(period.dateTo) || period.dateFrom > period.dateTo) throw new Error("Укажите корректный период отчёта");
  const scope = getIdentity()?.user;
  if (!scope?.division_id || !scope.organization_id) throw new Error("Выберите подразделение");
  const query = new URLSearchParams({ date_from: period.dateFrom, date_to: period.dateTo });
  let data: CoreReport;
  try { data = await domain<CoreReport>(`/core/reports/${kind}?${query}`, { signal }); }
  catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    const labels: Record<string, string> = { report_too_large: "Отчёт слишком большой. Выберите более короткий период.", report_source_too_large: "Отчёт слишком большой. Выберите более короткий период.", invalid_report_source: "Источник вернул неполные данные. Обновите отчёт позже.", invalid_period: "Укажите корректный период до 366 дней." };
    if (code.endsWith("_reports_not_connected")) throw new Error("Источник этого отчёта ещё не подключён.");
    if (code.endsWith("_report_unavailable")) throw new Error("Источник отчёта временно недоступен. Попробуйте обновить позже.");
    if (labels[code]) throw new Error(labels[code]);
    throw error;
  }
  if (data.source !== kind || data.organization_id !== scope.organization_id || data.division_id !== scope.division_id || data.date_from !== period.dateFrom || data.date_to !== period.dateTo || !Array.isArray(data.students) || !Array.isArray(data.items) || !Array.isArray(data.cells) || !Array.isArray(data.limitations)) throw new Error("Сервис вернул отчёт другой области или некорректные данные");
  const students = new Set<number>(); const items = new Set<string>(); const cells = new Set<string>();
  for (const student of data.students) {
    if (!Number.isSafeInteger(student.account_id) || student.account_id < 1 || !Number.isSafeInteger(student.profile_id) || student.profile_id < 1 || students.has(student.account_id) || typeof student.full_name !== "string") throw new Error("Сервис вернул некорректный список учеников");
    students.add(student.account_id);
  }
  for (const item of data.items) {
    if (typeof item.id !== "string" || !item.id || items.has(item.id) || typeof item.name !== "string" || !datePattern.test(item.date) || item.date < period.dateFrom || item.date > period.dateTo) throw new Error("Сервис вернул некорректные столбцы отчёта");
    items.add(item.id);
  }
  for (const cell of data.cells) {
    const key = coreReportCellKey(cell.account_id, cell.item_id);
    if (!students.has(cell.account_id) || !items.has(cell.item_id) || cells.has(key)) throw new Error("Сервис вернул некорректные результаты учеников");
    cells.add(key);
    const statuses = { tests: ["ready", "missing", "queued", "processing", "retrying", "failed"], exams: ["completed", "missing"], attendance: ["marked", "missing"] };
    if (!statuses[kind].includes(cell.status)) throw new Error("Сервис вернул некорректное состояние результата");
    if (["ready", "completed"].includes(cell.status)) {
      if (typeof cell.score !== "number" || !Number.isFinite(cell.score) || cell.score < 0 || cell.score > (kind === "exams" ? 5 : 100)) throw new Error("Сервис вернул некорректный балл");
    } else if (!["missing", "queued", "processing", "retrying", "failed", "marked"].includes(cell.status) || cell.score !== null) throw new Error("Сервис вернул некорректное состояние результата");
  }
  if (data.cells.length !== data.students.length * data.items.length || data.cells.length > 100000 || (kind === "attendance" && data.unmarked_is_absent !== false)) throw new Error("Сервис вернул неполный отчёт");
  return data;
}
export function coreReportCellKey(accountId: number, itemId: string) { return `${accountId}/${itemId}`; }
export function coreReportCellLabel(cell: CoreReportCell | undefined, kind: CoreReportKind): string {
  if (!cell || cell.status === "missing") return kind === "attendance" ? "Не отмечено" : kind === "tests" && cell?.recorded === true ? "Без оценки" : "Нет результата";
  if (cell.status === "marked") return cell.mark || cell.type_name || "Отмечено";
  if (cell.status === "ready" || cell.status === "completed") return cell.score === null ? "Нет результата" : String(cell.score);
  return { queued: "В очереди", processing: "В процессе", retrying: "Повторный расчёт", failed: "Ошибка расчёта" }[cell.status] || "Нет результата";
}
export function coreReportRows(data: CoreReport, filter: CoreReportFilter): CoreReportStudent[] {
  const term = (filter.search || "").trim().toLocaleLowerCase("ru");
  return data.students.filter((student) => (!term || [student.full_name, student.group_name || "", student.school_name || ""].some((value) => value.toLocaleLowerCase("ru").includes(term))) && (!filter.group || (filter.group === "none" ? student.group_id === null : String(student.group_id) === filter.group)) && (!filter.school || (filter.school === "none" ? student.school_id === null : String(student.school_id) === filter.school)) && (!filter.class || (filter.class === "none" ? student.class === null : String(student.class) === filter.class)));
}
export function coreReportItemKindLabel(item: CoreReportItem): string {
  return item.kind === "external_test" ? "Внешний тест" : item.kind === "outside_lms" ? "Вне системы" : "";
}
export function coreReportColumns(data: CoreReport, direction?: string): CoreReportItem[] {
  return data.items.filter((item) => !direction || String(item.direction_id) === direction);
}
export function coreReportWorkbook(data: CoreReport, rows: CoreReportStudent[], columns: CoreReportItem[]) {
  const values = new Map(data.cells.map((cell) => [coreReportCellKey(cell.account_id, cell.item_id), cell]));
  const sheet = XLSX.utils.aoa_to_sheet([
    [`Период ${data.date_from} — ${data.date_to}`],
    ["Ученик", "Класс", "Группа", "Школа", ...columns.map((item) => `${item.name} · ${item.date}${coreReportItemKindLabel(item) ? ` · ${coreReportItemKindLabel(item)}` : ""}`)],
    ...rows.map((student) => [student.full_name, student.class ?? "Без класса", student.group_name || "Без группы", student.school_name || "Без школы", ...columns.map((item) => {
      const cell = values.get(coreReportCellKey(student.account_id, item.id));
      return cell && ["ready", "completed"].includes(cell.status) && cell.score !== null ? cell.score : coreReportCellLabel(cell, data.source);
    })]),
  ]);
  sheet["!cols"] = [{ wch: 34 }, { wch: 8 }, { wch: 20 }, { wch: 24 }, ...columns.map(() => ({ wch: 24 }))];
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Отчёт"); return workbook;
}
export function exportCoreReport(data: CoreReport, rows: CoreReportStudent[], columns: CoreReportItem[]) {
  XLSX.writeFile(coreReportWorkbook(data, rows, columns), `${data.source}_${data.date_from}_${data.date_to}.xlsx`);
}
