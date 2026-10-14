import { BFF_DEV } from "@/lib/config";
import * as bffTests from "@/lib/bff/tests-admin";
import { apiRequest } from "@/lib/api/client";
import type {
  AdminAttemptDetailResponse,
  AdminListQuery,
  AdminSessionDetailResponse,
  AdminTestAttemptsListResponse,
  AdminTestOverviewResponse,
  AdminTestSessionsListResponse,
} from "@/lib/admin/admin-tests-monitoring-types";

const DEFAULT_LIMIT = 10;

function buildQuery(
  params: AdminListQuery & { status?: string },
): string {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  q.set("limit", String(params.limit ?? DEFAULT_LIMIT));
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.status) q.set("status", params.status);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function fetchAdminTestOverview(
  testId: string,
): Promise<AdminTestOverviewResponse> {
  if(BFF_DEV)return bffTests.testsOverview(testId);
  return apiRequest<AdminTestOverviewResponse>(`/test/${testId}/overview`);
}

export async function fetchAdminTestSessions(
  testId: string,
  params: AdminListQuery = {},
): Promise<AdminTestSessionsListResponse> {
  if(BFF_DEV)return bffTests.testsSessions(testId,params);
  return apiRequest<AdminTestSessionsListResponse>(
    `/test/${testId}/sessions${buildQuery(params)}`,
  );
}

export async function fetchAdminTestAttempts(
  testId: string,
  params: AdminListQuery & { status?: string } = {},
): Promise<AdminTestAttemptsListResponse> {
  if(BFF_DEV)return bffTests.testsAttempts(testId,params);
  return apiRequest<AdminTestAttemptsListResponse>(
    `/test/${testId}/attempts${buildQuery({ ...params, status: params.status ?? "active" })}`,
  );
}

export async function fetchAdminSessionDetail(
  sessionId: string,
): Promise<AdminSessionDetailResponse> {
  if(BFF_DEV)return bffTests.testsSessionDetail(sessionId);
  return apiRequest<AdminSessionDetailResponse>(
    `/test-session/${sessionId}/admin`,
  );
}

export async function fetchAdminAttemptDetail(
  attemptId: string,
): Promise<AdminAttemptDetailResponse> {
  if(BFF_DEV)return bffTests.testsAttemptDetail(attemptId);
  return apiRequest<AdminAttemptDetailResponse>(
    `/test-attempt/${attemptId}/admin`,
  );
}

export async function deleteAdminSession(
  sessionId: string,
): Promise<{ success: boolean; message?: string }> {
  if(BFF_DEV)return bffTests.testsResetSubmission(sessionId);
  return apiRequest(`/test-session/${sessionId}`, { method: "DELETE" });
}

export async function deleteAdminAttempt(
  attemptId: string,
): Promise<{ success: boolean; message?: string }> {
  if(BFF_DEV)return bffTests.testsResetAttempt(attemptId);
  return apiRequest(`/test-attempt/${attemptId}`, { method: "DELETE" });
}

export async function forceSubmitAdminAttempt(
  attemptId: string,
): Promise<{ success: boolean; message?: string; sessionId?: string; score?: number }> {
  if(BFF_DEV)return bffTests.testsForceSubmit(attemptId);
  return apiRequest(`/test-attempt/${attemptId}/admin/submit`, {
    method: "POST",
  });
}
