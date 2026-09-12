import { apiRequest } from "@/lib/api/client";
import type { SectionPermissions } from "@/lib/auth/types";

export interface AccessRole { id: number; name: string; description: string; users_count: number; permissions: SectionPermissions }
export interface AccessUser { id: number; full_name: string; login: string; role_id: number; role_name: string; is_active: boolean }
export interface AccessData { status: boolean; sections: { id: string; label: string }[]; roles: AccessRole[]; users: AccessUser[] }
export interface RoleInput { name: string; description: string; permissions: SectionPermissions }
export interface AccessUserInput { full_name: string; login: string; role_id: number; is_active: boolean; password?: string }
interface SaveResult { status: boolean; id: number; credentials?: { login: string; password: string } }

export const adminAccessApi = {
  list: () => apiRequest<AccessData>("/api/admin-access"),
  saveRole: (data: RoleInput, id?: number) => apiRequest<SaveResult>(`/api/admin-access/roles${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body: JSON.stringify(data) }),
  deleteRole: (id: number) => apiRequest(`/api/admin-access/roles/${id}`, { method: "DELETE" }),
  saveUser: (data: AccessUserInput, id?: number) => apiRequest<SaveResult>(`/api/admin-access/users${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body: JSON.stringify(data) }),
  deleteUser: (id: number) => apiRequest(`/api/admin-access/users/${id}`, { method: "DELETE" }),
};
