import type { Entry, Revision } from "@/lib/bff/attendance";
import type { AttendanceReportData } from "./attendance-report-types";
import { excelEntry } from "./excel-report";
export interface CellIntent { account: number; day: number; type: number }
/** Only the committed owner response changes the displayed mark. No optimistic
 * type reconstruction: historical color/mark/name come from its exact snapshot. */
export function applyConfirmedCell(report: AttendanceReportData, result: Revision<unknown>, expected: number, division: number, intent: CellIntent): AttendanceReportData {
  if (result.revision!==expected+1 || !report.class_days.some(d=>d.id===intent.day) || !report.students.some(s=>s.student_id===intent.account)) throw new Error("Ответ сохранения не соответствует ячейке. Обновите журнал.");
  const entries=report.entries.filter(e=>e.student_id!==intent.account || e.class_day_id!==intent.day);
  if (!intent.type) {
    if (!result.value || (result.value as {deleted?:boolean}).deleted!==true) throw new Error("Удаление отметки не подтверждено.");
  } else {
    const entry=result.value as Entry;
    if (!entry || !Number.isSafeInteger(entry.id) || entry.id<1 || entry.division_id!==division || entry.class_day_id!==intent.day || entry.account_id!==intent.account || entry.is_deleted!==false || entry.zap_id!==null || entry.type?.id!==intent.type || entry.type.division_id!==division || !Number.isSafeInteger(entry.type.version) || entry.type.version<1 || typeof entry.type.code!=="string" || typeof entry.type.name!=="string" || typeof entry.type.mark!=="string" || !/^#[0-9a-f]{6}$/i.test(entry.type.color)) throw new Error("Ответ сохранения не соответствует ячейке. Обновите журнал.");
    entries.push(excelEntry(entry));
  }
  return {...report,entries};
}

/** Validate the complete batch before changing the displayed report. One batch
 * has one committed revision, including canonical tombstones for erased cells. */
export function applyConfirmedCells(report: AttendanceReportData, result: Revision<unknown>, expected: number, division: number, intents: readonly CellIntent[]): AttendanceReportData {
  const cells=(result.value as {cells?:Entry[]}|null)?.cells;
  if(result.revision!==expected+1||!Array.isArray(cells)||cells.length!==intents.length||!intents.length||intents.length>100)throw new Error("Пакет отметок не подтверждён полностью. Обновите журнал.");
  const seen=new Set<string>();
  let next=report;
  for(let index=0;index<intents.length;index++){
    const intent=intents[index],entry=cells[index],key=`${intent.day}:${intent.account}`;
    if(seen.has(key)||!entry||!Number.isSafeInteger(entry.id)||entry.id<1||entry.division_id!==division||entry.class_day_id!==intent.day||entry.account_id!==intent.account||entry.zap_id!==null||entry.is_deleted!==(intent.type===0))throw new Error("Ответ пакета не соответствует ячейкам. Обновите журнал.");
    seen.add(key);
    if(!intent.type){const old=report.entries.find(e=>e.class_day_id===intent.day&&e.student_id===intent.account);if(!old||entry.id!==old.id||entry.type?.id!==old.attendance_type_id)throw new Error("Удаление ячейки в пакете не подтверждено.");}
    next=applyConfirmedCell(next,{revision:result.revision,value:intent.type?entry:{deleted:true}},expected,division,intent);
  }
  return next;
}
