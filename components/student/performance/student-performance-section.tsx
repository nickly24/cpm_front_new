"use client";

import { AttendanceQrCard } from "@/components/student/performance/attendance-qr-card";
import { RatingMetricCard } from "@/components/student/performance/rating-metric-card";
import styles from "@/components/student/performance/performance.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildRatingMetrics,
  calculateAverageRating,
  fetchMyRating,
  formatRatingPeriod,
  formatRatingValue,
} from "@/lib/student/performance-api";
import type { StudentRatingData } from "@/lib/student/performance-types";
import { TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function buildSubtitle(groupId?: number | null, period?: string | null): string {
  const parts: string[] = [];

  if (groupId) {
    parts.push(`Группа ${groupId}`);
  }

  if (period) {
    parts.push(period);
  }

  return parts.join(" · ");
}

export function StudentPerformanceSection() {
  const { user } = useAuth();
  const [data, setData] = useState<StudentRatingData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRating() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchMyRating();

        if (cancelled) {
          return;
        }

        if (response.status) {
          setData(response.data);
          setMessage(response.data ? null : response.message ?? null);
        } else {
          setData(null);
          setError(response.error ?? "Не удалось загрузить успеваемость");
        }
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(
            err instanceof Error
              ? err.message
              : "Ошибка при загрузке успеваемости",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRating();

    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = useMemo(() => buildRatingMetrics(data), [data]);
  const average = useMemo(() => calculateAverageRating(data), [data]);
  const period = useMemo(
    () => formatRatingPeriod(data?.date_from, data?.date_to),
    [data],
  );
  const subtitle = buildSubtitle(user?.group_id, period);

  if (loading) {
    return (
      <div className={styles.page}>
        <LoadingState label="Загрузка успеваемости…" variant="block" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <span className={styles.eyebrow}>Успеваемость</span>
          <h1 className={styles.title}>{user?.full_name ?? "Студент"}</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>

        <div className={styles.average}>
          <div className={styles.averageIcon}>
            <TrendingUp size={20} />
          </div>
          <div>
            <p className={styles.averageLabel}>Средний балл</p>
            <p className={styles.averageValue}>
              {formatRatingValue(average)}
            </p>
          </div>
        </div>
      </header>

      {error ? <div className={styles.alert}>{error}</div> : null}

      {!error && data ? (
        <section className={styles.grid}>
          {metrics.map((metric) => (
            <RatingMetricCard key={metric.id} metric={metric} />
          ))}
        </section>
      ) : null}

      {!error && !data ? (
        <div className={`ds-card ${styles.emptyCard}`}>
          <h2 className={styles.emptyTitle}>Рейтинг ещё не рассчитан</h2>
          <p className={styles.emptyText}>
            {message ??
              "Данные появятся после расчёта администратором. Загляните позже."}
          </p>
        </div>
      ) : null}

      <AttendanceQrCard />
    </div>
  );
}
