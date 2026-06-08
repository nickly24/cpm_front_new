export type RatingsReportColumnKind =
  | "summary"
  | "homework"
  | "exam"
  | "test";

export interface RatingsReportColumn {
  key: string;
  kind: RatingsReportColumnKind;
  label: string;
  subtitle?: string | null;
}

export interface RatingsReportStudent {
  student_id: number;
  rating_id: number;
  full_name: string;
  class: string | number | null;
  group_id: number | null;
  group_name: string | null;
  school_id: number | null;
  school_short_name: string | null;
  homework: number;
  exams: number;
  tests: number;
  final: number;
}

export interface RatingsReportValue {
  student_id: number;
  column_key: string;
  score: number;
  status?: string | null;
}

export interface RatingsReportPeriod {
  date_from: string;
  date_to: string;
  calculated_at?: string | null;
}

export interface RatingsReportData {
  period: RatingsReportPeriod | null;
  students: RatingsReportStudent[];
  columns: RatingsReportColumn[];
  values: RatingsReportValue[];
  message?: string;
}

export interface RatingsReportResponse {
  status: boolean;
  error?: string;
  message?: string;
  period?: RatingsReportPeriod | null;
  students?: RatingsReportStudent[];
  columns?: RatingsReportColumn[];
  values?: RatingsReportValue[];
}

export type RatingsReportSortKey =
  | "fio"
  | "class"
  | "group"
  | "school"
  | "final";

export type RatingsReportSortDir = "asc" | "desc";
