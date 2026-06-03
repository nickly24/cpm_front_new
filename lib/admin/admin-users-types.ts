export type AdminStaffRole = "proctor" | "examinator" | "supervisor";

export type AdminUsersTab = "students" | "groups" | "staff";

export interface AdminStudent {
  id: number;
  student_id?: number;
  full_name: string;
  class: number;
  group_id: number | null;
  school_id?: number | null;
  school_name?: string | null;
  school_short_name?: string | null;
  tg_name?: string | null;
}

export interface AdminStaffUser {
  id: number;
  full_name: string;
  group_id?: number | null;
}

export interface AdminGroupItem {
  group_id: number;
  group_name: string;
}

export interface AdminGroupProctor {
  status: boolean;
  res:
    | {
        proctor_id: number;
        full_name: string;
      }
    | string
    | null;
}

export interface AdminGroupOverviewRow {
  item: AdminGroupItem;
  student_count: number;
  proctor: AdminGroupProctor;
}

export interface AdminGroupsOverviewResponse {
  status: boolean;
  page: number;
  limit: number;
  total: number;
  pages: number;
  res: AdminGroupOverviewRow[];
  error?: string;
}

export interface AdminGroupMembersResponse {
  status: boolean;
  item: AdminGroupItem;
  students: { id: number; full_name: string; class?: number; school_name?: string | null }[];
  proctor: AdminGroupProctor;
  error?: string;
}

export interface AdminGroupsSearchResponse {
  status: boolean;
  query: string;
  groups: AdminGroupItem[];
  students: {
    id: number;
    full_name: string;
    class: number;
    group_id: number | null;
    group_name: string | null;
    school_id: number | null;
    school_name: string | null;
  }[];
  error?: string;
}

export interface AdminUnsignedUsersResponse {
  status: boolean;
  unassigned_students: { student_id: number; full_name: string; class?: number; group_id?: number | null }[];
  unassigned_proctors: { proctor_id: number; full_name: string }[];
}

export interface AdminStudentFormData {
  full_name: string;
  class: number;
  tg_name?: string;
}

export interface AdminStudentAddResponse {
  status: boolean;
  message?: string;
  student_data?: {
    student_id: number;
    full_name: string;
    class: number;
    login: string;
    password: string;
    group_id: null;
    school_id: null;
    tg_name?: string | null;
  };
  error?: string;
}
