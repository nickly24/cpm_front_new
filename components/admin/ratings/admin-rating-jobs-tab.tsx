"use client";
import ratingStyles from "@/components/admin/ratings/admin-ratings.module.css";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { BFF_DEV } from "@/lib/config";
import type { RatingRecalcJob, RatingRecalcStatus } from "@/lib/admin/admin-ratings-types";
import { fetchRatingRecalcJobs, cancelRatingRecalcJob, retryRatingRecalcJob, isActiveRatingJob, pendingRatingCommand } from "@/lib/admin/admin-ratings-api";
import { useCallback, useEffect, useRef, useState } from "react";

const STATUS_LABEL: Record<RatingRecalcStatus, string> = {
  preparing: "Подготовка", waiting_sources: "Ожидание исходных данных", queued: "В очереди", running: "Выполняется",
  validating: "Проверка перед публикацией", completed: "Опубликован", failed: "Ошибка", cancelled: "Отменён", superseded: "Данные изменились",
};
function statusClass(status: RatingRecalcStatus): string {
  if (status === "completed") return ratingStyles.statusCompleted;
  if (status === "failed" || status === "superseded") return ratingStyles.statusFailed;
  return isActiveRatingJob({ status }) ? ratingStyles.statusRunning : ratingStyles.statusQueued;
}
function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ru-RU");
}
interface AdminRatingJobsTabProps {
  refreshToken?: number; canEdit?: boolean; onActiveChange?: (active: boolean) => void;
  onCommandsChange?: () => void; onPublished?: (job: RatingRecalcJob) => void;
}
export function AdminRatingJobsTab({ refreshToken = 0, canEdit = false, onActiveChange, onCommandsChange, onPublished }: AdminRatingJobsTabProps) {
  const [jobs, setJobs] = useState<RatingRecalcJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [page, setPage] = useState(0);
  const previous = useRef(new Map<string | number, RatingRecalcStatus>());
  const mounted = useRef(true);
  const serial = useRef(0);
  const load = useCallback(async () => {
    const request = ++serial.current;
    try {
      const response = await fetchRatingRecalcJobs(50, page * 50);
      if (!mounted.current || request !== serial.current) return;
      if (!response.status) throw new Error("Не удалось загрузить журнал");
      setError(null);
      setJobs(response.jobs);
      if (page === 0) onActiveChange?.(response.jobs.some(isActiveRatingJob));
      for (const job of response.jobs) {
        const before = previous.current.get(job.id);
        if (before && isActiveRatingJob({ status: before }) && job.status === "completed") onPublished?.(job);
        previous.current.set(job.id, job.status);
      }
    } catch (err) {
      if (mounted.current && request === serial.current) setError(err instanceof Error ? err.message : "Ошибка загрузки журнала");
    } finally { if (mounted.current && request === serial.current) setLoading(false); }
  }, [page, onActiveChange, onPublished]);
  useEffect(() => { mounted.current = true; const timer = window.setTimeout(() => void load(), 0); return () => { mounted.current = false; window.clearTimeout(timer); }; }, [load, refreshToken]);
  useEffect(() => {
    if (!jobs.some(isActiveRatingJob)) return;
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [jobs, load]);
  const mutate = async (job: RatingRecalcJob, retry: boolean) => {
    setBusyId(job.id); setError(null); onCommandsChange?.();
    try {
      if (retry) { const next = await retryRatingRecalcJob(job.id); previous.current.set(next.id, next.status); } else await cancelRatingRecalcJob(job.id);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Ошибка пересчёта"); }
    finally { setBusyId(null); onCommandsChange?.(); }
  };
  if (loading) return <LoadingState label="Загрузка журнала…" variant="panel" />;
  return <div className={ratingStyles.jobsList}>
    {error ? <p className={styles.errorText} role="alert">{error}</p> : null}
    {jobs.length === 0 ? <div className={ratingStyles.emptyState}><p>Пересчётов пока не было.</p></div> : null}
    {jobs.map(job => <article key={job.id} className={`${ratingStyles.jobCard} ${isActiveRatingJob(job) ? ratingStyles.jobCardActive : ""}`}>
      <div className={ratingStyles.jobHeader}>
        <div><h3 className={ratingStyles.jobTitle} style={{overflowWrap: "anywhere"}}>Задача {job.revision ? `№${job.revision}` : `#${job.id}`}</h3>
          <p className={ratingStyles.jobMeta}>Период: {job.date_from} — {job.date_to}</p>
        </div>
        <span className={`${ratingStyles.statusBadge} ${statusClass(job.status)}`}>{STATUS_LABEL[job.status]}</span>
      </div>
      {isActiveRatingJob(job) ? <div className={ratingStyles.progressTrack} role="progressbar" aria-label="Прогресс пересчёта" aria-valuenow={job.progress_percent} aria-valuemin={0} aria-valuemax={100}><div className={ratingStyles.progressFill} style={{width: `${job.progress_percent}%`}} /></div> : null}
      <div className={ratingStyles.jobStats}>
        <span>Создана: {formatDateTime(job.created_at)}</span>
        {job.completed_at ? <span>Завершена: {formatDateTime(job.completed_at)}</span> : null}
        <span>Обработано: {job.processed_count}/{job.total_students}</span>
        {job.successful !== undefined ? <span>Успешно: {job.successful}</span> : null}
        {job.failed ? <span>Ошибок: {job.failed}</span> : null}
        {job.skipped ? <span>Пропущено: {job.skipped}</span> : null}
      </div>
      {job.message ? <p className={ratingStyles.jobMessage}>{job.message}</p> : null}
      {BFF_DEV && canEdit ? <div style={{display:"flex", gap:12, marginTop:12}}>
        {isActiveRatingJob(job) ? <Button variant="ghost" disabled={busyId !== null} onClick={() => void mutate(job, false)}>Отменить пересчёт</Button> : null}
        {["failed", "cancelled", "superseded"].includes(job.status) ? <Button disabled={busyId !== null || jobs.some(isActiveRatingJob) && !pendingRatingCommand(`retry:${job.id}`)} onClick={() => void mutate(job, true)}>{pendingRatingCommand(`retry:${job.id}`) ? "Повторить запрос" : "Повторить пересчёт"}</Button> : null}
      </div> : null}
    </article>)}
    {BFF_DEV && (page > 0 || jobs.length === 50) ? <div style={{display:"flex",gap:12}}>
      <Button variant="ghost" disabled={page === 0} onClick={() => {setLoading(true); setPage(p => p - 1);}}>Назад</Button>
      <span>Страница {page + 1}</span>
      <Button variant="ghost" disabled={jobs.length < 50} onClick={() => {setLoading(true); setPage(p => p + 1);}}>Далее</Button>
    </div> : null}
  </div>;
}
