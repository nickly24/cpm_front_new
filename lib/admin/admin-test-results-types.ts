export interface StudentTestSession {
  id: string;
  testId: string;
  testTitle?: string | null;
  score?: number | null;
  completedAt?: string | null;
  timeSpentMinutes?: number | null;
}

export interface TestSessionStats {
  testTitle?: string;
  totalQuestions?: number;
  correctAnswers?: number;
  accuracy?: number;
  totalPoints?: number;
  timeSpentMinutes?: number;
  questionTypes?: Record<
    string,
    { count: number; correct: number; points: number }
  >;
}
