import type { AnswerOptionId, QuestionType } from "./test-attempt-types";

export interface ReviewAnswerOption {
  id: AnswerOptionId;
  text: string;
  isCorrect?: boolean;
}

export interface ReviewQuestion {
  questionId: number;
  type: QuestionType;
  text: string;
  points?: number;
  answers?: ReviewAnswerOption[];
}

export interface ReviewStudentAnswer {
  type: QuestionType;
  questionId: number;
  selectedAnswer?: AnswerOptionId | null;
  selectedAnswers?: AnswerOptionId[];
  textAnswer?: string;
}

export interface ReviewCorrectPayload {
  correctAnswers?: string[];
  correctOptionIds?: AnswerOptionId[];
  answers?: ReviewAnswerOption[];
}

export interface ReviewItem {
  questionId: number;
  question: ReviewQuestion;
  studentAnswer: ReviewStudentAnswer | null;
  points: number;
  isCorrect: boolean;
  correct?: ReviewCorrectPayload;
}

export interface TestSessionReview {
  sessionId: string;
  testId: string;
  testTitle?: string;
  score?: number;
  completedAt?: string;
  timeSpentMinutes?: number;
  questionOrder: number[];
  visible: boolean;
  showCorrectAnswers: boolean;
  items: ReviewItem[];
}

export interface TestReviewResponse {
  success: boolean;
  review?: TestSessionReview;
  error?: string;
}
