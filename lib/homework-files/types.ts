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
    reviewer?: { role: string; id: number } | null;
  };
  permissions: { upload: boolean; submit: boolean };
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
}
