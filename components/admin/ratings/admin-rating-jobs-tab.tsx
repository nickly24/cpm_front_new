"use client";

import ratingStyles from "@/components/admin/ratings/admin-ratings.module.css";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import type { RatingRecalcJob, RatingRecalcStatus } from "@/lib/admin/admin-ratings-types";
import { fetchRatingRecalcJobs } from "@/lib/admin/admin-ratings-api";
import { useCallback, useEffect, useState } from "react";

const STATUS_LABEL: Record<RatingRecalcStatus, string> = {
  queued: "В очереди",
  running: "Выполняется",
  completed: "Завершён",
  failed: "Ошибка",
};

function statusClass(status: RatingRecalcStatus): string {
  if (status === "queued") return ratingStyles.statusQueued;
  if (status === "running") return ratingStyles.statusRunning;
  if (status === "completed") return ratingStyles.statusCompleted;
  return ratingStyles.statusFailed;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function JobCard({ job, active }: { job: RatingRecalcJob; active: boolean }) {
  return (
    <article
      className={`${ratingStyles.jobCard} ${active ? ratingStyles.jobCardActive : ""}`}
    >
      <div className={ratingStyles.jobHeader}>
        <div>
          <h3 className={ratingStyles.jobTitle}>Задача #{job.id}</h3>
          <p className={ratingStyles.jobMeta}>
            Период: {job.date_from} — {job.date_to}
            {job.created_by_name ? ` · ${job.created_by_name}` : ""}
          </p>
        </div>
        <span className={`${ratingStyles.statusBadge} ${statusClass(job.status)}`}>
          {STATUS_LABEL[job.status]}
        </span>
      </div>

      {job.status === "running" || job.status === "queued" ? (
        <div className={ratingStyles.progressTrack} aria-hidden>
          <div
            className={ratingStyles.progressFill}
            style={{ width: `${job.progress_percent}%` }}
          />
        </div>
      ) : null}

      <div className={ratingStyles.jobStats}>
        <span>Создана: {formatDateTime(job.created_at)}</span>
        {job.started_at ? <span>Старт: {formatDateTime(job.started_at)}</span> : null}
        {job.completed_at ? (
          <span>Завершена: {formatDateTime(job.completed_at)}</span>
        ) : null}
        {job.total_students > 0 ? (
          <span>
            Прогресс: {job.processed_count}/{job.total_students}
          </span>
        ) : null}
        {job.status === "completed" || job.status === "failed" ? (
          <>
            <span>Успешно: {job.successful}</span>
            {job.failed > 0 ? <span>Ошибок: {job.failed}</span> : null}
            {job.skipped > 0 ? <span>Пропущено: {job.skipped}</span> : null}
          </>
        ) : null}
      </div>

      {job.message ? <p className={ratingStyles.jobMessage}>{job.message}</p> : null}
    </article>
  );
}

interface AdminRatingJobsTabProps {
  refreshToken?: number;
  onActiveChange?: (active: boolean) => void;
}

export function AdminRatingJobsTab({
  refreshToken = 0,
  onActiveChange,
}: AdminRatingJobsTabProps) {
  const [jobs, setJobs] = useState<RatingRecalcJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetchRatingRecalcJobs();
      if (response.status) {
        setJobs(response.jobs ?? []);
        setActiveJobId(response.active_job_id);
        const hasActive = Boolean(
          response.active_job_id ??
            response.jobs?.some((job) =>
              job.status === "queued" || job.status === "running",
            ),
        );
        onActiveChange?.(hasActive);
      } else {
        setJobs([]);
        setError("Не удалось загрузить журнал");
      }
    } catch (err) {
      setJobs([]);
      setError(err instanceof Error ? err.message : "Ошибка загрузки журнала");
    } finally {
      setLoading(false);
    }
  }, [onActiveChange]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  useEffect(() => {
    const hasActive =
      activeJobId != null ||
      jobs.some((job) => job.status === "queued" || job.status === "running");
    if (!hasActive) {
      return;
    }

    const timer = window.setInterval(() => {
      void load();
    }, 2500);

    return () => window.clearInterval(timer);
  }, [activeJobId, jobs, load]);

  if (loading) {
    return <LoadingState label="Загрузка журнала…" variant="panel" />;
  }

  if (error) {
    return <p className={styles.errorText}>{error}</p>;
  }

  if (jobs.length === 0) {
    return (
      <div className={ratingStyles.emptyState}>
        <p>Пересчётов пока не было. Запустите первый пересчёт на вкладке «Рейтинг».</p>
      </div>
    );
  }

  return (
    <div className={ratingStyles.jobsList}>
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          active={job.id === activeJobId || job.status === "running"}
        />
      ))}
    </div>
  );
}
