import { BFF_DEV } from "@/lib/config";
import { domain } from "@/lib/bff/client";
import { activateCoreUser, changeCoreGroup, coreCan, coreGroups, coreGroupMembers, coreSchools, coreUsers, coreUser, createCoreUser, generatedCorePassword, mapCoreGroup, mapCoreStaff, mapCoreStudent, saveCoreGroup, updateCoreUser } from "@/lib/bff/core-admin";
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
  if (BFF_DEV) { const [rows, schools] = await Promise.all([coreUsers("student"), coreSchools()]); return rows.map(row => mapCoreStudent(row, schools)); }
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
  if (BFF_DEV) { const [rows, groups] = await Promise.all([coreUsers(role), coreGroups()]); return rows.map(row => mapCoreStaff(row, groups)); }
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
  if (BFF_DEV) { const result = await createCoreUser({role, full_name:payload.full_name.trim(), class:0, tg_name:"", school_id:null, group_id:payload.group_id??null, role_id:payload.role_id??null, login:payload.login?.trim()??"",password:payload.password??""}); return {status:true,user_data:{id:result.account_id,full_name:payload.full_name,login:payload.login!,password:payload.password!,group_id:payload.group_id}}; }
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
  password?: string;
  role_id?: number | null;
}): Promise<{ status: boolean; user_data?: AdminStaffUser; error?: string }> {
  if (BFF_DEV) { const {user_id, role, ...patch}=payload; void role; await updateCoreUser(user_id,patch); return {status:true}; }
  return apiRequest("/api/edit-staff-user", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function resetAdminStaffPassword(
  role: AdminStaffRole,
  userId: number,
): Promise<AdminStaffResetPasswordResponse> {
  if (BFF_DEV) { const row=await coreUser(userId); const password=generatedCorePassword(); await updateCoreUser(userId,{password}); return {status:true,user_data:{id:userId,login:row.login,password}}; }
  return apiRequest<AdminStaffResetPasswordResponse>("/api/reset-staff-password", {
    method: "POST",
    body: JSON.stringify({ role, user_id: userId }),
  });
}

export async function fetchAdminGroupsList(): Promise<AdminGroupItem[]> {
  if (BFF_DEV) return (await coreGroups()).map(mapCoreGroup);
  const data = await apiRequest<GroupsListResponse>("/api/get-groups");
  return data.status && Array.isArray(data.res) ? data.res : [];
}

export async function fetchAdminGroupsOverview(params: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<AdminGroupsOverviewResponse> {
  if (BFF_DEV) {
    const all=await coreGroups(); const filtered=all.filter(g=>!params.search?.trim()||g.name.toLowerCase().includes(params.search.trim().toLowerCase()));
    const page=params.page??1,limit=params.limit??12; const selected=filtered.slice((page-1)*limit,page*limit);
    const res=await Promise.all(selected.map(async g=>{ const members= g.proctor_account_id ? await coreGroupMembers(g.id) : []; const proctor=members.find(u=>u.account_id===g.proctor_account_id); return {item:mapCoreGroup(g),student_count:g.student_count,proctor:{status:!!proctor,res:proctor?{proctor_id:proctor.account_id,full_name:proctor.full_name}:null}}; }));
    return {status:true,page,limit,total:filtered.length,pages:Math.max(1,Math.ceil(filtered.length/limit)),res};
  }
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
  if (BFF_DEV) { const [groups, members, schools] = await Promise.all([coreGroups(),coreGroupMembers(groupId),coreCan("users")||coreCan("schools")?coreSchools():Promise.resolve([])]); const group=groups.find(g=>g.id===groupId); if(!group)throw new Error("Группа не найдена"); const proctor=members.find(m=>m.role==="proctor"); return {status:true,item:mapCoreGroup(group),students:members.filter(m=>m.role==="student").map(m=>({id:m.account_id,full_name:m.full_name,class:m.class??undefined,school_name:schools.find(s=>s.school_id===m.school_id)?.name??(m.school_id?`#${m.school_id}`:null)})),proctor:{status:!!proctor,res:proctor?{proctor_id:proctor.account_id,full_name:proctor.full_name}:null}}; }
  return apiRequest<AdminGroupMembersResponse>(`/api/groups/${groupId}/members`);
}

export async function searchAdminGroupsAndMembers(
  query: string,
  limit = 30,
): Promise<AdminGroupsSearchResponse> {
  if (BFF_DEV) { const [groups,students,schools]=await Promise.all([coreGroups(),coreUsers("student"),coreSchools()]); const q=query.trim().toLowerCase(); return {status:true,query,groups:groups.filter(g=>g.name.toLowerCase().includes(q)).slice(0,limit).map(mapCoreGroup),students:students.filter(s=>s.full_name.toLowerCase().includes(q)||s.login.toLowerCase().includes(q)||String(s.account_id).includes(q)).slice(0,limit).map(s=>{const mapped=mapCoreStudent(s,schools,groups);return {id:mapped.id,full_name:mapped.full_name,class:mapped.class,group_id:mapped.group_id,group_name:mapped.group_name??null,school_id:mapped.school_id??null,school_name:mapped.school_name??null};})}; }
  const qs = new URLSearchParams();
  qs.set("q", query.trim());
  qs.set("limit", String(limit));
  return apiRequest<AdminGroupsSearchResponse>(`/api/groups/search?${qs}`);
}

export async function fetchAdminUnsignedUsers(): Promise<AdminUnsignedUsersResponse> {
  if (BFF_DEV && !coreCan("users")) return {status:true,unassigned_students:[],unassigned_proctors:[]};
  if (BFF_DEV) { const [students,proctors]=await Promise.all([coreUsers("student",undefined,true),coreUsers("proctor",undefined,true)]); return {status:true,unassigned_students:students.filter(s=>s.is_active===true||s.is_active===1).map(s=>({student_id:s.account_id,full_name:s.full_name,class:s.class??undefined,group_id:s.group_id})),unassigned_proctors:proctors.filter(s=>s.is_active===true||s.is_active===1).map(s=>({proctor_id:s.account_id,full_name:s.full_name}))}; }
  return apiRequest<AdminUnsignedUsersResponse>("/api/get-unsigned-proctors-students");
}

export async function addAdminStudent(
  payload: AdminStudentFormData,
): Promise<AdminStudentAddResponse> {
  if (BFF_DEV) { const result=await createCoreUser({role:"student",full_name:payload.full_name.trim(),class:payload.class,tg_name:payload.tg_name??"",school_id:null,group_id:null,role_id:null,login:payload.login?.trim()??"",password:payload.password??""}); return {status:true,student_data:{student_id:result.account_id,full_name:payload.full_name,class:payload.class,login:payload.login!,password:payload.password!,group_id:null,school_id:null,tg_name:payload.tg_name}}; }
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
  class?: number | null;
  group_id?: number | null;
  tg_name?: string | null;
  login?: string;
  password?: string;
}): Promise<{ status: boolean; student_data?: AdminStudent; error?: string }> {
  if (BFF_DEV) {const {student_id,...patch}=payload;await updateCoreUser(student_id,{...patch,tg_name:patch.tg_name===null?"":patch.tg_name});return {status:true};}
  return apiRequest("/api/edit-student", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminUser(
  role: AdminStaffRole | "student",
  userId: number,
): Promise<{ status: boolean }> {
  if (BFF_DEV) {await activateCoreUser(userId,false);return {status:true};}
  return apiRequest("/api/delete-user", {
    method: "POST",
    body: JSON.stringify({ role, userId }),
  });
}

export async function assignAdminStudentToGroup(
  studentId: number,
  groupId: number,
): Promise<{ status: boolean }> {
  if (BFF_DEV) {await changeCoreGroup(studentId,groupId);return {status:true};}
  return apiRequest("/api/change-group-student", {
    method: "POST",
    body: JSON.stringify({ studentId, groupId }),
  });
}

export async function removeAdminStudentFromGroup(
  studentId: number,
  currentGroupId?: number,
): Promise<{ status: boolean }> {
  if (BFF_DEV) {await changeCoreGroup(studentId,null,currentGroupId);return {status:true};}
  return apiRequest("/api/remove-groupd-id-student", {
    method: "POST",
    body: JSON.stringify({ studentId }),
  });
}

export async function assignAdminProctorToGroup(
  proctorId: number,
  groupId: number,
): Promise<{ status: boolean }> {
  if (BFF_DEV) {await changeCoreGroup(proctorId,groupId);return {status:true};}
  return apiRequest("/api/change-group-proctor", {
    method: "POST",
    body: JSON.stringify({ proctorId, groupId }),
  });
}

export async function removeAdminProctorFromGroup(
  proctorId: number,
  currentGroupId?: number,
): Promise<{ status: boolean }> {
  if (BFF_DEV) {await changeCoreGroup(proctorId,null,currentGroupId);return {status:true};}
  return apiRequest("/api/remove-groupd-id-proctor", {
    method: "POST",
    body: JSON.stringify({ proctorId }),
  });
}

export async function createAdminGroup(
  name: string,
): Promise<{ status: boolean; group?: AdminGroupItem; error?: string }> {
  if (BFF_DEV) return {status:true,group:await saveCoreGroup(null,name)};
  return apiRequest("/api/add-group", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateAdminGroup(
  groupId: number,
  name: string,
): Promise<{ status: boolean; group?: AdminGroupItem; error?: string }> {
  if (BFF_DEV) return {status:true,group:await saveCoreGroup(groupId,name)};
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
  if (BFF_DEV) {await domain(`/core/groups/${groupId}`,{method:"DELETE"});return {status:true};}
  return apiRequest("/api/delete-group", {
    method: "POST",
    body: JSON.stringify({ groupId }),
  });
}
