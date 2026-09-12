export type SubmissionState =
  | "none" | "uploading" | "processing" | "draft" | "submitted"
  | "in_review" | "revision_requested" | "graded";

export interface HomeworkWorkspace {
  homework: { id: number; name: string; deadline: string | null; published: boolean };
  legacy_result: { id: number; status: number; result: number; date_pass: string | null } | null;
  submission: {
    id?: number; state: SubmissionState; submitted_at_utc?: string | null;
    revision_count?: number; has_draft: boolean; has_file: boolean;
    revision_comment?: string | null;
    reviewer?: { role: string; id: number; full_name?: string } | null;
    current_file?: HomeworkFile | null;
    draft_file?: HomeworkFile | null;
  };
  permissions: { upload: boolean; submit: boolean; remove_draft?: boolean };
  suggested_score?: number;
  active_job?: UploadJob | null;
  limits?: { max_bytes: number; max_pages: number; poll_after_seconds: number };
}

export interface HomeworkFile {
  id: number; filename: string; page_count: number; size_bytes: number; created_at?: string;
}

export interface HomeworkPage<T> {
  items: T[]; next_cursor: number | null; total?: number; has_more?: boolean;
}

export interface HomeworkListQuery {
  state?: string; search?: string; after?: number; limit?: number;
  date_from?: string; date_to?: string; student_id?: number; homework_id?: number; group_id?: number;
}

export interface UploadJob {
  id: string; homework_id?: number; status: string; stage: string;
  progress: number; error_code?: string | null; attempts?: number;
  manual_attempts?: number;
}

export interface ActiveJobsResponse {
  items: UploadJob[];
  polling_required: boolean;
  poll_after_seconds: number;
}

export interface UploadInitialization {
  job: UploadJob;
  upload: { method: "POST"; url: string; fields: Record<string, string> } | null;
  max_bytes: number;
  poll_after_seconds: number;
}

export interface ReviewQueueItem {
  id: number; homework_id: number; student_id: number; state: SubmissionState;
  submitted_at_utc: string; reviewer_role: string | null; reviewer_id: number | null;
  revision_comment?: string | null;
  homework_name: string; student_name: string; group_name: string | null; deadline: string | null;
  reviewer_name?: string | null; suggested_score?: number;
  page_count?: number; size_bytes?: number; filename?: string;
}
