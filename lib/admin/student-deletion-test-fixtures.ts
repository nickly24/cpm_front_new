import type { StudentDeletionJob, StudentDeletionPreview } from "./student-deletion";

export const previewFixture: StudentDeletionPreview = {
  student: { id: 42, name: "Тестовый Ученик", group_name: "Тестовая группа" }, available: true, blockers: [],
  counts: { homeworks: 3, homework_submissions: 4, homework_files: 5, exams: 6, exam_attempts: 7, exam_results: 8,
    tests: 9, test_attempts: 10, test_results: 11, other_records: 12 },
  details: [{ key: "attendance", label: "Посещаемость", count: 12 }], confirmation_token: "synthetic-confirmation",
  expires_at: "2099-01-01T00:00:00Z", fingerprint: "synthetic-fingerprint", active_job: null,
};
export const jobFixture: StudentDeletionJob = {
  id: "synthetic-job-42", student_id: 42, student: previewFixture.student, status: "running", stage: "homework_storage",
  completed_units: 4, total_units: 10, percent: 40, error: null, retryable: false,
  created_at: "2026-10-03T10:00:00Z", updated_at: "2026-10-03T10:00:01Z",
};

