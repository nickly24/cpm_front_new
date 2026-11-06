import { domain, getIdentity } from "./client";
import { examContextKey } from "./exams-shared";

export interface ExamParticipant {
  account_id: number; profile_id: number; login: string; full_name: string;
  role: "student" | "examinator"; division_id: number; division_name: string;
}

/** Quotes CSV fields and neutralizes spreadsheet formula prefixes, including whitespace. */
export function participantCSVCell(value: string | number): string {
  let text = String(value);
  if (/^[\s\uFEFF]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportExamParticipants(signal?: AbortSignal, progress?: (count: number) => void): Promise<Blob> {
  const snapshot = examContextKey(), divisionId = getIdentity()?.user.division_id;
  if (!divisionId) throw new Error("Выберите подразделение для выгрузки участников");
  const check = () => {
    signal?.throwIfAborted();
    if (snapshot !== examContextKey()) throw new Error("Кабинет изменился. Выгрузите список заново.");
  };
  const chunks: BlobPart[] = ["\uFEFFaccount_id;profile_id;login;full_name;role;division_id;division_name\r\n"];
  let after = 0, count = 0;
  while (true) {
    check();
    const page = await domain<{ items: ExamParticipant[] }>(`/core/exam-participants?limit=200&after_id=${after}`, { signal });
    check();
    if (!Array.isArray(page.items) || page.items.length > 200) throw new Error("Сервис вернул неверный список участников");
    const lines: string[] = [];
    for (const row of page.items) {
      if (!Number.isSafeInteger(row.account_id) || row.account_id <= after || !Number.isSafeInteger(row.profile_id) || row.division_id !== divisionId || !["student", "examinator"].includes(row.role)) throw new Error("Список участников изменился или содержит неверные идентификаторы. Повторите выгрузку.");
      lines.push([row.account_id, row.profile_id, row.login, row.full_name, row.role, row.division_id, row.division_name].map(participantCSVCell).join(";"));
      after = row.account_id;
    }
    if (lines.length) chunks.push(`${lines.join("\r\n")}\r\n`);
    count += page.items.length; progress?.(count);
    if (page.items.length < 200) break;
  }
  return new Blob(chunks, { type: "text/csv;charset=utf-8" });
}
