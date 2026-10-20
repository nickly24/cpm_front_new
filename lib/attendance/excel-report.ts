import { journalRoster, type Entry, type AttendanceType, type Journal, type Student } from "@/lib/bff/attendance";
import type { AttendanceReportData, AttendanceReportEntry } from "./attendance-report-types";

/** The existing grid's student_id is a view key. In BFF it is always account_id,
 * never profile_id; commands use that same account key. */
export function excelReport(journal: Journal, students: Student[], from: string, to: string): AttendanceReportData {
  return {
    period: { date_from: from, date_to: to },
    class_days: journal.days.map(day => ({ id: day.id, date: day.date, comment: day.comment })),
    students: journalRoster(students, journal.entries).map(student => ({
      student_id: student.account_id, full_name: student.full_name, class: student.class,
      group_id: student.group_id, group_name: student.group_name,
      school_id: student.school_id, school_short_name: student.school_short_name || student.school_name,
    })),
    entries: journal.entries.filter(entry => !entry.is_deleted).map(excelEntry),
  };
}
export function excelTypes(types: AttendanceType[]) {
  return types.filter(type => type.is_active).map(type => ({
    id: type.id, code: type.code, name_ru: type.name, sort_order: type.sort_order,
    color: type.color, mark: type.mark,
  }));
}

export function excelEntry(entry: Entry): AttendanceReportEntry {
 return {id:entry.id,student_id:entry.account_id,class_day_id:entry.class_day_id,attendance_type_id:entry.type.id,type_code:entry.type.code,type_name:entry.type.name,zap_id:entry.zap_id,zap_date_id:null,snapshot:{color:entry.type.color,mark:entry.type.mark}};
}
