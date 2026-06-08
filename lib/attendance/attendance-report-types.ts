export interface AttendanceReportPeriod {
  date_from: string;
  date_to: string;
}

export interface AttendanceReportClassDay {
  id: number;
  date: string;
  comment: string | null;
}

export interface AttendanceReportStudent {
  student_id: number;
  full_name: string;
  class: number | null;
  group_id: number | null;
  group_name: string | null;
  school_id: number | null;
  school_short_name: string | null;
}

export interface AttendanceReportEntry {
  id: number;
  student_id: number;
  class_day_id: number;
  attendance_type_id: number;
  type_code: string;
  type_name: string;
  zap_id: number | null;
  zap_date_id: number | null;
}

export interface AttendanceReportData {
  period: AttendanceReportPeriod;
  class_days: AttendanceReportClassDay[];
  students: AttendanceReportStudent[];
  entries: AttendanceReportEntry[];
}

export interface AttendanceReportResponse {
  status: boolean;
  error?: string;
  period?: AttendanceReportPeriod;
  class_days?: AttendanceReportClassDay[];
  students?: AttendanceReportStudent[];
  entries?: AttendanceReportEntry[];
}

export type ReportSortKey = "group" | "class" | "school" | "fio";
export type ReportSortDir = "asc" | "desc";

export type ReportTool = "cursor" | "pencil" | "brush" | "eraser";

export type CellUiPhase = "idle" | "pending" | "success" | "error";

export interface CellUiState {
  phase: CellUiPhase;
}

export type CellMapKey = `${number}:${number}`;
