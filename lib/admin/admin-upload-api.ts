import { apiFormRequest, apiRequest } from "@/lib/api/client";
import type {
  UserImportJob,
  UserImportPreview,
  UserImportReport,
  UserImportSession,
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
