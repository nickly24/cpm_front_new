"use client";

import styles from "@/components/student/attendance/student-attendance.module.css";
import { AttendanceQrCard } from "@/components/student/performance/attendance-qr-card";
import { SectionHeroBanner } from "@/components/student/section-hero-banner";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/contexts/AuthContext";
import { STUDENT_SECTION_BANNERS } from "@/lib/student/section-banners";
import {
  fetchStudentClassDayAttendance,
  fetchZapById,
} from "@/lib/attendance/attendance-api";
import type { StudentClassDayAttendanceItem } from "@/lib/attendance/attendance-types";
import {
  formatCardDate,
  getMonthRange,
  MONTH_NAMES,
  yearOptions,
} from "@/lib/attendance/attendance-utils";
import { useCallback, useEffect, useMemo, useState } from "react";

function zapStatusLabel(status: string): string {
  if (status === "apr") return "Одобрено";
  if (status === "dec") return "Отклонено";
  if (status === "set") return "На рассмотрении";
  return status;
}

function ZapDetailModal({
  zapId,
  onClose,
}: {
  zapId: number;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zap, setZap] = useState<Awaited<ReturnType<typeof fetchZapById>> | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void fetchZapById(zapId)
      .then((data) => {
        if (!cancelled) setZap(data);
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

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <h3 className={styles.modalTitle}>Запрос на отгул #{zapId}</h3>
        {loading ? <LoadingState label="Загрузка…" variant="compact" /> : null}
        {error ? <p className={styles.errorText}>{error}</p> : null}
        {zap?.zap ? (
          <>
            <p className={styles.modalText}>
              <strong>Статус:</strong> {zapStatusLabel(zap.zap.status)}
            </p>
            <p className={styles.modalText}>{zap.zap.text}</p>
            {zap.zap.answer ? (
              <p className={styles.modalText}>
                <strong>Ответ:</strong> {zap.zap.answer}
              </p>
            ) : null}
            {zap.images && zap.images.length > 0 ? (
              <div className={styles.imagesGrid}>
                {zap.images.map((image, index) =>
                  image.img_base64 ? (
                    image.file_type?.includes("pdf") ||
                    image.img_base64.includes("application/pdf") ? (
                      <div key={index} className={styles.pdfBadge}>
                        PDF
                      </div>
                    ) : (
                      <img
                        key={index}
                        src={image.img_base64}
                        alt={`Файл ${index + 1}`}
                        className={styles.image}
                      />
                    )
                  ) : null,
                )}
              </div>
            ) : null}
          </>
        ) : null}
        <div className={styles.modalClose}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}

export function StudentAttendanceSection() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<StudentClassDayAttendanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zapModalId, setZapModalId] = useState<number | null>(null);

  const { dateFrom, dateTo } = useMemo(
    () => getMonthRange(year, month),
    [year, month],
  );

  const loadAttendance = useCallback(async () => {
    if (!user?.id) {
      setError("ID ученика не найден");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStudentClassDayAttendance(
        user.id,
        dateFrom,
        dateTo,
      );
      setItems(
        [...data].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        ),
      );
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [user?.id, dateFrom, dateTo]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  return (
    <div className={styles.page}>
      <SectionHeroBanner
        imageSrc={STUDENT_SECTION_BANNERS.attendance}
        title="Посещаемость"
        subtitle="Отметки по дням занятий"
      />

      <AttendanceQrCard />

      <div className={styles.controls}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="student-att-year">
            Год
          </label>
          <select
            id="student-att-year"
            className={styles.select}
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {yearOptions(now.getFullYear(), 5).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="student-att-month">
            Месяц
          </label>
          <select
            id="student-att-month"
            className={styles.select}
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
          >
            {MONTH_NAMES.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Загрузка посещаемости…" variant="panel" />
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : items.length === 0 ? (
        <div className={styles.emptyState}>
          За выбранный месяц нет записей о посещаемости.
        </div>
      ) : (
        <div className={styles.cardsGrid}>
          {items.map((item) => {
            const formatted = formatCardDate(item.date);
            return (
              <article
                key={`${item.class_day_id}-${item.date}`}
                className={styles.card}
              >
                <div className={styles.cardDate}>{formatted.dayMonth}</div>
                <p className={styles.cardWeekday}>{formatted.weekday}</p>
                {item.comment ? (
                  <p className={styles.cardComment}>{item.comment}</p>
                ) : null}
                <span className={styles.typeBadge}>{item.type_name}</span>
                {item.zap_id != null ? (
                  <button
                    type="button"
                    className={styles.zapLink}
                    onClick={() => setZapModalId(item.zap_id)}
                  >
                    Подробнее об отгуле #{item.zap_id}
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {zapModalId != null ? (
        <ZapDetailModal
          zapId={zapModalId}
          onClose={() => setZapModalId(null)}
        />
      ) : null}
    </div>
  );
}
