export const USER_ROLES = [
  "student",
  "proctor",
  "admin",
  "examinator",
  "supervisor",
  "staff_admin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type SectionPermissions = Record<string, { view: boolean; edit: boolean }>;

export interface User {
  role: UserRole;
  id: number;
  full_name: string;
  group_id?: number | null;
  role_id?: number | null;
  role_name?: string | null;
  permissions?: SectionPermissions;
}

export interface AuthResponse {
  status: boolean;
  message?: string;
  user?: {
    role: UserRole;
    id: number;
    full_name: string;
    group_id?: number | null;
    role_id?: number | null;
    role_name?: string | null;
    permissions?: SectionPermissions;
  };
  token?: string;
}

export interface AunResponse {
  status: boolean;
  role?: UserRole;
  entity_id?: number;
  full_name?: string;
  group_id?: number | null;
  message?: string;
  role_id?: number | null;
  role_name?: string | null;
  permissions?: SectionPermissions;
}
