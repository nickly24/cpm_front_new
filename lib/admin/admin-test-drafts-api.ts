import { apiRequest } from "@/lib/api/client";
import type {
  AdminTestDraft,
  DraftPublishResponse,
} from "@/lib/admin/admin-test-drafts-types";

export async function fetchAdminTestDrafts(
  status = "active",
): Promise<AdminTestDraft[]> {
  return apiRequest<AdminTestDraft[]>(
    `/test-drafts?status=${encodeURIComponent(status)}`,
  );
}

export async function createAdminTestDraft(payload: Partial<AdminTestDraft> = {}) {
  return apiRequest<AdminTestDraft>("/test-drafts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createAdminTestDraftFromTest(testId: string) {
  return apiRequest<AdminTestDraft>(`/test-drafts/from-test/${testId}`, {
    method: "POST",
  });
}

export async function fetchAdminTestDraft(draftId: string) {
  return apiRequest<AdminTestDraft>(`/test-drafts/${draftId}`);
}

export async function updateAdminTestDraft(
  draftId: string,
  payload: Partial<AdminTestDraft>,
) {
  return apiRequest<AdminTestDraft>(`/test-drafts/${draftId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function lockAdminTestDraft(draftId: string, force = false) {
  return apiRequest<{ success: boolean; draft: AdminTestDraft }>(
    `/test-drafts/${draftId}/lock`,
    {
      method: "POST",
      body: JSON.stringify({ force }),
    },
  );
}

export async function unlockAdminTestDraft(draftId: string) {
  return apiRequest<{ success: boolean }>(`/test-drafts/${draftId}/unlock`, {
    method: "POST",
  });
}

export async function publishAdminTestDraft(draftId: string) {
  return apiRequest<DraftPublishResponse>(`/test-drafts/${draftId}/publish`, {
    method: "POST",
  });
}

export async function deleteAdminTestDraft(draftId: string) {
  return apiRequest<{ success: boolean }>(`/test-drafts/${draftId}`, {
    method: "DELETE",
  });
}
