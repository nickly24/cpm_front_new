import { apiRequest } from "@/lib/api/client";
import { BFF_DEV } from "@/lib/config";
import { listCoreAccess, saveCoreAccessRole, deleteCoreAccessRole, saveCoreAccessUser, revokeCoreAccessUser } from "@/lib/bff/core-access";
import type { SectionPermissions } from "@/lib/auth/types";

export interface AccessRole { id: number; name: string; description: string; users_count: number | null; permissions: SectionPermissions }
export interface AccessUser { id: number; full_name: string; login: string; role_id: number; role_name: string; is_active: boolean }
export interface AccessData { status: boolean; sections: { id: string; label: string }[]; roles: AccessRole[]; users: AccessUser[]; divisionSelected?: boolean }
export interface RoleInput { name: string; description: string; permissions: SectionPermissions }
export interface AccessUserInput { full_name: string; login: string; role_id: number; is_active: boolean; password?: string }
export interface AccessSaveResult { status: boolean; id: number; credentials?: { login: string; password: string } }

export const adminAccessApi = {
  list: (signal?: AbortSignal) => BFF_DEV ? listCoreAccess(signal) : apiRequest<AccessData>("/api/admin-access", { signal }),
  saveRole: (data: RoleInput, id?: number) => BFF_DEV ? saveCoreAccessRole(data, id) : apiRequest<AccessSaveResult>(`/api/admin-access/roles${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body: JSON.stringify(data) }),
  deleteRole: (id: number) => BFF_DEV ? deleteCoreAccessRole(id) : apiRequest(`/api/admin-access/roles/${id}`, { method: "DELETE" }),
  saveUser: (data: AccessUserInput, id?: number) => BFF_DEV ? saveCoreAccessUser(data, id) : apiRequest<AccessSaveResult>(`/api/admin-access/users${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body: JSON.stringify(data) }),
  deleteUser: (id: number) => BFF_DEV ? revokeCoreAccessUser(id) : apiRequest(`/api/admin-access/users/${id}`, { method: "DELETE" }),
};
