export type TestStatus =
  | "available"
  | "upcoming"
  | "completed"
  | "pending_upload"
  | "upload_window_closed"
  | "missed"
  | "external"
  | "running"
  | "checking"
  | "calculation_failed";

export type TestStatusFilter = "all" | TestStatus;

export interface Direction {
  id: number;
  name: string;
}

export interface ActiveAttemptSummary {
  id: string;
  expiresAt?: string;
  uploadDeadline?: string;
  remainingSeconds: number;
  answeredCount: number;
  totalQuestions: number;
  expired?: boolean;
}

export interface StudentTestItem {
  id: string;
  title?: string;
  name?: string;
  startDate?: string | null;
  endDate?: string | null;
  date?: string | null;
  timeLimitMinutes?: number | null;
  visible?: boolean;
  directionName?: string;
  direction?: string;
  status: TestStatus;
  isCompleted?: boolean;
  isExternal?: boolean;
  externalTest?: boolean;
  canStart?: boolean;
  canResume?: boolean;
  canSubmitExpired?: boolean;
  canRequestHelp?: boolean;
  canPractice?: boolean;
  canViewResults?: boolean;
  hasResult?: boolean;
  rate?: number | null;
  calculationStatus?: string;
  activeAttempt?: ActiveAttemptSummary | null;
}

export interface TestSessionStats {
  totalQuestions?: number;
  correctAnswers?: number;
  accuracy?: number;
  totalPoints?: number;
}

export interface TestSession {
  id: string;
  testId: string;
  testTitle?: string;
  score?: number;
  timeSpentMinutes?: number;
  completedAt?: string;
  calculationStatus?: string;
  stats?: TestSessionStats | null;
}

export interface TestsPagination {
  current_page: number;
  total_pages: number;
  total_items: number;
  items_per_page: number;
}

export interface TestsWithSessionsResponse {
  success?: boolean;
  tests: StudentTestItem[];
  sessions: TestSession[];
  pagination?: TestsPagination;
  counts?: Record<string, number>;
  serverTimeMoscow?: string;
  totalActionable?: number;
}

export interface TestsDateFilter {
  startDate: string;
  endDate: string;
}

export const STUDENT_TESTS_PAGE_SIZE = 5;

export const TESTS_STATUS_LABELS: Record<TestStatus, string> = {
  running: "В процессе",
  checking: "Проверка ответов",
  calculation_failed: "Ошибка проверки",
  available: "Доступен",
  upcoming: "Скоро",
  completed: "Сдан",
  pending_upload: "Ожидает отправки",
  upload_window_closed: "Срок отправки истёк",
  missed: "Пропущен",
  external: "Вне системы",
};
