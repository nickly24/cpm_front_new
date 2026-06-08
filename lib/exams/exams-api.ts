import { apiRequest } from "@/lib/api/client";
import type {
  ExamsListResponse,
  ExamSessionsResponse,
  FetchExamSessionsParams,
  FetchExamsParams,
  FetchStudentExamSessionsParams,
} from "./exams-types";

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue;
    }
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function fetchExamsPaginated(
  params: FetchExamsParams,
): Promise<ExamsListResponse> {
  return apiRequest<ExamsListResponse>(
    `/get-all-exams${buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      sort: params.sort,
    })}`,
  );
}

export async function fetchExamSessionsByExamPaginated(
  examId: number,
  params: FetchExamSessionsParams,
): Promise<ExamSessionsResponse> {
  return apiRequest<ExamSessionsResponse>(
    `/get-exam-sessions/${examId}${buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      sort: params.sort,
    })}`,
  );
}

export async function fetchStudentExamSessionsPaginated(
  studentId: number,
  params: FetchStudentExamSessionsParams,
): Promise<ExamSessionsResponse> {
  return apiRequest<ExamSessionsResponse>(
    `/get-student-exam-sessions/${studentId}${buildQuery({
      page: params.page,
      limit: params.limit,
      grade: params.grade === "all" ? undefined : params.grade,
      sort: params.sort,
    })}`,
  );
}
