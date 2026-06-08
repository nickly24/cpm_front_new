export type RatingRecalcStatus = "queued" | "running" | "completed" | "failed";

export interface AdminRatingRow {
  id: number;
  student_id: number;
  student_name: string;
  student_class: string | null;
  group_name: string | null;
  homework: number;
  exams: number;
  tests: number;
  final: number;
}

export interface RatingRecalcJob {
  id: number;
  status: RatingRecalcStatus;
  date_from: string;
  date_to: string;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_students: number;
  processed_count: number;
  successful: number;
  failed: number;
  skipped: number;
  message: string | null;
  errors: unknown;
  progress_percent: number;
}

export interface RatingHomeworkDetail {
  homework_id: number;
  name: string;
  deadline: string | null;
  score: number;
  status: string;
  date_pass: string | null;
}

export interface RatingExamDetail {
  exam_id: number;
  exam_name: string;
  exam_date: string | null;
  score: number;
  status: string;
}

export interface RatingTestDetail {
  direction: string;
  test_id: string;
  title: string;
  score: number;
  source: string;
}

export interface RatingDetails {
  rating_id: number;
  student_id: number;
  date_from: string;
  date_to: string;
  calculated_at?: string;
  final_rating: number;
  homework: { rating: number; details: RatingHomeworkDetail[] };
  exams: { rating: number; details: RatingExamDetail[] };
  tests: {
    rating: number;
    directions: Record<string, number>;
    details: RatingTestDetail[];
  };
}

export type AdminRatingsTab = "ratings" | "jobs";
