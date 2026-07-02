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
  {
    id: "tests",
    label: "Тесты",
    description:
      "Импорт одного внутреннего теста из JSON: вопросы, варианты, баллы и настройки видимости.",
    acceptedLabel: ".json",
    status: "ready",
    instructions: [
      "Скачайте пример JSON и замените данные на свои.",
      "Укажите существующее направление в поле direction.",
      "Добавьте вопросы типов single, multiple или text по правилам ниже.",
      "Загрузите файл и проверьте предпросмотр с ошибками.",
      "Создайте тест только после успешной валидации.",
    ],
  },
  {
    id: "externalResults",
    label: "Результаты тестов",
    description:
      "Импорт результатов внешних тестов из Excel: выбор теста, сопоставление учеников и запись процента.",
    acceptedLabel: ".xlsx",
    status: "ready",
    instructions: [
      "Выберите внешний тест CPM-LMS, к которому относятся результаты.",
      "Загрузите Excel с колонками: ФИО и Процент правильных ответов (%).",
      "Дополнительные колонки попадут в отчёт: Количество правильных ответов, Дата завершения, Логин, IP.",
      "Дубли ФИО, неизвестные ученики и уже существующие результаты блокируют запуск.",
      "Запустите загрузку только после preview без ошибок.",
    ],
  },
];

export const ADMIN_UPLOAD_ACCEPT =
  ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const ADMIN_TEST_IMPORT_ACCEPT = ".json,.js,application/json,text/javascript,application/javascript";

export const ADMIN_EXTERNAL_TEST_RESULTS_ACCEPT = ADMIN_UPLOAD_ACCEPT;

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

export interface ExternalTestOption {
  id: string;
  numeric_id?: number;
  name: string;
  direction_id?: string | number | null;
  direction_name?: string | null;
  date?: string | null;
}

export type ExternalTestResultImportAction = "import" | "error";

export interface ExternalTestResultImportRow {
  row: number;
  source_number?: string | number | null;
  platform_user?: string | null;
  ip?: string | null;
  completed_at?: string | null;
  time_spent?: string | null;
  login?: string | null;
  full_name: string;
  person_key?: string | null;
  correct_count?: number | string | null;
  percent?: number | string | null;
  student_id?: number | null;
  student_full_name?: string | null;
  action: ExternalTestResultImportAction;
  errors: string[];
}

export interface ExternalTestResultsImportSummary {
  total_rows: number;
  import_rows: number;
  row_errors: number;
  matched_students: number;
  duplicate_rows: number;
  existing_results: number;
}

export interface ExternalTestResultsImportPreview {
  test_id?: number | null;
  test_name?: string | null;
  test_direction_name?: string | null;
  source_sheet?: string | null;
  header_row?: number | null;
  rows: ExternalTestResultImportRow[];
  summary: ExternalTestResultsImportSummary;
  errors?: string[];
}

export interface ExternalTestResultsImportSession {
  session_id: number;
  import_type: string;
  source_filename?: string | null;
  preview: ExternalTestResultsImportPreview;
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
  summary?: UserImportPreviewSummary | ExternalTestResultsImportSummary | null;
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
  import_type?: string | null;
  summary?: UserImportPreviewSummary | ExternalTestResultsImportSummary | null;
  successful: number;
  skipped: number;
  failed: number;
  rows: UserImportReportRow[] | ExternalTestResultImportReportRow[];
}

export type AdminUploadTab = "upload" | "jobs";

export type AdminUploadTypeId = "users" | "tests" | "externalResults";

export type ExternalTestResultReportStatus = "imported" | "error" | string;

export interface ExternalTestResultImportReportRow {
  row: number;
  full_name: string;
  student_id?: number | null;
  student_full_name?: string | null;
  test_id?: number | string | null;
  test_name?: string | null;
  percent?: number | string | null;
  correct_count?: number | string | null;
  completed_at?: string | null;
  login?: string | null;
  status: ExternalTestResultReportStatus;
  message?: string | null;
}

export interface TestImportError {
  path: string;
  message: string;
}

export interface TestImportAnswer {
  id: string;
  text: string;
  isCorrect: boolean;
}

export type TestImportQuestionType = "single" | "multiple" | "text";

export interface TestImportQuestion {
  questionId: number;
  type: TestImportQuestionType;
  text: string;
  points: number;
  answers?: TestImportAnswer[];
  correctAnswers?: string[];
}

export interface TestImportPreview {
  title: string;
  direction: string;
  startDate: string;
  endDate: string;
  timeLimitMinutes: number;
  published: boolean;
  visible: boolean;
  questions: TestImportQuestion[];
}

export interface TestImportSummary {
  questionsTotal: number;
  totalPoints: number;
  singleCount: number;
  multipleCount: number;
  textCount: number;
  errorsCount: number;
}

export interface TestImportPreviewResponse {
  status: boolean;
  preview: TestImportPreview;
  summary: TestImportSummary;
  errors: TestImportError[];
  source?: "json" | "online_test_pad" | string;
  sourceTitle?: string;
  warnings?: string[];
  error?: string;
}

export interface TestImportCommitResponse extends TestImportPreviewResponse {
  testId?: string;
}

export function formatUploadFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} Б`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} КБ`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
