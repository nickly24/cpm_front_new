import { BFF_DEV } from "@/lib/config";
import * as bffTests from "@/lib/bff/tests-admin";
import { apiRequest } from "@/lib/api/client";
import type {
  AdminTestDraft,
  DraftPublishResponse,
} from "@/lib/admin/admin-test-drafts-types";

export async function fetchAdminTestDrafts(
  status = "active",
): Promise<AdminTestDraft[]> {
  if(BFF_DEV)return bffTests.testsDrafts(status);
  return apiRequest<AdminTestDraft[]>(
    `/test-drafts?status=${encodeURIComponent(status)}`,
  );
}

export async function createAdminTestDraft(payload: Partial<AdminTestDraft> = {}) {
  if(BFF_DEV)return bffTests.testsDraftCreate(payload);
  return apiRequest<AdminTestDraft>("/test-drafts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createAdminTestDraftFromTest(testId: string) {
  if(BFF_DEV)return bffTests.testsDraftFromTest(testId);
  return apiRequest<AdminTestDraft>(`/test-drafts/from-test/${testId}`, {
    method: "POST",
  });
}

export async function fetchAdminTestDraft(draftId: string) {
  if(BFF_DEV)return bffTests.testsDraft(draftId);
  return apiRequest<AdminTestDraft>(`/test-drafts/${draftId}`);
}

export async function updateAdminTestDraft(
  draftId: string,
  payload: Partial<AdminTestDraft>,
) {
  if(BFF_DEV)return bffTests.testsDraftUpdate(draftId,payload);
  return apiRequest<AdminTestDraft>(`/test-drafts/${draftId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function lockAdminTestDraft(draftId: string, force = false) {
  if(BFF_DEV)return bffTests.testsDraftLock(draftId);
  return apiRequest<{ success: boolean; draft: AdminTestDraft }>(
    `/test-drafts/${draftId}/lock`,
    {
      method: "POST",
      body: JSON.stringify({ force }),
    },
  );
}

export async function unlockAdminTestDraft(draftId: string) {
  if(BFF_DEV)return bffTests.testsDraftUnlock(draftId);
  return apiRequest<{ success: boolean }>(`/test-drafts/${draftId}/unlock`, {
    method: "POST",
  });
}

export async function publishAdminTestDraft(draftId: string) {
  if(BFF_DEV)return bffTests.testsDraftPublish(draftId);
  return apiRequest<DraftPublishResponse>(`/test-drafts/${draftId}/publish`, {
    method: "POST",
  });
}

export async function deleteAdminTestDraft(draftId: string) {
  if(BFF_DEV)return bffTests.testsDraftArchive(draftId);
  return apiRequest<{ success: boolean }>(`/test-drafts/${draftId}`, {
    method: "DELETE",
  });
}
