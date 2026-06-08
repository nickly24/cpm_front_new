import type { AdminListPagination } from "@/lib/admin/admin-tests-monitoring-types";

export type ZapDateStatus =
  | "pending"
  | "linked"
  | "no_class_day"
  | "failed"
  | "cancelled";

export interface ZapDateItem {
  id?: number;
  date: string;
  status: ZapDateStatus;
  status_label?: string;
  error_message?: string | null;
}

export type ZapStatus = "set" | "apr" | "dec";

export type ZapStatusFilter = "all" | ZapStatus;

export interface ZapDatesSummaryCounts {
  total_count?: number;
  linked_count?: number;
  pending_count?: number;
  no_class_day_count?: number;
  failed_count?: number;
  cancelled_count?: number;
}

export interface AdminZapListItem {
  id: number;
  student_id: number;
  full_name?: string;
  text: string;
  status: ZapStatus | string;
  answer?: string | null;
  created_at?: string | null;
  linked_count?: number;
  total_count?: number;
  has_attachments?: boolean;
  dates_summary?: ZapDatesSummaryCounts | string;
  dates_summary_label?: string | null;
}

export interface StudentZapListItem {
  id: number;
  student_id: number;
  text: string;
  status: string;
  answer?: string | null;
  dates?: ZapDateItem[];
  linked_count?: number;
  total_count?: number;
}

export interface ZapDetailRecord {
  id: number;
  student_id: number;
  text: string;
  status: string;
  answer?: string | null;
  full_name?: string;
  created_at?: string | null;
  dates?: ZapDateItem[];
  linked_count?: number;
  total_count?: number;
}

export interface ZapImageRecord {
  img_base64?: string;
  file_type?: string;
}

export interface CreateZapPayload {
  student_id: number;
  text: string;
  images: string[];
  dates: string[];
}

export interface CreateZapResponse {
  status: boolean;
  zap_id?: number;
  message?: string;
  error?: string;
}

export interface StudentZapsResponse {
  status: boolean;
  zaps?: StudentZapListItem[];
  error?: string;
}

export interface ZapDetailResponse {
  status: boolean;
  zap?: ZapDetailRecord;
  images?: ZapImageRecord[];
  dates?: ZapDateItem[];
  error?: string;
}

export interface ZapsListApiPagination {
  page: number;
  limit: number;
  total: number;
  total_pages?: number;
  totalPages?: number;
}

export interface ZapsListResponse {
  status: boolean;
  zaps?: AdminZapListItem[];
  pagination?: AdminListPagination;
  error?: string;
}

export interface FetchAllZapsParams {
  status?: ZapStatusFilter;
  page: number;
  limit: number;
}

export interface ProcessZapPayload {
  zap_id: number;
  status: "apr" | "dec";
  answer: string;
}

export interface ProcessZapResponse {
  status: boolean;
  message?: string;
  error?: string;
}

export interface RetryZapDateResponse {
  status: boolean;
  message?: string;
  error?: string;
}
