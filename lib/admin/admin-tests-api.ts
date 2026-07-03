import { apiRequest } from "@/lib/api/client";
import type {
  AdminExternalTestDeletePreview,
  AdminExternalTestDeleteResponse,
  Direction,
} from "@/lib/admin/admin-tests-types";
import type {
  AdminExternalTestFormData,
  AdminTestDetail,
  AdminTestFormData,
  AdminTestListItem,
} from "@/lib/admin/admin-tests-types";

export async function fetchAdminDirections(): Promise<Direction[]> {
  return apiRequest<Direction[]>("/directions");
}

export async function fetchAdminTestsByDirection(
  directionName: string,
): Promise<AdminTestListItem[]> {
  return apiRequest<AdminTestListItem[]>(
    `/tests/${encodeURIComponent(directionName)}`,
  );
}

export async function fetchAdminTestById(
  testId: string,
): Promise<AdminTestDetail> {
  return apiRequest<AdminTestDetail>(`/test/${testId}`);
}

export async function createAdminTest(
  payload: AdminTestFormData,
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>("/create-test", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createExternalAdminTest(
  payload: AdminExternalTestFormData,
): Promise<{ success: boolean; test: AdminTestListItem }> {
  return apiRequest<{ success: boolean; test: AdminTestListItem }>(
    "/external-tests",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function updateAdminTest(
  testId: string,
  payload: AdminTestFormData,
): Promise<{ message: string; testId: string }> {
  return apiRequest<{ message: string; testId: string }>(`/test/${testId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminTest(testId: string): Promise<{
  message: string;
  deletedSessions: number;
}> {
  return apiRequest<{ message: string; deletedSessions: number }>(
    `/test/${testId}`,
    { method: "DELETE" },
  );
}

/** Частичное обновление полей теста (работает на проде без отдельных toggle-роутов). */
export async function patchAdminTestFields(
  testId: string,
  fields: { published?: boolean; visible?: boolean },
): Promise<{ message: string; testId: string }> {
  return apiRequest<{ message: string; testId: string }>(`/test/${testId}`, {
    method: "PUT",
    body: JSON.stringify(fields),
  });
}

export function getAdminTestId(test: AdminTestListItem): string {
  return String(test.id ?? "");
}

export function getAdminTestTitle(test: AdminTestListItem): string {
  return test.title || test.name || "Без названия";
}

export function isAdminExternalTest(test: AdminTestListItem): boolean {
  return Boolean(test.isExternal || test.externalTest);
}

export async function fetchExternalTestDeletePreview(
  testId: string,
): Promise<AdminExternalTestDeletePreview> {
  return apiRequest<AdminExternalTestDeletePreview>(
    `/external-tests/${encodeURIComponent(testId)}/delete-preview`,
  );
}

export async function deleteExternalAdminTest(
  testId: string,
): Promise<AdminExternalTestDeleteResponse> {
  return apiRequest<AdminExternalTestDeleteResponse>(
    `/external-tests/${encodeURIComponent(testId)}`,
    { method: "DELETE" },
  );
}
