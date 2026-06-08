export interface AttendanceType {
  id: number;
  code: string;
  name_ru: string;
  sort_order: number;
}

export interface ClassDay {
  id: number;
  date: string;
  comment: string | null;
  created_at?: string | null;
}

export interface ClassDayAttendanceItem {
  id: number;
  student_id: number;
  full_name: string;
  attendance_type_id: number;
  type_code: string;
  type_name: string;
  zap_id: number | null;
  created_at?: string | null;
}

export interface StudentClassDayAttendanceItem {
  class_day_id: number;
  date: string;
  comment: string | null;
  attendance_type_id: number;
  type_code: string;
  type_name: string;
  zap_id: number | null;
}

export interface ScanHistoryItem {
  id: number;
  name: string;
  class: number;
  studentId: string;
  date: string;
  classDayId?: number;
  scanAt?: number;
}

export interface StudentBrief {
  id: number;
  name: string;
  class: number;
}

export const IN_PERSON_ATTENDANCE_TYPE_ID = 1;

export const SCAN_SESSION_DAY_KEY = "cpm-scan-class-day-id";
