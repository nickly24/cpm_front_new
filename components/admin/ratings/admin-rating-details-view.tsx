"use client";

import ratingStyles from "@/components/admin/ratings/admin-ratings.module.css";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { AdminFullscreenBack } from "@/components/admin/admin-fullscreen-back";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchRatingDetails } from "@/lib/admin/admin-ratings-api";
import type { RatingDetails } from "@/lib/admin/admin-ratings-types";
import { useEffect, useState } from "react";

interface AdminRatingDetailsViewProps {
  ratingId: number;
  studentName?: string;
  onBack: () => void;
}

export function AdminRatingDetailsView({
  ratingId,
  studentName,
  onBack,
}: AdminRatingDetailsViewProps) {
  const [details, setDetails] = useState<RatingDetails | null>(null);
  const [tab, setTab] = useState<"homework" | "exams" | "tests">("homework");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchRatingDetails(ratingId);
        if (cancelled) return;
        if (response.status && response.details) {
          setDetails(response.details);
        } else {
          setError("Детализация не найдена");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Ошибка загрузки");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [ratingId]);

  if (loading) {
    return <LoadingState label="Загрузка детализации…" variant="panel" />;
  }

  if (error || !details) {
    return (
      <div className={styles.page}>
        <p className={styles.errorText}>{error ?? "Нет данных"}</p>
        <AdminFullscreenBack onBack={onBack} label="К рейтингу" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <AdminFullscreenBack onBack={onBack} label="К рейтингу" />

      <header className={styles.pageHeader}>
        <div className={ratingStyles.detailsHeader}>
          <div>
            <h1 className={styles.pageTitle}>
              {studentName ? `Рейтинг: ${studentName}` : "Детализация рейтинга"}
            </h1>
            <div className={ratingStyles.detailsMeta}>
              <div className={ratingStyles.detailsMetaItem}>
                <span className={ratingStyles.detailsMetaLabel}>Период</span>
                <span className={ratingStyles.detailsMetaValue}>
                  {details.date_from} — {details.date_to}
                </span>
              </div>
              <div className={ratingStyles.detailsMetaItem}>
                <span className={ratingStyles.detailsMetaLabel}>Итоговый рейтинг</span>
                <span className={ratingStyles.detailsMetaValueLarge}>
                  {details.final_rating.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className={ratingStyles.sectionTabs}>
        {(
          [
            { id: "homework", label: "Домашние задания" },
            { id: "exams", label: "Экзамены" },
            { id: "tests", label: "Тесты" },
          ] as { id: typeof tab; label: string }[]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.directionTab} ${tab === item.id ? styles.directionTabActive : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "homework" ? (
        <section>
          <p className={ratingStyles.pageSubtitle}>
            Средний балл: <strong>{details.homework.rating.toFixed(2)}</strong>
          </p>
          <div className={ratingStyles.detailGrid}>
            {details.homework.details?.length ? (
              details.homework.details.map((item, index) => (
                <article
                  key={`${item.homework_id}-${index}`}
                  className={`${ratingStyles.detailCard} ${item.status === "Сдано" ? ratingStyles.detailCardSuccess : ratingStyles.detailCardMuted}`}
                >
                  <div className={ratingStyles.detailCardHeader}>
                    <h3 className={ratingStyles.detailCardTitle}>{item.name}</h3>
                    <span className={ratingStyles.detailScore}>{item.score.toFixed(2)}</span>
                  </div>
                  <p className={ratingStyles.detailInfo}>Дедлайн: {item.deadline ?? "—"}</p>
                  {item.date_pass ? (
                    <p className={ratingStyles.detailInfo}>Сдано: {item.date_pass}</p>
                  ) : null}
                  <p className={ratingStyles.detailInfo}>{item.status}</p>
                </article>
              ))
            ) : (
              <div className={ratingStyles.emptyState}>
                <p>Нет данных по домашним заданиям за период</p>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {tab === "exams" ? (
        <section>
          <p className={ratingStyles.pageSubtitle}>
            Средний балл: <strong>{details.exams.rating.toFixed(2)}</strong>
          </p>
          <div className={ratingStyles.detailGrid}>
            {details.exams.details?.length ? (
              details.exams.details.map((item, index) => (
                <article
                  key={`${item.exam_id}-${index}`}
                  className={`${ratingStyles.detailCard} ${item.score > 0 ? ratingStyles.detailCardSuccess : ratingStyles.detailCardMuted}`}
                >
                  <div className={ratingStyles.detailCardHeader}>
                    <h3 className={ratingStyles.detailCardTitle}>{item.exam_name}</h3>
                    <span className={ratingStyles.detailScore}>{item.score.toFixed(2)}</span>
                  </div>
                  <p className={ratingStyles.detailInfo}>Дата: {item.exam_date ?? "—"}</p>
                  <p className={ratingStyles.detailInfo}>{item.status}</p>
                </article>
              ))
            ) : (
              <div className={ratingStyles.emptyState}>
                <p>Нет данных по экзаменам за период</p>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {tab === "tests" ? (
        <section>
          <p className={ratingStyles.pageSubtitle}>
            Средний балл: <strong>{details.tests.rating.toFixed(2)}</strong>
          </p>
          {Object.keys(details.tests.directions ?? {}).length > 0 ? (
            <div className={ratingStyles.directionsGrid}>
              {Object.entries(details.tests.directions).map(([direction, score]) => (
                <div key={direction} className={ratingStyles.directionCard}>
                  <div className={ratingStyles.directionName}>{direction}</div>
                  <div className={ratingStyles.directionScore}>{score.toFixed(2)}</div>
                </div>
              ))}
            </div>
          ) : null}
          <div className={ratingStyles.detailGrid}>
            {details.tests.details?.length ? (
              details.tests.details.map((item, index) => (
                <article
                  key={`${item.test_id}-${index}`}
                  className={`${ratingStyles.detailCard} ${item.score > 0 ? ratingStyles.detailCardSuccess : ratingStyles.detailCardMuted}`}
                >
                  <div className={ratingStyles.detailCardHeader}>
                    <h3 className={ratingStyles.detailCardTitle}>{item.title}</h3>
                    <span className={ratingStyles.detailScore}>{item.score.toFixed(2)}</span>
                  </div>
                  <p className={ratingStyles.detailInfo}>Направление: {item.direction}</p>
                  <p className={ratingStyles.detailInfo}>{item.source}</p>
                </article>
              ))
            ) : (
              <div className={ratingStyles.emptyState}>
                <p>Нет данных по тестам за период</p>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
