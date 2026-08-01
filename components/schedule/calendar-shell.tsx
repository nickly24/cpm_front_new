"use client";

import { DayTimeline } from "@/components/schedule/day-timeline";
import { MobileDayStrip } from "@/components/schedule/mobile-day-strip";
import { MonthGrid } from "@/components/schedule/month-grid";
import styles from "@/components/schedule/schedule.module.css";
import { WeekGrid } from "@/components/schedule/week-grid";
import { DismissibleOverlay } from "@/components/ui/dismissible-overlay";
import { LoadingState } from "@/components/ui/loading-state";
import type { CalendarViewMode, ScheduleLesson } from "@/lib/schedule/types";
import {
  endOfWeekISO,
  formatDayHeading,
  formatMonthHeading,
  groupScheduleByDate,
  parseDateISO,
  startOfWeekISO,
} from "@/lib/schedule/utils";
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

interface CalendarShellProps {
  lessons: ScheduleLesson[];
  loading?: boolean;
  selectedDate: string;
  view: CalendarViewMode;
  onSelectedDateChange: (dateISO: string) => void;
  onViewChange: (view: CalendarViewMode) => void;
  onNavigate: (direction: -1 | 1) => void;
  onGoToday: () => void;
  onLessonClick?: (lesson: ScheduleLesson) => void;
  headerActions?: ReactNode;
  title?: string;
  subtitle?: string;
}

const VIEW_OPTIONS = [
  ["day", "День"],
  ["week", "Неделя"],
  ["month", "Месяц"],
] as const;

function ViewSwitch({
  view,
  onViewChange,
  className,
}: {
  view: CalendarViewMode;
  onViewChange: (view: CalendarViewMode) => void;
  className?: string;
}) {
  return (
    <div
      className={`${styles.viewSwitch} ${className ?? ""}`}
      role="tablist"
      aria-label="Вид"
    >
      {VIEW_OPTIONS.map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          role="tab"
          aria-selected={view === mode}
          className={`${styles.viewSwitchBtn} ${view === mode ? styles.viewSwitchBtnActive : ""}`}
          onClick={() => onViewChange(mode)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function PeriodNav({
  heading,
  onNavigate,
  onGoToday,
  compact,
}: {
  heading: string;
  onNavigate: (direction: -1 | 1) => void;
  onGoToday: () => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? styles.filtersPeriodNav : styles.toolbarNav}>
      <button type="button" className={styles.todayBtn} onClick={onGoToday}>
        Сегодня
      </button>
      <div className={styles.periodArrows}>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Назад"
          onClick={() => onNavigate(-1)}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Вперёд"
          onClick={() => onNavigate(1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <h2 className={styles.calendarHeading}>{heading}</h2>
    </div>
  );
}

export function CalendarShell({
  lessons,
  loading,
  selectedDate,
  view,
  onSelectedDateChange,
  onViewChange,
  onNavigate,
  onGoToday,
  onLessonClick,
  headerActions,
  title = "Расписание",
  subtitle,
}: CalendarShellProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const lessonsByDate = useMemo(
    () => groupScheduleByDate(lessons),
    [lessons],
  );

  const heading = useMemo(() => {
    if (view === "month") return formatMonthHeading(selectedDate);
    if (view === "week") {
      const from = parseDateISO(startOfWeekISO(selectedDate));
      const to = parseDateISO(endOfWeekISO(selectedDate));
      const fmt = new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "short",
      });
      return `${fmt.format(from)} — ${fmt.format(to)}`;
    }
    return formatDayHeading(selectedDate);
  }, [selectedDate, view]);

  const viewLabel =
    VIEW_OPTIONS.find(([mode]) => mode === view)?.[1] ?? "Неделя";

  const dayLessons = lessonsByDate[selectedDate] ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderText}>
          <h1 className={styles.pageTitle}>{title}</h1>
          {subtitle ? (
            <p className={styles.pageSubtitle}>{subtitle}</p>
          ) : null}
        </div>
        <div className={styles.headerActions}>{headerActions}</div>
      </header>

      {/* Desktop toolbar */}
      <div className={`${styles.calendarToolbar} ${styles.desktopOnlyInline}`}>
        <PeriodNav
          heading={heading}
          onNavigate={onNavigate}
          onGoToday={onGoToday}
        />
        <ViewSwitch view={view} onViewChange={onViewChange} />
      </div>

      {/* Mobile compact toolbar */}
      <div className={`${styles.mobileToolbar} ${styles.mobileOnly}`}>
        <div className={styles.mobileToolbarPeriod}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Назад"
            onClick={() => onNavigate(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className={styles.mobileToolbarHeading}>{heading}</h2>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Вперёд"
            onClick={() => onNavigate(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <button
          type="button"
          className={styles.filtersBtn}
          aria-label="Фильтры календаря"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal size={15} strokeWidth={2.25} />
          <span>{viewLabel}</span>
        </button>
      </div>

      {view === "day" ? (
        <div className={styles.mobileOnly}>
          <MobileDayStrip
            selectedDate={selectedDate}
            onSelectDate={onSelectedDateChange}
          />
        </div>
      ) : null}

      <div className={styles.calendarBody}>
        {loading ? (
          <LoadingState label="Загрузка расписания…" />
        ) : view === "day" ? (
          <DayTimeline
            dateISO={selectedDate}
            lessons={dayLessons}
            onLessonClick={onLessonClick}
          />
        ) : view === "week" ? (
          <>
            <div className={styles.desktopOnly}>
              <WeekGrid
                selectedDate={selectedDate}
                lessonsByDate={lessonsByDate}
                onSelectDate={onSelectedDateChange}
                onLessonClick={onLessonClick}
              />
            </div>
            <div className={styles.mobileOnly}>
              <WeekGrid
                selectedDate={selectedDate}
                lessonsByDate={lessonsByDate}
                onSelectDate={(date) => {
                  onSelectedDateChange(date);
                  onViewChange("day");
                }}
                onLessonClick={onLessonClick}
                compact
              />
            </div>
          </>
        ) : (
          <MonthGrid
            selectedDate={selectedDate}
            lessonsByDate={lessonsByDate}
            onSelectDate={onSelectedDateChange}
            onOpenDay={(date) => {
              onSelectedDateChange(date);
              onViewChange("day");
            }}
          />
        )}
      </div>

      {filtersOpen ? (
        <DismissibleOverlay
          className={styles.sheetOverlay}
          onDismiss={() => setFiltersOpen(false)}
        >
          <div
            className={`${styles.sheetPanel} ${styles.filtersSheet}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.sheetHandle} />
            <div className={styles.filtersSheetHeader}>
              <h3 className={styles.filtersSheetTitle}>Вид календаря</h3>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label="Закрыть"
                onClick={() => setFiltersOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <ViewSwitch
              view={view}
              onViewChange={onViewChange}
              className={styles.filtersViewSwitch}
            />

            <PeriodNav
              heading={heading}
              onNavigate={onNavigate}
              onGoToday={() => {
                onGoToday();
              }}
              compact
            />

            <button
              type="button"
              className={styles.filtersDoneBtn}
              onClick={() => setFiltersOpen(false)}
            >
              Готово
            </button>
          </div>
        </DismissibleOverlay>
      ) : null}
    </div>
  );
}
