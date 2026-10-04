"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchStudentDeletionJob, fetchStudentDeletionJobs } from "./student-deletion-api";
import { deletionIsActive, latestDeletionJob, parseSavedDeletions, type SavedDeletion, type StudentDeletionJob } from "./student-deletion";

export const DELETION_POLL_MS = 2000;
export const deletionStorageKey = (owner: string) => `cpm:student-deletions:v1:${owner}`;

/** Monitoring lives outside the dialog, so closing it never cancels server work. */
export function useStudentDeletionJobs(owner: string, onCompleted: (studentId: number) => void) {
  const [jobs, setJobs] = useState<StudentDeletionJob[]>([]);
  const [saved, setSaved] = useState<SavedDeletion[]>([]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const recordsRef = useRef<SavedDeletion[]>([]);
  const jobsRef = useRef<StudentDeletionJob[]>([]);
  const completedRef = useRef(new Set<string>());

  const persist = useCallback((records: SavedDeletion[]) => {
    recordsRef.current = records;
    setSaved(records);
    try {
      localStorage.setItem(deletionStorageKey(owner), JSON.stringify(records));
      setStorageWarning(null);
    } catch {
      setStorageWarning("Браузер не сохранил ход удаления. Не перезагружайте страницу; после закрытия найти операцию можно через кнопку удаления ученика.");
    }
  }, [owner]);

  const acceptJob = useCallback((job: StudentDeletionJob) => {
    const current = jobsRef.current.find((entry) => entry.id === job.id);
    // A slow GET must not overwrite a newer retry/completion receipt.
    if (current && (current.status === "completed" && job.status !== "completed"
      || Date.parse(current.updated_at) > Date.parse(job.updated_at))) return;
    const existing = recordsRef.current.find((record) => record.student_id === job.student_id);
    persist([...recordsRef.current.filter((record) => record.student_id !== job.student_id), {
      student_id: job.student_id, job_id: job.id, idempotency_key: existing?.idempotency_key ?? job.id,
    }]);
    const next = [...jobsRef.current.filter((entry) => entry.student_id !== job.student_id), job];
    jobsRef.current = next;
    setJobs(next);
    setErrors((previous) => { const next = { ...previous }; delete next[job.student_id]; return next; });
    if (job.status === "completed" && !completedRef.current.has(job.id)) {
      completedRef.current.add(job.id);
      onCompleted(job.student_id);
    }
  }, [onCompleted, persist]);

  const rememberPending = useCallback((studentId: number, idempotencyKey: string) => {
    persist([...recordsRef.current.filter((record) => record.student_id !== studentId), {
      student_id: studentId, job_id: null, idempotency_key: idempotencyKey,
    }]);
  }, [persist]);

  const forget = useCallback((studentId: number) => {
    persist(recordsRef.current.filter((record) => record.student_id !== studentId));
    jobsRef.current = jobsRef.current.filter((job) => job.student_id !== studentId);
    setJobs(jobsRef.current);
    setErrors((previous) => { const next = { ...previous }; delete next[studentId]; return next; });
  }, [persist]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        recordsRef.current = parseSavedDeletions(localStorage.getItem(deletionStorageKey(owner)));
        setSaved(recordsRef.current);
      } catch {
        setStorageWarning("Сохранённые операции недоступны в этом браузере. Откройте удаление нужного ученика, чтобы проверить сервер.");
      }
      setRestored(true);
    });
    return () => { cancelled = true; };
  }, [owner]);

  useEffect(() => {
    if (!restored) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      await Promise.all(recordsRef.current.map(async (record) => {
        const current = jobsRef.current.find((job) => job.student_id === record.student_id);
        if (current && !deletionIsActive(current)) return;
        try {
          const job = record.job_id
            ? await fetchStudentDeletionJob(record.job_id)
            : latestDeletionJob(await fetchStudentDeletionJobs(record.student_id));
          if (!cancelled && job) acceptJob(job);
        } catch (error) {
          if (!cancelled) setErrors((previous) => ({ ...previous, [record.student_id]:
            error instanceof Error ? error.message : "Не удалось проверить ход удаления" }));
        }
      }));
      if (!cancelled) timer = setTimeout(poll, DELETION_POLL_MS);
    }
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [restored, acceptJob]);

  return { jobs, saved, errors, storageWarning, acceptJob, rememberPending, forget };
}
