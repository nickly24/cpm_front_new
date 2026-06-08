import { apiRequest } from "@/lib/api/client";
import type {
  StudentTestSession,
  TestSessionStats,
} from "./admin-test-results-types";

export async function fetchStudentTestSessions(
  studentId: number,
): Promise<StudentTestSession[]> {
  const data = await apiRequest<StudentTestSession[]>(
    `/test-sessions/student/${studentId}`,
  );
  return Array.isArray(data) ? data : [];
}

export async function fetchTestSessionStats(
  sessionId: string,
): Promise<TestSessionStats> {
  return apiRequest<TestSessionStats>(
    `/test-session/${encodeURIComponent(sessionId)}/stats`,
  );
}
