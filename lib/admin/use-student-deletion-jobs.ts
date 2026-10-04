"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchStudentDeletionJob, fetchStudentDeletionJobs } from "./student-deletion-api";
import { deletionIsActive, latestDeletionJob, parseSavedDeletions, type SavedDeletion, type StudentDeletionJob } from "./student-deletion";

export const DELETION_POLL_MS = 2000;
export const deletionStorageKey = (owner: string) => `cpm:student-deletions:v1:${owner}`;

/** Monitoring lives outside the dialog, so closing it never cancels server work. */
export function useStudentDeletionJobs(owner: string, onCompleted: (studentId: number) => void) {
  // A fresh session also distinguishes signing back into the same account from
  // callbacks still resolving after a previous account switch/unmount.
  const session = useMemo(() => ({ owner }), [owner]);
  const activeSessionRef = useRef<typeof session | null>(session);
  const [jobs, setJobs] = useState<StudentDeletionJob[]>([]);
  const [saved, setSaved] = useState<SavedDeletion[]>([]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [restoredSession, setRestoredSession] = useState<typeof session | null>(null);
  const recordsRef = useRef<SavedDeletion[]>([]);
  const jobsRef = useRef<StudentDeletionJob[]>([]);
  const completedRef = useRef(new Set<string>());

  const persist = useCallback((records: SavedDeletion[]) => {
    if (activeSessionRef.current !== session) return;
    recordsRef.current = records;
    setSaved(records);
    try {
      localStorage.setItem(deletionStorageKey(owner), JSON.stringify(records));
      setStorageWarning(null);
    } catch {
      setStorageWarning("Браузер не сохранил ход удаления. Не перезагружайте страницу; после закрытия найти операцию можно через кнопку удаления ученика.");
    }
  }, [owner, session]);

  const acceptJob = useCallback((job: StudentDeletionJob) => {
    if (activeSessionRef.current !== session) return;
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
    if ((job.student_deleted || job.status === "completed") && !completedRef.current.has(job.id)) {
      completedRef.current.add(job.id);
      onCompleted(job.student_id);
    }
  }, [onCompleted, persist, session]);

  const rememberPending = useCallback((studentId: number, idempotencyKey: string) => {
    persist([...recordsRef.current.filter((record) => record.student_id !== studentId), {
      student_id: studentId, job_id: null, idempotency_key: idempotencyKey,
    }]);
  }, [persist]);

  const forget = useCallback((studentId: number) => {
    if (activeSessionRef.current !== session) return;
    persist(recordsRef.current.filter((record) => record.student_id !== studentId));
    jobsRef.current = jobsRef.current.filter((job) => job.student_id !== studentId);
    setJobs(jobsRef.current);
    setErrors((previous) => { const next = { ...previous }; delete next[studentId]; return next; });
  }, [persist, session]);

  useEffect(() => {
    activeSessionRef.current = session;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      recordsRef.current = [];
      jobsRef.current = [];
      completedRef.current.clear();
      setJobs([]);
      setErrors({});
      setStorageWarning(null);
      try {
        recordsRef.current = parseSavedDeletions(localStorage.getItem(deletionStorageKey(owner)));
      } catch {
        setStorageWarning("Сохранённые операции недоступны в этом браузере. Откройте удаление нужного ученика, чтобы проверить сервер.");
      }
      setSaved(recordsRef.current);
      setRestoredSession(session);
    });
    return () => {
      cancelled = true;
      if (activeSessionRef.current === session) activeSessionRef.current = null;
    };
  }, [owner, session]);

  useEffect(() => {
    if (restoredSession !== session) return;
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
          if (!cancelled && recordsRef.current.includes(record) && job) acceptJob(job);
        } catch (error) {
          if (!cancelled && recordsRef.current.includes(record)) setErrors((previous) => ({ ...previous, [record.student_id]:
            error instanceof Error ? error.message : "Не удалось проверить ход удаления" }));
        }
      }));
      if (!cancelled) timer = setTimeout(poll, DELETION_POLL_MS);
    }
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [restoredSession, session, acceptJob]);

  const restored = restoredSession === session;
  return {
    jobs: restored ? jobs : [], saved: restored ? saved : [],
    errors: restored ? errors : {}, storageWarning: restored ? storageWarning : null,
    acceptJob, rememberPending, forget,
  };
}
