export const USER_ROLES = [
  "student",
  "proctor",
  "admin",
  "examinator",
  "supervisor",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  role: UserRole;
  id: number;
  full_name: string;
  group_id?: number | null;
}

export interface AuthResponse {
  status: boolean;
  message?: string;
  user?: {
    role: UserRole;
    id: number;
    full_name: string;
    group_id?: number | null;
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
}
