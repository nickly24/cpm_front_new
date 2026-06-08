"use client";

import { CreateZapForm } from "@/components/student/zaps/create-zap-form";
import styles from "@/components/student/zaps/student-zaps.module.css";
import { ZapDetailView } from "@/components/student/zaps/zap-detail-view";
import { SectionHeroBanner } from "@/components/student/section-hero-banner";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/contexts/AuthContext";
import { STUDENT_SECTION_BANNERS } from "@/lib/student/section-banners";
import { fetchStudentZaps } from "@/lib/zaps/zaps-api";
import type { StudentZapListItem } from "@/lib/zaps/zaps-types";
import {
  getZapRequestStatusLabel,
  getZapRequestStatusTone,
} from "@/lib/zaps/zap-date-utils";
import { cn } from "@/lib/cn";
import { useCallback, useEffect, useState } from "react";

type ZapsView = "list" | "create" | "detail";

function listStatusBadgeClass(
  tone: ReturnType<typeof getZapRequestStatusTone>,
): string {
  switch (tone) {
    case "success":
      return styles.badgeSuccess;
    case "danger":
      return styles.badgeDanger;
    case "warning":
    default:
      return styles.badgeWarning;
  }
}

function formatDatesSummary(zap: StudentZapListItem): string | null {
  if (
    zap.linked_count != null &&
    zap.total_count != null &&
    zap.total_count > 0
  ) {
    return `Учтено ${zap.linked_count} из ${zap.total_count} дат`;
  }
  if (zap.dates && zap.dates.length > 0) {
    return `Даты: ${zap.dates.length}`;
  }
  return null;
}

export function StudentZapsSection() {
  const { user } = useAuth();
  const [view, setView] = useState<ZapsView>("list");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [zaps, setZaps] = useState<StudentZapListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadZaps = useCallback(async () => {
    if (!user?.id) {
      setError("ID ученика не найден");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchStudentZaps(user.id);
      setZaps(data);
    } catch (err) {
      setZaps([]);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (view === "list") {
      void loadZaps();
    }
  }, [view, loadZaps]);

  if (view === "create" && user?.id) {
    return (
      <div className={styles.page}>
        <SectionHeroBanner
          imageSrc={STUDENT_SECTION_BANNERS.zaps}
          eyebrow="Отгул"
          title="Новый запрос"
          subtitle="Подать информацию о пропуске по уважительной причине"
        />
        <CreateZapForm
          studentId={user.id}
          onBack={() => setView("list")}
          onCreated={() => setView("list")}
        />
      </div>
    );
  }

  if (view === "detail" && detailId != null) {
    return (
      <ZapDetailView
        zapId={detailId}
        onBack={() => {
          setDetailId(null);
          setView("list");
        }}
      />
    );
  }

  return (
    <div className={styles.page}>
      <SectionHeroBanner
        imageSrc={STUDENT_SECTION_BANNERS.zaps}
        eyebrow="Отгул"
        title="Запросы на отгул"
        subtitle="Подача и просмотр запросов на пропуск занятий"
      />

      <div className={styles.headerActions}>
        <Button type="button" onClick={() => setView("create")}>
          + Создать запрос
        </Button>
      </div>

      {loading ? (
        <LoadingState label="Загрузка запросов…" variant="panel" />
      ) : error ? (
        <p className={styles.alert}>{error}</p>
      ) : zaps.length === 0 ? (
        <div className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>Запросов пока нет</h2>
          <p className={styles.emptyText}>
            Создайте первый запрос, если пропустили занятие по уважительной
            причине.
          </p>
          <Button type="button" onClick={() => setView("create")}>
            Создать запрос
          </Button>
        </div>
      ) : (
        <div className={styles.zapsList}>
          {zaps.map((zap) => {
            const datesSummary = formatDatesSummary(zap);
            const tone = getZapRequestStatusTone(zap.status);
            return (
              <button
                key={zap.id}
                type="button"
                className={styles.zapCard}
                onClick={() => {
                  setDetailId(zap.id);
                  setView("detail");
                }}
              >
                <div className={styles.zapCardHeader}>
                  <span className={styles.zapCardId}>Запрос #{zap.id}</span>
                  <span
                    className={cn(styles.badge, listStatusBadgeClass(tone))}
                  >
                    {getZapRequestStatusLabel(zap.status)}
                  </span>
                </div>
                <p className={styles.zapCardText}>{zap.text}</p>
                {datesSummary ? (
                  <p className={styles.zapCardMeta}>{datesSummary}</p>
                ) : null}
                {zap.answer ? (
                  <p className={styles.zapCardAnswer}>
                    <strong>Ответ:</strong> {zap.answer}
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
