export type AdminSchoolsTab = "catalog" | "unassigned";

export interface AdminSchool {
  school_id: number;
  name: string;
  short_name: string | null;
  notes: string | null;
  is_active: boolean;
  student_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AdminSchoolsListResponse {
  status: boolean;
  res: AdminSchool[];
  error?: string;
}

export interface AdminSchoolDetailResponse {
  status: boolean;
  school: AdminSchool;
  error?: string;
}

export interface AdminSchoolStudent {
  id: number;
  full_name: string;
  class?: number;
  group_id?: number | null;
  school_id?: number | null;
}

export interface AdminSchoolStudentsResponse {
  status: boolean;
  res: AdminSchoolStudent[];
}

export interface AdminUnassignedSchoolStudentsResponse {
  status: boolean;
  unassigned_students: {
    student_id: number;
    full_name: string;
    class?: number;
    group_id?: number | null;
  }[];
}

export interface AdminSchoolFormData {
  name: string;
  short_name?: string;
  notes?: string;
  is_active?: boolean;
}
