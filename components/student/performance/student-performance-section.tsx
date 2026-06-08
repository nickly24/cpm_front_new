"use client";

import { AttendanceQrCard } from "@/components/student/performance/attendance-qr-card";
import { RatingMetricCard } from "@/components/student/performance/rating-metric-card";
import { SectionHeroBanner } from "@/components/student/section-hero-banner";
import styles from "@/components/student/performance/performance.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/contexts/AuthContext";
import { STUDENT_SECTION_BANNERS } from "@/lib/student/section-banners";
import {
  buildRatingMetrics,
  calculateAverageRating,
  fetchMyRating,
  formatRatingPeriod,
  formatRatingValue,
} from "@/lib/student/performance-api";
import type { StudentRatingData } from "@/lib/student/performance-types";
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

  const hero = (
    <SectionHeroBanner
      imageSrc={STUDENT_SECTION_BANNERS.performance}
      eyebrow="Успеваемость"
      title={user?.full_name ?? "Студент"}
      subtitle={subtitle || undefined}
      footer={
        !loading && data && average != null ? (
          <>
            Средний балл <strong>{formatRatingValue(average)}</strong>
          </>
        ) : undefined
      }
    />
  );

  if (loading) {
    return (
      <div className={styles.page}>
        {hero}
        <LoadingState label="Загрузка успеваемости…" variant="block" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {hero}

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
