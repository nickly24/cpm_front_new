import { apiRequest } from "@/lib/api/client";
import type {
  ProctorEditSessionResponse,
  ProctorGroupStudentsResponse,
  ProctorHomeworkListResponse,
  ProctorHomeworkSessionsResponse,
  ProctorPassHomeworkBulkResponse,
  ProctorPassHomeworkResponse,
} from "./proctor-types";

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function fetchProctorHomeworks(options?: {
  type?: string;
  page?: number;
  limit?: number;
}): Promise<ProctorHomeworkListResponse> {
  return apiRequest<ProctorHomeworkListResponse>(
    `/api/get-homeworks${buildQuery({
      type: options?.type,
      page: options?.page ?? 1,
      limit: options?.limit ?? 100,
    })}`,
  );
}

export async function fetchProctorGroupStudents(
  groupId: number,
): Promise<ProctorGroupStudentsResponse> {
  return apiRequest<ProctorGroupStudentsResponse>("/api/student-group-filter", {
    method: "POST",
    body: JSON.stringify({ id: groupId }),
  });
}

export async function fetchProctorHomeworkSessions(
  proctorId: number,
  homeworkId: number,
): Promise<ProctorHomeworkSessionsResponse> {
  return apiRequest<ProctorHomeworkSessionsResponse>(
    "/api/get-homework-sessions",
    {
      method: "POST",
      body: JSON.stringify({ proctorId, homeworkId }),
    },
  );
}

export async function passProctorHomework(payload: {
  sessionId: number | null;
  datePass: string;
  studentId: number;
  homeworkId: number;
  result?: number;
}): Promise<ProctorPassHomeworkResponse> {
  return apiRequest<ProctorPassHomeworkResponse>("/api/pass_homework", {
    method: "POST",
    body: JSON.stringify({
      sessionId: payload.sessionId,
      datePass: payload.datePass,
      studentId: payload.studentId,
      homeworkId: payload.homeworkId,
      result: payload.result,
    }),
  });
}

export async function passProctorHomeworkBulk(payload: {
  proctorId: number;
  homeworkId: number;
  datePass: string;
  result?: number;
}): Promise<ProctorPassHomeworkBulkResponse> {
  return apiRequest<ProctorPassHomeworkBulkResponse>("/api/pass_homework_bulk", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function editProctorHomeworkSession(payload: {
  sessionId?: number | null;
  studentId?: number;
  homeworkId?: number;
  datePass?: string;
  result?: number;
  status?: number;
}): Promise<ProctorEditSessionResponse> {
  return apiRequest<ProctorEditSessionResponse>("/api/edit-homework-session", {
    method: "POST",
    body: JSON.stringify({
      sessionId: payload.sessionId ?? undefined,
      studentId: payload.studentId,
      homeworkId: payload.homeworkId,
      datePass: payload.datePass,
      result: payload.result,
      status: payload.status,
    }),
  });
}
