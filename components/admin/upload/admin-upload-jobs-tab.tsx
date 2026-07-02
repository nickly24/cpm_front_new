"use client";

import styles from "@/components/admin/upload/admin-upload.module.css";
import ratingStyles from "@/components/admin/ratings/admin-ratings.module.css";
import testStyles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchUserImportJobs } from "@/lib/admin/admin-upload-api";
import type { UserImportJob, UserImportJobStatus } from "@/lib/admin/admin-upload-types";
import { useCallback, useEffect, useState } from "react";

const STATUS_LABEL: Record<UserImportJobStatus, string> = {
  queued: "В очереди",
  running: "Выполняется",
  rolling_back: "Откат",
  completed: "Завершён",
  failed: "Ошибка",
};

const IMPORT_TYPE_LABEL: Record<string, string> = {
  users: "Пользователи",
  external_test_results: "Результаты тестов",
};

function statusClass(status: UserImportJobStatus): string {
  if (status === "queued") return ratingStyles.statusQueued;
  if (status === "running" || status === "rolling_back") return ratingStyles.statusRunning;
  if (status === "completed") return ratingStyles.statusCompleted;
  return ratingStyles.statusFailed;
}

function formatDateTime(value: string | null | undefined): string {
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

function jobTypeLabel(job: UserImportJob): string {
  return IMPORT_TYPE_LABEL[job.import_type] ?? job.import_type ?? "Импорт";
}

interface AdminUploadJobsTabProps {
  refreshToken?: number;
  onActiveChange?: (active: boolean) => void;
  onOpenReport?: (jobId: number) => void;
}

export function AdminUploadJobsTab({
  refreshToken = 0,
  onActiveChange,
  onOpenReport,
}: AdminUploadJobsTabProps) {
  const [jobs, setJobs] = useState<UserImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetchUserImportJobs();
      if (response.status) {
        setJobs(response.jobs ?? []);
        onActiveChange?.(response.has_active);
      } else {
        setJobs([]);
        setError("Не удалось загрузить журнал");
      }
    } catch (err) {
      setJobs([]);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [onActiveChange]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load, refreshToken]);

  useEffect(() => {
    const hasActive = jobs.some(
      (job) =>
        job.status === "queued" ||
        job.status === "running" ||
        job.status === "rolling_back",
    );
    if (!hasActive) {
      return;
    }
    const timer = window.setInterval(() => {
      void load();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [jobs, load]);

  if (loading) {
    return <LoadingState label="Загрузка журнала…" variant="panel" />;
  }

  if (error) {
    return <p className={testStyles.errorText}>{error}</p>;
  }

  if (jobs.length === 0) {
    return (
      <div className={ratingStyles.emptyState}>
        <p>Импортов пока не было. Загрузите Excel на вкладке «Новая загрузка».</p>
      </div>
    );
  }

  return (
    <div className={ratingStyles.jobsList}>
      {jobs.map((job) => (
        <article key={job.id} className={ratingStyles.jobCard}>
          <div className={ratingStyles.jobHeader}>
            <div>
              <h3 className={ratingStyles.jobTitle}>
                Импорт #{job.id} · {jobTypeLabel(job)}
              </h3>
              <p className={ratingStyles.jobMeta}>
                {job.created_by_name ? job.created_by_name : "Администратор"}
              </p>
            </div>
            <span className={`${ratingStyles.statusBadge} ${statusClass(job.status)}`}>
              {STATUS_LABEL[job.status]}
            </span>
          </div>

          {job.status === "running" ||
          job.status === "queued" ||
          job.status === "rolling_back" ? (
            <div className={ratingStyles.progressTrack} aria-hidden>
              <div
                className={ratingStyles.progressFill}
                style={{ width: `${job.progress_percent}%` }}
              />
            </div>
          ) : null}

          <div className={ratingStyles.jobStats}>
            <span>Создан: {formatDateTime(job.created_at)}</span>
            {job.completed_at ? (
              <span>Завершён: {formatDateTime(job.completed_at)}</span>
            ) : null}
            {job.total_rows > 0 ? (
              <span>
                Прогресс: {job.processed_count}/{job.total_rows}
              </span>
            ) : null}
            {job.status === "completed" || job.status === "failed" ? (
              <>
                <span>
                  {job.import_type === "external_test_results" ? "Загружено" : "Создано"}:{" "}
                  {job.successful}
                </span>
                {job.skipped > 0 ? <span>Пропущено: {job.skipped}</span> : null}
              </>
            ) : null}
          </div>

          {job.message ? <p className={ratingStyles.jobMessage}>{job.message}</p> : null}

          {(job.status === "completed" || job.status === "failed") && job.has_report ? (
            <div className={styles.jobCardActions}>
              <Button type="button" size="sm" onClick={() => onOpenReport?.(job.id)}>
                Открыть отчёт
              </Button>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
