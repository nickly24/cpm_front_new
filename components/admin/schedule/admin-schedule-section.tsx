"use client";

import {
  AdminInspectorIdle,
  AdminLessonForm,
} from "@/components/admin/schedule/admin-lesson-form";
import { CalendarShell } from "@/components/schedule/calendar-shell";
import {
  calendarLabel,
  filterLessonsByActiveCalendar,
  PUBLIC_CALENDAR_KEY,
  ScheduleCalendarsPanel,
  type ActiveCalendarKey,
} from "@/components/schedule/schedule-calendars-panel";
import styles from "@/components/schedule/schedule.module.css";
import { DismissibleOverlay } from "@/components/ui/dismissible-overlay";
import { ApiError } from "@/lib/api/client";
import { fetchAdminSchools } from "@/lib/admin/admin-schools-api";
import type { AdminSchool } from "@/lib/admin/admin-schools-types";
import {
  createScheduleLesson,
  deleteScheduleLesson,
  fetchSchedule,
  updateScheduleLesson,
} from "@/lib/schedule/schedule-api";
import type {
  CalendarViewMode,
  ScheduleLesson,
  ScheduleLessonFormData,
} from "@/lib/schedule/types";
import {
  getFetchRange,
  lessonToFormData,
  shiftSelectedDate,
  todayISO,
} from "@/lib/schedule/utils";
import { ChevronDown, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type RightPanel =
  | { type: "calendars" }
  | { type: "create" }
  | { type: "edit"; lesson: ScheduleLesson }
  | null;

function useIsMobileSheet() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 900px)").matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return isMobile;
}

export function AdminScheduleSection() {
  const [lessons, setLessons] = useState<ScheduleLesson[]>([]);
  const [schools, setSchools] = useState<AdminSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [view, setView] = useState<CalendarViewMode>("week");
  const [actionBusy, setActionBusy] = useState(false);
  const [panel, setPanel] = useState<RightPanel>(null);
  const [activeCalendar, setActiveCalendar] =
    useState<ActiveCalendarKey>(PUBLIC_CALENDAR_KEY);
  const isMobile = useIsMobileSheet();

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

  useEffect(() => {
    void fetchAdminSchools(true)
      .then(setSchools)
      .catch(() => setSchools([]));
  }, []);

  const visibleLessons = useMemo(
    () => filterLessonsByActiveCalendar(lessons, activeCalendar),
    [lessons, activeCalendar],
  );

  const activeLabel = calendarLabel(activeCalendar, schools);

  const handleCreate = async (data: ScheduleLessonFormData) => {
    setActionBusy(true);
    try {
      const response = await createScheduleLesson(data);
      if (!response.status) {
        throw new Error(response.error ?? "Не удалось добавить занятие");
      }
      await loadSchedule();
      setPanel(null);
    } finally {
      setActionBusy(false);
    }
  };

  const handleUpdate = async (lessonId: string, data: ScheduleLessonFormData) => {
    setActionBusy(true);
    try {
      const response = await updateScheduleLesson(lessonId, data);
      if (!response.status) {
        throw new Error(response.error ?? "Не удалось обновить занятие");
      }
      await loadSchedule();
      setPanel(null);
    } finally {
      setActionBusy(false);
    }
  };

  const handleDelete = async (lessonId: string) => {
    const lesson = lessons.find((item) => item._id === lessonId);
    const label = lesson?.lesson_name ?? "занятие";
    if (!window.confirm(`Удалить «${label}» из расписания?`)) {
      return;
    }
    setActionBusy(true);
    setError(null);
    try {
      const response = await deleteScheduleLesson(lessonId);
      if (!response.status) {
        throw new Error(response.error ?? "Не удалось удалить занятие");
      }
      setPanel(null);
      await loadSchedule();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Ошибка удаления",
      );
    } finally {
      setActionBusy(false);
    }
  };

  const closePanel = () => setPanel(null);

  const selectCalendar = (key: ActiveCalendarKey) => {
    setActiveCalendar(key);
    setPanel(null);
  };

  const panelContent = (() => {
    if (!panel) return null;

    if (panel.type === "calendars") {
      return (
        <ScheduleCalendarsPanel
          schools={schools}
          active={activeCalendar}
          onSelect={selectCalendar}
          onClose={closePanel}
        />
      );
    }

    if (panel.type === "create") {
      return (
        <AdminLessonForm
          mode="create"
          variant="inspector"
          schools={schools}
          defaultDate={selectedDate}
          onClose={closePanel}
          onSubmit={handleCreate}
        />
      );
    }

    if (panel.type === "edit") {
      return (
        <AdminLessonForm
          key={panel.lesson._id}
          mode="edit"
          variant="inspector"
          schools={schools}
          defaultDate={selectedDate}
          initialData={lessonToFormData(panel.lesson)}
          onClose={closePanel}
          onSubmit={(data) => handleUpdate(panel.lesson._id, data)}
          onDelete={() => handleDelete(panel.lesson._id)}
        />
      );
    }

    return <AdminInspectorIdle selectedDate={selectedDate} />;
  })();

  const overlayClass = isMobile
    ? styles.sheetOverlay
    : `${styles.sideDrawerOverlay} ${styles.sideDrawerOverlayRight}`;
  const panelClass = isMobile
    ? styles.sheetPanel
    : `${styles.sideDrawer} ${styles.sideDrawerRight}`;

  return (
    <div className={styles.adminLayout}>
      <div className={styles.adminLayoutMain}>
        {error ? <div className={styles.errorBanner}>{error}</div> : null}
        <CalendarShell
          title="Расписание"
          subtitle={`Календарь: ${activeLabel}`}
          lessons={visibleLessons}
          loading={loading}
          selectedDate={selectedDate}
          view={view}
          onSelectedDateChange={setSelectedDate}
          onViewChange={setView}
          onNavigate={(direction) =>
            setSelectedDate((prev) => shiftSelectedDate(prev, view, direction))
          }
          onGoToday={() => setSelectedDate(todayISO())}
          onLessonClick={(lesson) => setPanel({ type: "edit", lesson })}
          headerActions={
            <>
              <button
                type="button"
                className={styles.calendarSelectBtn}
                onClick={() => setPanel({ type: "calendars" })}
              >
                <span className={styles.calendarSelectLabel}>{activeLabel}</span>
                <ChevronDown size={16} />
              </button>
              <button
                type="button"
                className={styles.refreshIconBtn}
                aria-label="Обновить"
                title="Обновить"
                onClick={() => void loadSchedule()}
                disabled={loading || actionBusy}
              >
                <RefreshCw size={17} strokeWidth={2.25} />
              </button>
              <button
                type="button"
                className={styles.createPlusBtn}
                aria-label="Добавить занятие"
                title="Добавить"
                onClick={() => setPanel({ type: "create" })}
                disabled={actionBusy}
              >
                <Plus size={20} strokeWidth={2.4} aria-hidden />
              </button>
            </>
          }
        />
      </div>

      {panel && panelContent ? (
        <DismissibleOverlay className={overlayClass} onDismiss={closePanel}>
          <div
            className={panelClass}
            onClick={(event) => event.stopPropagation()}
          >
            {isMobile ? <div className={styles.sheetHandle} /> : null}
            <div className={styles.rightPanelBody}>{panelContent}</div>
          </div>
        </DismissibleOverlay>
      ) : null}
    </div>
  );
}
