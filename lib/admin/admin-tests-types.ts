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

export type AdminTestsView =
  | "list"
  | "create"
  | "createExternal"
  | "edit"
  | "view"
  | "workspace";

export interface TestsDateFilter {
  startDate: string;
  endDate: string;
}
