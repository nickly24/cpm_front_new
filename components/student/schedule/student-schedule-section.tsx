"use client";

import styles from "@/components/schedule/schedule.module.css";
import { ScheduleBoard } from "@/components/schedule/schedule-board";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { fetchSchedule } from "@/lib/schedule/schedule-api";
import type { ScheduleLesson } from "@/lib/schedule/types";
import { getTodayDayName } from "@/lib/schedule/utils";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function StudentScheduleSection() {
  const [lessons, setLessons] = useState<ScheduleLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchSchedule();

      if (response.status) {
        setLessons(response.schedule ?? []);
      } else {
        setLessons([]);
        setError(response.error ?? "Не удалось загрузить расписание");
      }
    } catch (err) {
      setLessons([]);
      setError(
        err instanceof ApiError
          ? err.message
          : "Ошибка при загрузке расписания",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const today = getTodayDayName();

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Расписание</h1>
          <p className={styles.pageSubtitle}>
            Календарная сетка на неделю. Сегодня — {today.toLowerCase()}.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void loadSchedule()}
            disabled={loading}
          >
            <RefreshCw size={16} style={{ marginRight: 6 }} />
            Обновить
          </Button>
        </div>
      </header>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}

      <ScheduleBoard lessons={lessons} loading={loading} mode="view" />
    </div>
  );
}
