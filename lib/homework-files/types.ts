export type SubmissionState =
  | "none" | "uploading" | "processing" | "draft" | "submitted"
  | "in_review" | "revision_requested" | "graded";

export interface HomeworkWorkspace {
  homework: { id: number; name: string; deadline: string | null; published: boolean };
  legacy_result: { id: number; status: number; result: number; date_pass: string | null } | null;
  submission: {
    id?: number; state: SubmissionState; submitted_at_utc?: string | null;
    revision_count?: number; has_draft: boolean; has_file: boolean;
    file_version?: number | null;
    reviewer?: { role: string; id: number } | null;
  };
  permissions: { upload: boolean; submit: boolean; chat: boolean };
}

export interface UploadJob {
  id: string; homework_id?: number; status: string; stage: string;
  progress: number; error_code?: string | null;
}

export interface ReviewQueueItem {
  id: number; homework_id: number; student_id: number; state: SubmissionState;
  submitted_at_utc: string; reviewer_role: string | null; reviewer_id: number | null;
  homework_name: string; student_name: string; group_name: string | null; deadline: string | null;
}
