/** Server-owned, durable deletion contract. Unknown counts must never become zero. */
export interface DeletionStudent {
  id: number;
  name: string | null;
  group_name: string | null;
}

export const DELETION_COUNT_LABELS = {
  homeworks: "Домашние работы ученика",
  homework_submissions: "Сдачи домашних работ",
  homework_files: "Файлы и загрузки по данным системы",
  exams: "Экзамены ученика",
  exam_attempts: "Попытки экзаменов",
  exam_results: "Результаты экзаменов",
  tests: "Тесты ученика",
  test_attempts: "Попытки тестов",
  test_results: "Результаты тестов",
  other_records: "Прочие связанные записи",
  learned_cards: "Выученные карточки",
  attendance: "Записи посещаемости",
  total_records: "Всего связанных записей",
} as const;
export type DeletionCounts = Record<keyof typeof DELETION_COUNT_LABELS, number | null>;

export interface StudentDeletionJob {
  id: string;
  student_id: number;
  student: DeletionStudent;
  status: "queued" | "running" | "waiting" | "failed" | "partial" | "completed";
  stage: string;
  completed_units: number;
  total_units: number;
  percent: number;
  error: string | null;
  retryable: boolean;
  student_deleted?: boolean;
  warnings?: DeletionIssue[];
  residuals?: DeletionIssue[];
  created_at: string;
  updated_at: string;
}

export interface DeletionIssue {
  source: "mysql" | "mongo" | "files";
  target: string;
  message: string;
  count?: number;
}

export interface StudentDeletionPreview {
  warnings?: DeletionIssue[];
  student: DeletionStudent;
  available: boolean;
  blockers: string[];
  counts: DeletionCounts;
  details: { key: string; label: string; count: number | null }[];
  confirmation_token: string | null;
  expires_at: string | null;
  fingerprint: string | null;
  active_job: StudentDeletionJob | null;
}

export interface SavedDeletion {
  student_id: number;
  job_id: string | null;
  idempotency_key: string;
}

export function deletionCanStart(preview: StudentDeletionPreview | null, now = Date.now()): boolean {
  return Boolean(preview?.available && !preview.active_job && preview.blockers?.length === 0
    && preview.confirmation_token && preview.fingerprint && preview.expires_at
    && Date.parse(preview.expires_at) > now
    && Object.keys(DELETION_COUNT_LABELS).every((key) => {
      const count = preview.counts?.[key as keyof DeletionCounts];
      return typeof count === "number" && Number.isSafeInteger(count) && count >= 0;
    })
    && Array.isArray(preview.details)
    && preview.details.every(({ count }) => typeof count === "number" && Number.isSafeInteger(count) && count >= 0));
}

export function deletionIsActive(job: StudentDeletionJob): boolean {
  return job.status === "queued" || job.status === "running" || job.status === "waiting";
}

/** A terminal receipt is the only thing allowed to display 100%. */
export function deletionProgress(job: StudentDeletionJob): number {
  if (job.status === "completed") return 100;
  return Number.isFinite(job.percent) ? Math.max(0, Math.min(99, job.percent)) : 0;
}

export function deletionStatusLabel(job: StudentDeletionJob): string {
  return ({ queued: "В очереди", running: "Удаление", waiting: "Ожидание", failed: "Ошибка удаления", partial: "Удаление завершено с остатками", completed: "Удаление завершено" })[job.status];
}

export function deletionCountLabel(count: number | null | undefined): string {
  return typeof count === "number" && Number.isSafeInteger(count) && count >= 0
    ? count.toLocaleString("ru-RU") : "Неизвестно";
}

export function latestDeletionJob(jobs: StudentDeletionJob[]): StudentDeletionJob | null {
  return [...jobs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null;
}

export function parseSavedDeletions(raw: string | null): SavedDeletion[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const ids = new Set<number>();
    return parsed.filter((entry): entry is SavedDeletion => {
      if (!entry || typeof entry !== "object" || !Number.isSafeInteger(entry.student_id)
        || entry.student_id <= 0 || !(entry.job_id === null || typeof entry.job_id === "string")
        || typeof entry.idempotency_key !== "string" || !entry.idempotency_key || ids.has(entry.student_id)) return false;
      ids.add(entry.student_id);
      return true;
    }).map(({ student_id, job_id, idempotency_key }) => ({ student_id, job_id, idempotency_key }));
  } catch {
    return [];
  }
}
