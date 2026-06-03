export type TestStatus =
  | "available"
  | "upcoming"
  | "completed"
  | "missed"
  | "external";

export type TestStatusFilter = "all" | TestStatus;

export interface Direction {
  id: number;
  name: string;
}

export interface ActiveAttemptSummary {
  id: string;
  expiresAt?: string;
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
  status: TestStatus;
  isCompleted?: boolean;
  isExternal?: boolean;
  externalTest?: boolean;
  canStart?: boolean;
  canResume?: boolean;
  canSubmitExpired?: boolean;
  canPractice?: boolean;
  canViewResults?: boolean;
  hasResult?: boolean;
  rate?: number | null;
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
  stats?: TestSessionStats | null;
}

export interface TestsWithSessionsResponse {
  tests: StudentTestItem[];
  sessions: TestSession[];
  serverTimeMoscow?: string;
}

export interface TestsDateFilter {
  startDate: string;
  endDate: string;
}

export const TESTS_STATUS_LABELS: Record<TestStatus, string> = {
  available: "Доступен",
  upcoming: "Скоро",
  completed: "Сдан",
  missed: "Пропущен",
  external: "Вне системы",
};
