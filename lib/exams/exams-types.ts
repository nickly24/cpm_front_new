export interface ExamPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Exam {
  id: number;
  name: string;
  date: string | null;
  sessions_count?: number;
}

export interface ExamsListResponse {
  status: boolean;
  exams?: Exam[];
  pagination?: ExamPagination;
  error?: string;
}

export interface ExamSession {
  id: number;
  points: number;
  grade: number;
  examinator: string | null;
  exam_id: number;
  exam_name: string;
  exam_date: string | null;
  student_id?: number;
  student_name?: string;
}

export interface ExamSessionsSummary {
  count: number;
  averageGrade: number;
  totalPoints: number;
}

export interface ExamSessionsResponse {
  status: boolean;
  sessions?: ExamSession[];
  pagination?: ExamPagination;
  summary?: ExamSessionsSummary;
  error?: string;
}

export type ExamSortField = "date" | "name";

export type ExamSessionSortField = "student_name" | "grade" | "points";

export type StudentExamSortField = "exam_date" | "grade" | "points";

export type ExamGradeFilter = "all" | "5" | "4" | "3" | "2";

export interface FetchExamsParams {
  page: number;
  limit: number;
  search?: string;
  sort?: ExamSortField;
}

export interface FetchExamSessionsParams {
  page: number;
  limit: number;
  search?: string;
  sort?: ExamSessionSortField;
}

export interface FetchStudentExamSessionsParams {
  page: number;
  limit: number;
  grade?: ExamGradeFilter;
  sort?: StudentExamSortField;
}
