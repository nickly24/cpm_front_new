import { domain, getIdentity } from "@/lib/bff/client";
import { examContextKey } from "@/lib/bff/exams-shared";
import type { ExamParticipant } from "@/lib/bff/exam-participants";
import type { Person } from "./types";

/** Explicit download only. Lists in the UI never fetch this full roster. */
export async function loadAssignmentStudents(signal: AbortSignal, progress: (count: number) => void): Promise<ExamParticipant[]> {
  const context = examContextKey(), division = getIdentity()?.user.division_id;
  if (!division) throw new Error("Выберите подразделение");
  const rows: ExamParticipant[] = [];
  let after = 0;
  for (;;) {
    signal.throwIfAborted();
    const page = await domain<{ items: ExamParticipant[] }>(`/core/exam-participants?role=student&limit=200&after_id=${after}`, { signal });
    signal.throwIfAborted();
    if (context !== examContextKey()) throw new Error("Кабинет изменился. Подготовьте файл заново.");
    if (!Array.isArray(page.items) || page.items.length > 200) throw new Error("Некорректная страница участников");
    for (const row of page.items) {
      if (!Number.isSafeInteger(row.account_id) || row.account_id <= after || row.division_id !== division || row.role !== "student" || typeof row.login !== "string")
        throw new Error("Список участников изменился. Подготовьте файл заново.");
      after = row.account_id;
      rows.push(row);
    }
    if (rows.length > 5000) throw new Error("В подразделении больше 5000 учеников. Выгрузите участников в CSV и разделите назначения на несколько файлов до 5000 строк.");
    progress(rows.length);
    if (page.items.length < 200) break;
  }
  if (!rows.length) throw new Error("В подразделении нет активных учеников");
  return rows;
}

export async function buildAssignmentWorkbook(students: Pick<ExamParticipant, "account_id" | "login" | "full_name">[], members: Person[], replacementLimit: number): Promise<Blob> {
  if (students.length < 1 || students.length > 5000 || new Set(students.map(s => s.account_id)).size !== students.length || students.some(s => !Number.isSafeInteger(s.account_id) || s.account_id < 1))
    throw new Error("Для файла нужны от 1 до 5000 разных учеников");
  if (members.length < 1 || members.length > 6 || new Set(members.map(m => m.id)).size !== members.length || members.some(m => !Number.isSafeInteger(m.id) || m.id < 1))
    throw new Error("Выберите от 1 до 6 разных экзаменаторов");
  if (!Number.isInteger(replacementLimit) || replacementLimit < 0 || replacementLimit > 100) throw new Error("Лимит замен — целое число от 0 до 100");
  if (students.some(s => s.account_id > 999999999999999) || members.some(m => m.id > 999999999999999)) throw new Error("Excel может округлить длинные ID. Скачайте пустой шаблон и используйте колонки с логинами.");
  const XLSX = await import("xlsx");
  const headers = ["student_id", "student_login", ...Array.from({ length: 6 }, (_, i) => `examinator_${i + 1}_id`), "replacement_limit"];
  // The native parser requires numeric ID cells; login cells remain literal text.
  const data = students.map(student => [student.account_id, student.login, ...Array.from({ length: 6 }, (_, i) => members[i] ? members[i].id : ""), replacementLimit]);
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  sheet["!cols"] = headers.map((_, i) => ({ wch: i === 1 ? 28 : 22 }));
  sheet["!autofilter"] = { ref: `A1:I${students.length + 1}` };
  students.forEach((student, i) => { sheet[`A${i + 2}`].c = [{ a: "ЦПМ", t: student.full_name }]; });
  members.forEach((member, i) => { sheet[XLSX.utils.encode_cell({ r: 0, c: i + 2 })].c = [{ a: "ЦПМ", t: member.fullName }]; });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Назначения");
  return new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
