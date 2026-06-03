export type HomeworkKind = "ДЗНВ" | "ОВ";

export type AdminHomeworkView =
  | "list"
  | "create"
  | "edit"
  | "view"
  | "workspace";

export type AdminHomeworkTypeFilter = "all" | HomeworkKind;

export type AdminHomeworkStatusFilter =
  | "all"
  | "active"
  | "ended"
  | "hidden";

export interface AdminHomeworkItem {
  id: number;
  name: string;
  type: string;
  deadline: string;
  published?: boolean;
}

export interface AdminHomeworkFormData {
  name: string;
  type: HomeworkKind;
  deadline: string;
  published: boolean;
}

export interface AdminHomeworkPagination {
  current_page: number;
  total_pages: number;
  total_items: number;
  items_per_page: number;
}

export interface AdminHomeworkListResponse {
  status: boolean;
  res: AdminHomeworkItem[];
  pagination?: AdminHomeworkPagination | null;
}

export interface AdminHomeworkAnalytics {
  totalStudents: number;
  submitted: number;
  inProgress: number;
  overdue: number;
  averageScore: number | null;
}

export interface AdminHomeworkOverviewResponse {
  homework: AdminHomeworkItem;
  analytics: AdminHomeworkAnalytics;
}

export interface AdminHomeworkStudentRow {
  student_id: number;
  student_name: string;
  student_class?: string | number | null;
  group_name?: string | null;
  session_id?: number | null;
  status?: number | null;
  result?: number | null;
  date_pass?: string | null;
  status_text?: string;
  days_overdue?: number;
}

export interface AdminHomeworkStudentsResponse {
  status: boolean;
  res: AdminHomeworkStudentRow[];
  pagination?: AdminHomeworkPagination | null;
  error?: string;
}
