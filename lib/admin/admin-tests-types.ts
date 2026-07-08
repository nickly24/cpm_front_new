import type { Direction } from "@/lib/student/tests-types";

export type { Direction };

export type AdminTestStatus = "active" | "upcoming" | "ended" | "external";

export type AdminTestStatusFilter = "all" | AdminTestStatus;

export interface AdminTestListItem {
  id: string;
  title?: string;
  name?: string;
  startDate?: string | null;
  endDate?: string | null;
  date?: string | null;
  timeLimitMinutes?: number | null;
  visible?: boolean;
  published?: boolean;
  isExternal?: boolean;
  externalTest?: boolean;
}

export type AdminTestQuestionType = "single" | "multiple" | "text";

export interface AdminTestAnswer {
  id: string;
  text: string;
  isCorrect: boolean;
  pointValue?: number;
}

export interface AdminTestQuestion {
  questionId: number;
  type: AdminTestQuestionType;
  text: string;
  points: number;
  answers: AdminTestAnswer[];
  correctAnswers: string[];
}

export interface AdminTestFormData {
  title: string;
  direction: string;
  startDate: string;
  endDate: string;
  timeLimitMinutes: number;
  questions: AdminTestQuestion[];
  visible: boolean;
  published: boolean;
}

export interface AdminExternalTestFormData {
  name: string;
  direction_id: number;
  date: string;
}

export interface AdminTestDetail extends AdminTestFormData {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
}

export type AdminTestChangeEventType =
  | "question_added"
  | "question_removed"
  | "question_updated"
  | "question_reordered"
  | "metadata_updated";

export interface AdminTestChangeActor {
  userId?: number | null;
  role?: string | null;
  fullName?: string | null;
}

export interface AdminTestChangeLogItem {
  id: string;
  testId: string;
  questionId: number | null;
  changeKey: string;
  eventType: AdminTestChangeEventType;
  actor: AdminTestChangeActor;
  changedAt: string;
  revision: number;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: Record<string, unknown>;
  context?: { source?: string };
}

export interface AdminTestChangesPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface AdminTestChangesResponse {
  success: boolean;
  items: AdminTestChangeLogItem[];
  pagination: AdminTestChangesPagination;
}

export interface AdminTestChangeCommit {
  id: string;
  changedAt: string;
  actorName: string;
  source?: string;
  events: AdminTestChangeLogItem[];
}

export type AdminTestsView =
  | "list"
  | "create"
  | "createExternal"
  | "edit"
  | "view"
  | "workspace"
  | "draftEditor";

export interface TestsDateFilter {
  startDate: string;
  endDate: string;
}

export interface AdminExternalTestDeletePreview {
  test: AdminTestListItem;
  resultsCount: number;
}

export interface AdminExternalTestDeleteResponse {
  message: string;
  testId: string;
  resultsDeleted: number;
}
