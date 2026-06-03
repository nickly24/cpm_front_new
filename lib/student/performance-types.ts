export interface StudentRatingCategory {
  rating: number;
}

export interface StudentRatingData {
  rating_id?: string;
  student_id?: number;
  date_from?: string;
  date_to?: string;
  calculated_at?: string;
  homework: StudentRatingCategory;
  exams: StudentRatingCategory;
  tests: StudentRatingCategory;
}

export interface MyRatingResponse {
  status: boolean;
  data: StudentRatingData | null;
  message?: string;
  error?: string;
}

export interface RatingMetric {
  id: "homework" | "exams" | "tests";
  label: string;
  description: string;
  value: number | null;
  accent: string;
  accentSoft: string;
}
