export type QuestionType = "single" | "multiple" | "text";
export type AnswerOptionId = string;

export interface AttemptAnswerOption {
  id: AnswerOptionId;
  text: string;
}

export interface AttemptQuestion {
  questionId: number;
  type: QuestionType;
  text: string;
  points?: number;
  answers?: AttemptAnswerOption[];
  locked: boolean;
}

export interface StoredAttemptAnswer {
  questionId: number;
  type: QuestionType;
  selectedAnswer?: AnswerOptionId;
  selectedAnswers?: AnswerOptionId[];
  textAnswer?: string;
}

export interface TestAttempt {
  attemptId: string;
  studentId?: number;
  testId: string;
  status: string;
  isPractice?: boolean;
  startedAt?: string;
  expiresAt?: string;
  remainingSeconds: number;
  timeExpired: boolean;
  questionOrder: number[];
  questions: AttemptQuestion[];
  answers: StoredAttemptAnswer[];
  answeredCount: number;
  totalQuestions: number;
  schemaVersion?: number;
  testVersionId?: string;
  serverNowMoscow?: string;
  serverNowEpochMs?: number;
  startedAtMoscow?: string;
  startedAtEpochMs?: number;
  answerDeadlineMoscow?: string;
  answerDeadlineEpochMs?: number;
  uploadDeadlineMoscow?: string;
  uploadDeadlineEpochMs?: number;
}

export interface AttemptEnvelope {
  success: boolean;
  resumed?: boolean;
  attempt?: TestAttempt | null;
  error?: string;
  message?: string;
}

export interface SubmitAttemptResponse {
  success: boolean;
  isPractice?: boolean;
  sessionId?: string;
  score?: number;
  timeSpentMinutes?: number;
  stats?: {
    correctAnswers?: number;
    totalQuestions?: number;
    accuracy?: number;
    totalPoints?: number;
  };
  answers?: Array<StoredAttemptAnswer & { points?: number; isCorrect?: boolean }>;
  error?: string;
  existingSessionId?: string;
  existingScore?: number;
}

export type AnswerDraft =
  | { type: "single"; selectedAnswer: AnswerOptionId | null }
  | { type: "multiple"; selectedAnswers: AnswerOptionId[] }
  | { type: "text"; textAnswer: string };
