import { apiRequest } from "@/lib/api/client";
import type {
  AdminHomeworkFormData,
  AdminHomeworkItem,
  AdminHomeworkListResponse,
  AdminHomeworkOverviewResponse,
  AdminHomeworkStudentsResponse,
} from "@/lib/admin/admin-homework-types";

export async function fetchAdminHomeworks(params: {
  page?: number;
  limit?: number;
  type?: string;
  search?: string;
}): Promise<AdminHomeworkListResponse> {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page ?? 1));
  qs.set("limit", String(params.limit ?? 10));
  if (params.type) qs.set("type", params.type);
  if (params.search?.trim()) qs.set("search", params.search.trim());
  return apiRequest<AdminHomeworkListResponse>(`/api/get-homeworks?${qs}`);
}

export async function fetchAdminHomeworkById(
  homeworkId: number,
): Promise<AdminHomeworkItem> {
  return apiRequest<AdminHomeworkItem>(`/api/homework/${homeworkId}`);
}

export async function fetchAdminHomeworkOverview(
  homeworkId: number,
): Promise<AdminHomeworkOverviewResponse> {
  return apiRequest<AdminHomeworkOverviewResponse>(
    `/api/homework/${homeworkId}/overview`,
  );
}

export async function fetchAdminHomeworkStudents(
  homeworkId: number,
  params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  },
): Promise<AdminHomeworkStudentsResponse> {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page ?? 1));
  qs.set("limit", String(params.limit ?? 10));
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.status && params.status !== "all") {
    qs.set("status", params.status);
  }
  return apiRequest<AdminHomeworkStudentsResponse>(
    `/api/homework/${homeworkId}/students?${qs}`,
  );
}

export async function createAdminHomework(
  payload: AdminHomeworkFormData,
): Promise<{ status: boolean; id?: number; homeworkId?: number }> {
  return apiRequest(`/api/create-homework`, {
    method: "POST",
    body: JSON.stringify({
      homeworkName: payload.name,
      homeworkType: payload.type,
      deadline: payload.deadline,
      published: payload.published,
    }),
  });
}

export async function updateAdminHomework(
  homeworkId: number,
  payload: Partial<AdminHomeworkFormData>,
): Promise<{ message: string; homeworkId: number }> {
  const body: Record<string, unknown> = {};
  if (payload.name !== undefined) body.name = payload.name;
  if (payload.type !== undefined) body.type = payload.type;
  if (payload.deadline !== undefined) body.deadline = payload.deadline;
  if (payload.published !== undefined) body.published = payload.published;
  return apiRequest(`/api/homework/${homeworkId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function patchAdminHomeworkPublished(
  homeworkId: number,
  published: boolean,
): Promise<{ message: string; homeworkId: number }> {
  return updateAdminHomework(homeworkId, { published });
}

export async function deleteAdminHomework(
  homeworkId: number,
): Promise<{ message: string; homeworkId: number }> {
  return apiRequest(`/api/homework/${homeworkId}`, { method: "DELETE" });
}

export function getAdminHomeworkId(hw: AdminHomeworkItem): number {
  return Number(hw.id);
}
