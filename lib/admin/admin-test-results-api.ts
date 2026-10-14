import { BFF_DEV } from "@/lib/config";
import * as bffTests from "@/lib/bff/tests-admin";
import { apiRequest } from "@/lib/api/client";
import type {
  StudentTestSession,
  TestSessionStats,
} from "./admin-test-results-types";

export async function fetchStudentTestSessions(
  studentId: number,
): Promise<StudentTestSession[]> {
  if(BFF_DEV)return bffTests.testsStudentSessions(studentId);
  const data = await apiRequest<StudentTestSession[]>(
    `/test-sessions/student/${studentId}`,
  );
  return Array.isArray(data) ? data : [];
}

export async function fetchTestSessionStats(
  sessionId: string,
): Promise<TestSessionStats> {
  if(BFF_DEV)return bffTests.testsSessionStats(sessionId);
  return apiRequest<TestSessionStats>(
    `/test-session/${encodeURIComponent(sessionId)}/stats`,
  );
}
