import { BFF_DEV } from "@/lib/config";
import { getIdentity } from "@/lib/bff/client";
import { coreCan, coreSchool, coreSchools, coreUsers, mapCoreStudent, saveCoreSchool, updateCoreUser } from "@/lib/bff/core-admin";
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
  if (BFF_DEV) { const [schools,students]=await Promise.all([coreSchools(),coreCan("users")&&getIdentity()?.user.division_id?coreUsers("student"):Promise.resolve(null)]); return schools.filter(s=>!activeOnly||s.is_active).map(s=>({...s,student_count:students?students.filter(u=>u.school_id===s.school_id).length:undefined})); }
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
  if (BFF_DEV) return coreSchool(schoolId);
  const data = await apiRequest<AdminSchoolDetailResponse>(
    `/api/get-school/${schoolId}`,
  );
  return data.status ? data.school : null;
}

export async function createAdminSchool(
  payload: AdminSchoolFormData,
): Promise<{ status: boolean; school?: AdminSchool; error?: string }> {
  if (BFF_DEV) return {status:true,school:await saveCoreSchool(null,{...payload,short_name:payload.short_name??"",notes:payload.notes??""})};
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
  if (BFF_DEV) return {status:true,school:await saveCoreSchool(schoolId,payload)};
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
  if (BFF_DEV) return (await coreUsers("student")).filter(s=>s.school_id===schoolId).map(s=>({id:s.account_id,full_name:s.full_name,class:s.class??undefined,group_id:s.group_id,school_id:s.school_id}));
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
  if (BFF_DEV) return (await coreUsers("student")).filter(s=>s.school_id===null).map(s=>({student_id:s.account_id,full_name:s.full_name,class:s.class??undefined,group_id:s.group_id}));
  const data = await apiRequest<AdminUnassignedSchoolStudentsResponse>(
    "/api/get-unsigned-students-by-school",
  );
  return data.status ? data.unassigned_students : [];
}

export async function assignAdminStudentToSchool(
  studentId: number,
  schoolId: number,
): Promise<{ status: boolean }> {
  if (BFF_DEV) {await updateCoreUser(studentId,{school_id:schoolId});return {status:true};}
  return apiRequest("/api/edit-student", {
    method: "PUT",
    body: JSON.stringify({ student_id: studentId, school_id: schoolId }),
  });
}

export async function removeAdminStudentFromSchool(
  studentId: number,
): Promise<{ status: boolean }> {
  if (BFF_DEV) {await updateCoreUser(studentId,{school_id:null});return {status:true};}
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
    class: number | null;
    group_id: number | null;
    group_name: string | null;
    school_id: number | null;
    school_name: string | null;
  }[]
> {
  if (BFF_DEV) {const [rows,schools]=await Promise.all([coreUsers("student"),coreSchools()]);const q=query.trim().toLowerCase();return rows.filter(s=>s.full_name.toLowerCase().includes(q)||s.login.toLowerCase().includes(q)||String(s.account_id).includes(q)).slice(0,limit).map(s=>{const m=mapCoreStudent(s,schools);return {id:m.id,full_name:m.full_name,class:m.class,group_id:m.group_id,group_name:null,school_id:m.school_id??null,school_name:m.school_name??null};});}
  const qs = new URLSearchParams();
  qs.set("q", query.trim());
  qs.set("limit", String(limit));
  const data = await apiRequest<{
    status: boolean;
    students: {
      id: number;
      full_name: string;
      class: number | null;
      group_id: number | null;
      group_name: string | null;
      school_id: number | null;
      school_name: string | null;
    }[];
  }>(`/api/groups/search?${qs}`);
  return data.status && Array.isArray(data.students) ? data.students : [];
}
