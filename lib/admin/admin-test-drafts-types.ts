import type { AdminTestQuestionType, Direction } from "@/lib/admin/admin-tests-types";

export type { Direction };

export type DraftAnswerKind = "answer" | "textAnswer";
export type DraftStatus = "active" | "archived";
export type AutosaveState = "saved" | "saving" | "error";

export interface DraftAnswerNode {
  id: string;
  kind: DraftAnswerKind;
  text: string;
  isCorrect: boolean;
}

export interface DraftQuestionNode {
  id: string;
  type: AdminTestQuestionType;
  text: string;
  points: number;
  answers: DraftAnswerNode[];
}

export interface DraftCanvasModel {
  questions: DraftQuestionNode[];
  layout: Record<string, { x: number; y: number }>;
}

export interface AdminTestDraft {
  id: string;
  title: string;
  direction: string;
  startDate: string;
  endDate: string;
  timeLimitMinutes: number;
  published: boolean;
  visible: boolean;
  canvas: DraftCanvasModel;
  status: DraftStatus;
  source?: {
    kind?: string;
    themeId?: number;
    themeName?: string;
    cardIds?: number[];
  } | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: number | null;
  createdByName?: string | null;
  updatedBy?: number | null;
  updatedByName?: string | null;
  publishedTestId?: string | null;
  lockedBy?: number | null;
  lockedByName?: string | null;
  lockedUntil?: string | null;
}

export interface DraftValidationError {
  targetId: string;
  message: string;
  severity?: "error" | "warning";
}

export interface DraftPublishResponse {
  success: boolean;
  testId?: string;
  draft?: AdminTestDraft;
  error?: string;
  errors?: DraftValidationError[];
}

export interface DraftClipboardPayload {
  source: "cpm-test-draft-editor";
  questions?: DraftQuestionNode[];
  answers?: DraftAnswerNode[];
}
