import { attendanceError, readAttendance, type AttendanceType, type Journal, type Revision, type Student } from "@/lib/bff/attendance";
import { excelReport } from "./excel-report";
import type { AttendanceReportData } from "./attendance-report-types";
export interface JournalWorkspace { journal: Journal; students: Student[]; types: AttendanceType[] }
export interface PreparedJournal extends Revision<JournalWorkspace> { report: AttendanceReportData }
export async function prepareJournal(division: number, from: string, to: string, signal?: AbortSignal): Promise<PreparedJournal> {
  const response = await readAttendance<JournalWorkspace>(`/divisions/${division}/journal-workspace?date_from=${from}&date_to=${to}`,signal);
  if (signal?.aborted) throw new DOMException("Aborted","AbortError");
  if (response.value.journal.division_id!==division) throw new Error("Ответ относится к другому подразделению.");
  return {...response,report:excelReport(response.value.journal,response.value.students,from,to)};
}

export function journalLoadError(error:unknown):string {
 const code=(error as {code?:string}|null)?.code;
 return code&&["dependency_unavailable","upstream_unavailable","transport_error","request_timeout"].includes(code)?"Не удалось получить журнал. Попробуйте ещё раз.":attendanceError(error);
}
