import { apiRequest } from "@/lib/api/client";
import type {
  AdminGroupMembersResponse,
  AdminGroupsOverviewResponse,
  AdminGroupsSearchResponse,
  AdminGroupItem,
  AdminStaffAddResponse,
  AdminStaffFormData,
  AdminStaffResetPasswordResponse,
  AdminStaffRole,
  AdminStaffUser,
  AdminStudent,
  AdminStudentAddResponse,
  AdminStudentFormData,
  AdminUnsignedUsersResponse,
} from "@/lib/admin/admin-users-types";

interface StudentsListResponse {
  status: boolean;
  res: AdminStudent[];
  error?: string;
}

interface UsersByRoleResponse {
  status: boolean;
  res: AdminStaffUser[];
}

interface GroupsListResponse {
  status: boolean;
  res: { group_id: number; group_name: string }[];
}

export async function fetchAdminStudents(): Promise<AdminStudent[]> {
  const data = await apiRequest<StudentsListResponse>("/api/get-students");
  if (!data.status) {
    throw new Error(data.error || "Не удалось загрузить учеников");
  }
  if (!Array.isArray(data.res)) {
    return [];
  }
  return data.res.map((row) => ({
    id: row.student_id ?? row.id,
    full_name: row.full_name,
    class: row.class,
    group_id: row.group_id ?? null,
    school_id: row.school_id ?? null,
    school_name: row.school_name ?? null,
    school_short_name: row.school_short_name ?? null,
    tg_name: row.tg_name ?? null,
    login: row.login ?? null,
    password: row.password ?? null,
    password_hidden: row.password_hidden ?? false,
  }));
}

export async function fetchAdminStaff(role: AdminStaffRole): Promise<AdminStaffUser[]> {
  const data = await apiRequest<UsersByRoleResponse>("/api/get-users-by-role", {
    method: "POST",
    body: JSON.stringify({ role }),
  });
  return data.status && Array.isArray(data.res) ? data.res : [];
}

export async function addAdminStaffUser(
  role: AdminStaffRole,
  payload: AdminStaffFormData,
): Promise<AdminStaffAddResponse> {
  return apiRequest<AdminStaffAddResponse>("/api/add-staff-user", {
    method: "POST",
    body: JSON.stringify({
      role,
      full_name: payload.full_name,
      group_id: payload.group_id ?? undefined,
    }),
  });
}

export async function editAdminStaffUser(payload: {
  role: AdminStaffRole;
  user_id: number;
  full_name?: string;
  group_id?: number | null;
  login?: string;
}): Promise<{ status: boolean; user_data?: AdminStaffUser; error?: string }> {
  return apiRequest("/api/edit-staff-user", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function resetAdminStaffPassword(
  role: AdminStaffRole,
  userId: number,
): Promise<AdminStaffResetPasswordResponse> {
  return apiRequest<AdminStaffResetPasswordResponse>("/api/reset-staff-password", {
    method: "POST",
    body: JSON.stringify({ role, user_id: userId }),
  });
}

export async function fetchAdminGroupsList(): Promise<AdminGroupItem[]> {
  const data = await apiRequest<GroupsListResponse>("/api/get-groups");
  return data.status && Array.isArray(data.res) ? data.res : [];
}

export async function fetchAdminGroupsOverview(params: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<AdminGroupsOverviewResponse> {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page ?? 1));
  qs.set("limit", String(params.limit ?? 12));
  if (params.search?.trim()) {
    qs.set("search", params.search.trim());
  }
  return apiRequest<AdminGroupsOverviewResponse>(`/api/groups/overview?${qs}`);
}

export async function fetchAdminGroupMembers(
  groupId: number,
): Promise<AdminGroupMembersResponse> {
  return apiRequest<AdminGroupMembersResponse>(`/api/groups/${groupId}/members`);
}

export async function searchAdminGroupsAndMembers(
  query: string,
  limit = 30,
): Promise<AdminGroupsSearchResponse> {
  const qs = new URLSearchParams();
  qs.set("q", query.trim());
  qs.set("limit", String(limit));
  return apiRequest<AdminGroupsSearchResponse>(`/api/groups/search?${qs}`);
}

export async function fetchAdminUnsignedUsers(): Promise<AdminUnsignedUsersResponse> {
  return apiRequest<AdminUnsignedUsersResponse>("/api/get-unsigned-proctors-students");
}

export async function addAdminStudent(
  payload: AdminStudentFormData,
): Promise<AdminStudentAddResponse> {
  return apiRequest<AdminStudentAddResponse>("/api/add-student", {
    method: "POST",
    body: JSON.stringify({
      full_name: payload.full_name,
      class: payload.class,
      tg_name: payload.tg_name?.trim() || undefined,
    }),
  });
}

export async function editAdminStudent(payload: {
  student_id: number;
  full_name?: string;
  class?: number;
  group_id?: number | null;
  tg_name?: string | null;
  login?: string;
  password?: string;
}): Promise<{ status: boolean; student_data?: AdminStudent; error?: string }> {
  return apiRequest("/api/edit-student", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminUser(
  role: AdminStaffRole | "student",
  userId: number,
): Promise<{ status: boolean }> {
  return apiRequest("/api/delete-user", {
    method: "POST",
    body: JSON.stringify({ role, userId }),
  });
}

export async function assignAdminStudentToGroup(
  studentId: number,
  groupId: number,
): Promise<{ status: boolean }> {
  return apiRequest("/api/change-group-student", {
    method: "POST",
    body: JSON.stringify({ studentId, groupId }),
  });
}

export async function removeAdminStudentFromGroup(
  studentId: number,
): Promise<{ status: boolean }> {
  return apiRequest("/api/remove-groupd-id-student", {
    method: "POST",
    body: JSON.stringify({ studentId }),
  });
}

export async function assignAdminProctorToGroup(
  proctorId: number,
  groupId: number,
): Promise<{ status: boolean }> {
  return apiRequest("/api/change-group-proctor", {
    method: "POST",
    body: JSON.stringify({ proctorId, groupId }),
  });
}

export async function removeAdminProctorFromGroup(
  proctorId: number,
): Promise<{ status: boolean }> {
  return apiRequest("/api/remove-groupd-id-proctor", {
    method: "POST",
    body: JSON.stringify({ proctorId }),
  });
}

export async function createAdminGroup(
  name: string,
): Promise<{ status: boolean; group?: AdminGroupItem; error?: string }> {
  return apiRequest("/api/add-group", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateAdminGroup(
  groupId: number,
  name: string,
): Promise<{ status: boolean; group?: AdminGroupItem; error?: string }> {
  return apiRequest("/api/edit-group", {
    method: "PUT",
    body: JSON.stringify({ groupId, name }),
  });
}

export async function deleteAdminGroup(
  groupId: number,
): Promise<{
  status: boolean;
  students_unlinked?: number;
  proctors_unlinked?: number;
  error?: string;
}> {
  return apiRequest("/api/delete-group", {
    method: "POST",
    body: JSON.stringify({ groupId }),
  });
}
