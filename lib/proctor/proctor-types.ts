export interface ProctorHomeworkItem {
  id: number;
  name: string;
  type: string;
  deadline: string | null;
  published?: boolean;
}

export interface ProctorHomeworkListResponse {
  status: boolean;
  res: ProctorHomeworkItem[];
  pagination?: {
    current_page: number;
    total_pages: number;
    total_items: number;
    items_per_page: number;
  } | null;
}

export interface ProctorGroupStudent {
  id: number;
  full_name: string;
}

export interface ProctorGroupStudentsResponse {
  status: boolean;
  res: ProctorGroupStudent[];
}

export interface ProctorHomeworkSession {
  id: number | null;
  status: number;
  result: number;
  homework_id: number;
  student_id: number;
  date_pass: string | null;
  student_full_name: string;
}

export interface ProctorHomeworkSessionsResponse {
  status: boolean;
  res: ProctorHomeworkSession[];
}

export interface ProctorPassHomeworkResponse {
  status: boolean;
  result?: number;
  sessionId?: number;
  error?: string;
}

export interface ProctorPassHomeworkBulkResponse {
  status: boolean;
  passed?: number;
  total?: number;
  skipped?: number;
  errors?: { student_id: number; error: string }[] | null;
  error?: string;
}

export interface ProctorEditSessionResponse {
  status: boolean;
  result?: number | null;
  date_pass?: string | null;
  error?: string;
}

export interface ProctorOvHomework {
  id: number;
  name: string;
  type: string;
  deadline: string | null;
}

export interface ProctorOvResult {
  homework_id: number;
  status: number;
  result: number | null;
  date_pass: string | null;
  deadline: string | null;
  status_text: string;
  days_overdue: number;
}

export interface ProctorOvStudent {
  id: number;
  full_name: string;
  class: number | null;
  group_name: string | null;
  results: ProctorOvResult[];
}

export interface ProctorOvTableResponse {
  status: boolean;
  homeworks: ProctorOvHomework[];
  students: ProctorOvStudent[];
  error?: string;
}

export type ProctorHomeworkTypeFilter = "all" | "ОВ" | "ДЗНВ";
