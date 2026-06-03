import { apiRequest } from "@/lib/api/client";
import type {
  AdminSchool,
  AdminSchoolDetailResponse,
  AdminSchoolFormData,
  AdminSchoolStudent,
  AdminSchoolStudentsResponse,
  AdminSchoolsListResponse,
  AdminUnassignedSchoolStudentsResponse,
} from "@/lib/admin/admin-schools-types";

export async function fetchAdminSchools(activeOnly = false): Promise<AdminSchool[]> {
  const qs = activeOnly ? "?active=1" : "";
  const data = await apiRequest<AdminSchoolsListResponse>(`/api/get-schools${qs}`);
  if (!data.status) {
    throw new Error(data.error || "Не удалось загрузить школы");
  }
  return Array.isArray(data.res) ? data.res : [];
}

export async function fetchAdminSchoolById(
  schoolId: number,
): Promise<AdminSchool | null> {
  const data = await apiRequest<AdminSchoolDetailResponse>(
    `/api/get-school/${schoolId}`,
  );
  return data.status ? data.school : null;
}

export async function createAdminSchool(
  payload: AdminSchoolFormData,
): Promise<{ status: boolean; school?: AdminSchool; error?: string }> {
  return apiRequest("/api/add-school", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      short_name: payload.short_name?.trim() || undefined,
      notes: payload.notes?.trim() || undefined,
    }),
  });
}

export async function updateAdminSchool(
  schoolId: number,
  payload: Partial<AdminSchoolFormData>,
): Promise<{ status: boolean; school?: AdminSchool; error?: string }> {
  return apiRequest("/api/edit-school", {
    method: "PUT",
    body: JSON.stringify({
      school_id: schoolId,
      ...payload,
    }),
  });
}

export async function fetchAdminSchoolStudents(
  schoolId: number,
): Promise<AdminSchoolStudent[]> {
  const data = await apiRequest<AdminSchoolStudentsResponse>(
    "/api/student-school-filter",
    {
      method: "POST",
      body: JSON.stringify({ school_id: schoolId }),
    },
  );
  return data.status && Array.isArray(data.res) ? data.res : [];
}

export async function fetchAdminUnassignedSchoolStudents(): Promise<
  AdminUnassignedSchoolStudentsResponse["unassigned_students"]
> {
  const data = await apiRequest<AdminUnassignedSchoolStudentsResponse>(
    "/api/get-unsigned-students-by-school",
  );
  return data.status ? data.unassigned_students : [];
}

export async function assignAdminStudentToSchool(
  studentId: number,
  schoolId: number,
): Promise<{ status: boolean }> {
  return apiRequest("/api/edit-student", {
    method: "PUT",
    body: JSON.stringify({ student_id: studentId, school_id: schoolId }),
  });
}

export async function removeAdminStudentFromSchool(
  studentId: number,
): Promise<{ status: boolean }> {
  return apiRequest("/api/edit-student", {
    method: "PUT",
    body: JSON.stringify({ student_id: studentId, school_id: null }),
  });
}

export async function searchAdminStudentsForSchool(
  query: string,
  limit = 20,
): Promise<
  {
    id: number;
    full_name: string;
    class: number;
    group_id: number | null;
    group_name: string | null;
    school_id: number | null;
    school_name: string | null;
  }[]
> {
  const qs = new URLSearchParams();
  qs.set("q", query.trim());
  qs.set("limit", String(limit));
  const data = await apiRequest<{
    status: boolean;
    students: {
      id: number;
      full_name: string;
      class: number;
      group_id: number | null;
      group_name: string | null;
      school_id: number | null;
      school_name: string | null;
    }[];
  }>(`/api/groups/search?${qs}`);
  return data.status && Array.isArray(data.students) ? data.students : [];
}
