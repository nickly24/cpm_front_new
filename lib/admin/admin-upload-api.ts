import { apiFormRequest, apiRequest } from "@/lib/api/client";
import type {
  ExternalTestOption,
  ExternalTestResultsImportPreview,
  ExternalTestResultsImportSession,
  CardImportPreview,
  CardImportSession,
  CardTransformPreview,
  UserImportJob,
  UserImportPreview,
  UserImportReport,
  UserImportSession,
  TestImportCommitResponse,
  TestImportPreviewResponse,
} from "@/lib/admin/admin-upload-types";

export async function parseUserImportFile(
  file: File,
): Promise<{ status: boolean; session_id: number; preview: UserImportPreview }> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFormRequest("/api/user-import/parse", formData);
}

export async function fetchUserImportSession(
  sessionId: number,
): Promise<UserImportSession> {
  return apiRequest(`/api/user-import/sessions/${sessionId}`);
}

export async function updateUserImportSession(
  sessionId: number,
  preview: UserImportPreview,
): Promise<UserImportSession> {
  return apiRequest(`/api/user-import/sessions/${sessionId}`, {
    method: "PUT",
    body: JSON.stringify({ preview }),
  });
}

export async function commitUserImportSession(sessionId: number): Promise<{
  status: boolean;
  message?: string;
  job: UserImportJob;
}> {
  return apiRequest(`/api/user-import/sessions/${sessionId}/commit`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchUserImportJobs(limit = 50): Promise<{
  status: boolean;
  jobs: UserImportJob[];
  active_job_id: number | null;
  has_active: boolean;
}> {
  return apiRequest(`/api/user-import/jobs?limit=${limit}`);
}

export async function fetchUserImportJob(jobId: number): Promise<{
  status: boolean;
  job: UserImportJob;
}> {
  return apiRequest(`/api/user-import/jobs/${jobId}`);
}

export async function fetchUserImportReport(jobId: number): Promise<{
  status: boolean;
  report: UserImportReport;
}> {
  return apiRequest(`/api/user-import/jobs/${jobId}/report`);
}

export async function fetchExternalTests(): Promise<ExternalTestOption[]> {
  return apiRequest("/external-tests");
}

export async function parseExternalTestResultsFile(
  file: File,
  testId: string | number,
): Promise<{
  status: boolean;
  session_id: number;
  preview: ExternalTestResultsImportPreview;
}> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("test_id", String(testId));
  return apiFormRequest("/api/external-test-results-import/parse", formData);
}

export async function fetchExternalTestResultsSession(
  sessionId: number,
): Promise<ExternalTestResultsImportSession> {
  return apiRequest(`/api/external-test-results-import/sessions/${sessionId}`);
}

export async function updateExternalTestResultsSession(
  sessionId: number,
  preview: ExternalTestResultsImportPreview,
): Promise<ExternalTestResultsImportSession> {
  return apiRequest(`/api/external-test-results-import/sessions/${sessionId}`, {
    method: "PUT",
    body: JSON.stringify({ preview }),
  });
}

export async function commitExternalTestResultsSession(sessionId: number): Promise<{
  status: boolean;
  message?: string;
  job: UserImportJob;
}> {
  return apiRequest(`/api/external-test-results-import/sessions/${sessionId}/commit`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function parseCardImportFile(
  file: File,
  directionId: number,
  options: {
    themeId?: number | null;
    createNewTheme?: boolean;
    newThemeName?: string;
  },
): Promise<{
  status: boolean;
  session_id: number;
  preview: CardImportPreview;
}> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("direction_id", String(directionId));
  if (options.createNewTheme) {
    formData.append("create_new_theme", "1");
    formData.append("new_theme_name", options.newThemeName?.trim() || "");
  } else if (options.themeId != null) {
    formData.append("theme_id", String(options.themeId));
  }
  return apiFormRequest("/api/card-import/parse", formData);
}

export async function updateCardImportSession(
  sessionId: number,
  preview: CardImportPreview,
): Promise<CardImportSession> {
  return apiRequest(`/api/card-import/sessions/${sessionId}`, {
    method: "PUT",
    body: JSON.stringify({ preview }),
  });
}

export async function commitCardImportSession(sessionId: number): Promise<{
  status: boolean;
  message?: string;
  job: UserImportJob;
}> {
  return apiRequest(`/api/card-import/sessions/${sessionId}/commit`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function createCardTransformSession(
  themeId: number,
  cardIds: number[],
): Promise<{
  status: boolean;
  session_id: number;
  preview: CardTransformPreview;
}> {
  return apiRequest("/api/card-transform/sessions", {
    method: "POST",
    body: JSON.stringify({ theme_id: themeId, card_ids: cardIds }),
  });
}

export async function commitCardTransformSession(sessionId: number): Promise<{
  status: boolean;
  message?: string;
  job: UserImportJob;
}> {
  return apiRequest(`/api/card-transform/sessions/${sessionId}/commit`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function previewTestImport(
  payload: unknown,
): Promise<TestImportPreviewResponse> {
  return apiRequest("/api/test-import/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function commitTestImport(
  payload: unknown,
): Promise<TestImportCommitResponse> {
  return apiRequest("/api/test-import/commit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
