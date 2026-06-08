import { apiRequest } from "@/lib/api/client";

export interface SupervisorOvHomework {
  id: number;
  name: string;
  type: string;
  deadline: string | null;
}

export interface SupervisorOvHomeworkResult {
  homework_id: number;
  status: number;
  result: number | null;
  date_pass: string | null;
  deadline: string | null;
  status_text: string;
  days_overdue: number;
}

export interface SupervisorOvHomeworkStudent {
  id: number;
  full_name: string;
  class: number;
  group_name: string | null;
  results: SupervisorOvHomeworkResult[];
}

export interface SupervisorOvHomeworkReportResponse {
  status: boolean;
  homeworks: SupervisorOvHomework[];
  students: SupervisorOvHomeworkStudent[];
  error?: string;
}

export async function fetchSupervisorOvHomeworkReport(): Promise<SupervisorOvHomeworkReportResponse> {
  return apiRequest<SupervisorOvHomeworkReportResponse>("/api/get-ov-homework-table");
}
