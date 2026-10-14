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
  account_id?: number;
  organization_id?: number;
  division_id?: number | null;
  organization_admin?: boolean;
  organizations?: import("@/lib/bff/client").Organization[];
  context_revision?: string;
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
