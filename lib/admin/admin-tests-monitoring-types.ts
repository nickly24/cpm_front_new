export interface AdminListPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface AdminTestAnalytics {
  sessionsCompleted: number;
  averageScore: number | null;
  attemptsInProgress: number;
  attemptsExpired: number;
  attemptsSubmitted: number;
  attemptsActive: number;
}

export interface AdminTestOverviewResponse {
  success: boolean;
  testId: string;
  testTitle?: string;
  analytics: AdminTestAnalytics;
}

export interface AdminTestSessionListItem {
  sessionId: string;
  studentId: number | string;
  studentFullName: string;
  testTitle?: string;
  score?: number | null;
  completedAt?: string | null;
  timeSpentMinutes?: number | null;
  answersCount?: number;
}

export interface AdminTestSessionsListResponse {
  success: boolean;
  testId: string;
  sessions: AdminTestSessionListItem[];
  pagination: AdminListPagination;
  search: string;
}

export interface AdminTestAttemptListItem {
  attemptId: string;
  studentId: number | string;
  studentFullName: string;
  testId?: string;
  status: string;
  startedAt?: string | null;
  expiresAt?: string | null;
  remainingSeconds?: number;
  timeExpired?: boolean;
  answeredCount: number;
  totalQuestions: number;
  linkedSessionId?: string | null;
}

export interface AdminTestAttemptsListResponse {
  success: boolean;
  testId: string;
  testTitle?: string;
  attempts: AdminTestAttemptListItem[];
  pagination: AdminListPagination;
  search: string;
}

export interface AdminSessionDetailResponse {
  success: boolean;
  session: Record<string, unknown>;
  studentFullName: string;
  stats?: Record<string, unknown> | null;
}

export interface AdminAttemptDetailItem {
  questionId: number;
  question?: Record<string, unknown> | null;
  studentAnswer?: Record<string, unknown> | null;
  answered: boolean;
}

export interface AdminAttemptDetailResponse {
  success: boolean;
  attempt: Record<string, unknown>;
  studentFullName: string;
  testTitle?: string;
  items: AdminAttemptDetailItem[];
}

export interface AdminListQuery {
  page?: number;
  limit?: number;
  search?: string;
}
