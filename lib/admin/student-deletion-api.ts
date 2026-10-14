import { apiRequest } from "@/lib/api/client";
import type { StudentDeletionJob, StudentDeletionPreview } from "./student-deletion";

export function fetchStudentDeletionPreview(studentId: number) {
  return apiRequest<StudentDeletionPreview>(`/api/students/${studentId}/deletion-preview`, { cache: "no-store" });
}

export async function createStudentDeletionJob(studentId: number, confirmationToken: string, idempotencyKey: string) {
  const { job } = await apiRequest<{ job: StudentDeletionJob }>(`/api/students/${studentId}/deletion-jobs`, {
    method: "POST", body: JSON.stringify({ confirmation_token: confirmationToken, idempotency_key: idempotencyKey }),
  });
  return job;
}

export async function fetchStudentDeletionJob(jobId: string) {
  const { job } = await apiRequest<{ job: StudentDeletionJob }>(`/api/student-deletion-jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" });
  return job;
}

export async function fetchStudentDeletionJobs(studentId: number) {
  const { jobs } = await apiRequest<{ jobs: StudentDeletionJob[] }>(`/api/students/${studentId}/deletion-jobs`, { cache: "no-store" });
  return jobs;
}

export async function retryStudentDeletionJob(jobId: string) {
  const { job } = await apiRequest<{ job: StudentDeletionJob }>(`/api/student-deletion-jobs/${encodeURIComponent(jobId)}/retry`, { method: "POST" });
  return job;
}
