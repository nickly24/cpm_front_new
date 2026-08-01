"use client";

import { CalendarShell } from "@/components/schedule/calendar-shell";
import { LessonDetailsSheet } from "@/components/schedule/lesson-details-sheet";
import styles from "@/components/schedule/schedule.module.css";
import { ApiError } from "@/lib/api/client";
import { fetchSchedule } from "@/lib/schedule/schedule-api";
import type { CalendarViewMode, ScheduleLesson } from "@/lib/schedule/types";
import {
  getFetchRange,
  shiftSelectedDate,
  todayISO,
} from "@/lib/schedule/utils";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

export function StudentScheduleSection() {
  const [lessons, setLessons] = useState<ScheduleLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [view, setView] = useState<CalendarViewMode>("week");
  const [details, setDetails] = useState<ScheduleLesson | null>(null);

  const range = useMemo(
    () => getFetchRange(selectedDate, view),
    [selectedDate, view],
  );

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchSchedule(range);
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
  }, [range]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  return (
    <div className={styles.scheduleFill}>
      {error ? <div className={styles.errorBanner}>{error}</div> : null}
      <CalendarShell
        title="Расписание"
        subtitle="Общие занятия и занятия вашей школы"
        lessons={lessons}
        loading={loading}
        selectedDate={selectedDate}
        view={view}
        onSelectedDateChange={setSelectedDate}
        onViewChange={setView}
        onNavigate={(direction) =>
          setSelectedDate((prev) => shiftSelectedDate(prev, view, direction))
        }
        onGoToday={() => setSelectedDate(todayISO())}
        onLessonClick={setDetails}
        headerActions={
          <button
            type="button"
            className={styles.refreshIconBtn}
            aria-label="Обновить"
            title="Обновить"
            onClick={() => void loadSchedule()}
            disabled={loading}
          >
            <RefreshCw size={17} strokeWidth={2.25} />
          </button>
        }
      />
      {details ? (
        <LessonDetailsSheet
          lesson={details}
          onClose={() => setDetails(null)}
        />
      ) : null}
    </div>
  );
}
