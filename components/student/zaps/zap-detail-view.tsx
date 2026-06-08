"use client";

import styles from "@/components/student/zaps/student-zaps.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchZapById } from "@/lib/zaps/zaps-api";
import type { ZapDateItem, ZapDateStatus } from "@/lib/zaps/zaps-types";
import {
  formatZapDate,
  getZapDateBadgeTone,
  getZapDateStatusLabel,
  getZapRequestStatusLabel,
  getZapRequestStatusTone,
  isPdfAttachment,
} from "@/lib/zaps/zap-date-utils";
import { cn } from "@/lib/cn";
import { useEffect, useState } from "react";

interface ZapDetailViewProps {
  zapId: number;
  onBack: () => void;
}

function statusBadgeClass(tone: ReturnType<typeof getZapDateBadgeTone>): string {
  switch (tone) {
    case "success":
      return styles.badgeSuccess;
    case "danger":
      return styles.badgeDanger;
    case "warning":
      return styles.badgeWarning;
    default:
      return styles.badgeMuted;
  }
}

function DateStatusBadge({ item }: { item: ZapDateItem }) {
  const status = item.status as ZapDateStatus;
  const tone = getZapDateBadgeTone(status);
  return (
    <span className={cn(styles.badge, statusBadgeClass(tone))}>
      {getZapDateStatusLabel(status, item.status_label)}
    </span>
  );
}

export function ZapDetailView({ zapId, onBack }: ZapDetailViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchZapById>> | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchZapById(zapId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Ошибка загрузки");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [zapId]);

  const zap = detail?.zap;
  const dates = detail?.dates ?? [];
  const images = detail?.images ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.backBar}>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          ← К списку запросов
        </Button>
      </div>

      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Отгул</span>
          <h1 className={styles.title}>Запрос #{zapId}</h1>
          {zap ? (
            <span
              className={cn(
                styles.badge,
                statusBadgeClass(getZapRequestStatusTone(zap.status)),
              )}
            >
              {getZapRequestStatusLabel(zap.status)}
            </span>
          ) : null}
        </div>
      </header>

      {loading ? (
        <LoadingState label="Загрузка запроса…" variant="panel" />
      ) : error ? (
        <p className={styles.alert}>{error}</p>
      ) : !zap ? (
        <p className={styles.alert}>Запрос не найден</p>
      ) : (
        <div className={styles.panel}>
          <section className={styles.detailSection}>
            <p className={styles.detailLabel}>Текст запроса</p>
            <p className={styles.detailText}>{zap.text}</p>
          </section>

          {zap.answer ? (
            <section className={styles.detailSection}>
              <p className={styles.detailLabel}>Ответ администратора</p>
              <p className={styles.detailText}>{zap.answer}</p>
            </section>
          ) : null}

          {dates.length > 0 ? (
            <section>
              <p className={styles.detailLabel}>Даты</p>
              <div className={styles.datesTableWrap}>
                <table className={styles.datesTable}>
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dates.map((item) => (
                      <tr key={item.date}>
                        <td>{formatZapDate(item.date)}</td>
                        <td>
                          <DateStatusBadge item={item} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {images.length > 0 ? (
            <section>
              <p className={styles.imagesSectionTitle}>Вложения</p>
              <div className={styles.imagesGrid}>
                {images.map((image, index) => {
                  if (!image.img_base64) return null;
                  const isPdf = isPdfAttachment(
                    image.file_type,
                    image.img_base64,
                  );
                  if (isPdf) {
                    return (
                      <a
                        key={index}
                        href={image.img_base64}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(styles.imageWrap, styles.pdfLink)}
                      >
                        PDF — открыть
                      </a>
                    );
                  }
                  return (
                    <div key={index} className={styles.imageWrap}>
                      <img
                        src={image.img_base64}
                        alt={`Вложение ${index + 1}`}
                        className={styles.image}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
