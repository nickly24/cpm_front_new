export type AdminUploadTypeStatus = "ready" | "coming_soon";

export interface AdminUploadType {
  id: string;
  label: string;
  description: string;
  acceptedLabel: string;
  status: AdminUploadTypeStatus;
  instructions: string[];
}

export const ADMIN_UPLOAD_TYPES: AdminUploadType[] = [
  {
    id: "users",
    label: "Пользовательские данные",
    description:
      "Ученики из Excel: ФИО, класс, школа, проктор, Telegram. Группы создаются по прокторам.",
    acceptedLabel: ".xlsx",
    status: "ready",
    instructions: [
      "Подготовьте Excel с колонками: ФИО, Класс, Школа, Проктор, Telegram (первая строка — заголовки).",
      "В колонке «Проктор» повторяйте одно и то же ФИО для всех учеников группы.",
      "Пустой проктор — ученик будет создан без группы.",
      "Проверьте предпросмотр и исправьте строки с ошибками.",
      "Запустите загрузку — при сбое все новые данные этого импорта будут отменены.",
    ],
  },
];

export const ADMIN_UPLOAD_ACCEPT =
  ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type UserImportStudentAction = "create" | "skip" | "error";

export interface UserImportPreviewSchool {
  key: string;
  name: string;
  action: "create" | "use_existing";
  existing_id?: number | null;
}

export interface UserImportPreviewGroup {
  key: string;
  name: string;
  proctor_key: string;
  action: "create" | "use_existing";
  existing_id?: number | null;
  student_count: number;
}

export interface UserImportPreviewProctor {
  key: string;
  full_name: string;
  group_key: string;
  action: "create" | "use_existing";
  existing_id?: number | null;
  existing_group_id?: number | null;
  student_count: number;
}

export interface UserImportPreviewStudent {
  row: number;
  full_name: string;
  person_key: string | null;
  class: number | null;
  school_key: string | null;
  school_name: string | null;
  tg_name: string;
  proctor_key: string | null;
  proctor_name: string | null;
  group_key: string | null;
  action: UserImportStudentAction;
  skip_reason?: string | null;
  existing_student_id?: number | null;
  errors: string[];
  without_group: boolean;
}

export interface UserImportPreviewSummary {
  total_rows: number;
  row_errors: number;
  schools_total: number;
  schools_create: number;
  schools_existing: number;
  groups_total: number;
  groups_create: number;
  groups_existing: number;
  proctors_total: number;
  proctors_create: number;
  proctors_existing: number;
  students_create: number;
  students_skip: number;
  students_without_group: number;
}

export interface UserImportPreview {
  schools: UserImportPreviewSchool[];
  groups: UserImportPreviewGroup[];
  proctors: UserImportPreviewProctor[];
  students: UserImportPreviewStudent[];
  summary: UserImportPreviewSummary;
}

export interface UserImportSession {
  session_id: number;
  import_type: string;
  source_filename?: string | null;
  preview: UserImportPreview;
  created_at?: string | null;
  expires_at?: string | null;
}

export type UserImportJobStatus =
  | "queued"
  | "running"
  | "rolling_back"
  | "completed"
  | "failed";

export interface UserImportJob {
  id: number;
  session_id: number;
  import_type: string;
  status: UserImportJobStatus;
  created_by_name?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  total_rows: number;
  processed_count: number;
  successful: number;
  skipped: number;
  failed: number;
  message?: string | null;
  progress_percent: number;
  has_report: boolean;
  summary?: UserImportPreviewSummary | null;
}

export type UserImportReportRowStatus = "created" | "skipped";

export interface UserImportReportRow {
  row: number;
  full_name: string;
  class: number | null;
  school_name?: string | null;
  tg_name?: string | null;
  proctor_name?: string | null;
  group_name?: string | null;
  login?: string | null;
  password?: string | null;
  status: UserImportReportRowStatus | string;
  message?: string | null;
  existing_student_id?: number | null;
  student_id?: number | null;
}

export interface UserImportReport {
  job_id: number;
  status: string;
  summary?: UserImportPreviewSummary | null;
  successful: number;
  skipped: number;
  failed: number;
  rows: UserImportReportRow[];
}

export type AdminUploadTab = "upload" | "jobs";

export function formatUploadFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} Б`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} КБ`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
