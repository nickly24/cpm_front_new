"use client";

import { LessonCard } from "@/components/schedule/lesson-card";
import styles from "@/components/schedule/schedule.module.css";
import { WEEKDAY_SHORT_RU } from "@/lib/schedule/constants";
import type { ScheduleLesson } from "@/lib/schedule/types";
import {
  addDaysISO,
  fromMinutes,
  getNowLinePercent,
  getTimelineBounds,
  layoutOverlappingLessons,
  lessonLayoutStyle,
  parseDateISO,
  startOfWeekISO,
  todayISO,
} from "@/lib/schedule/utils";
import { useMemo } from "react";

interface WeekGridProps {
  selectedDate: string;
  lessonsByDate: Record<string, ScheduleLesson[]>;
  onSelectDate: (dateISO: string) => void;
  onLessonClick?: (lesson: ScheduleLesson) => void;
  compact?: boolean;
}

export function WeekGrid({
  selectedDate,
  lessonsByDate,
  onSelectDate,
  onLessonClick,
  compact = false,
}: WeekGridProps) {
  const weekStart = startOfWeekISO(selectedDate);
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => addDaysISO(weekStart, index)),
    [weekStart],
  );
  const allLessons = days.flatMap((date) => lessonsByDate[date] ?? []);
  const bounds = getTimelineBounds(allLessons);
  const today = todayISO();

  const layoutsByDate = useMemo(() => {
    const map: Record<string, ReturnType<typeof layoutOverlappingLessons>> = {};
    for (const dateISO of days) {
      map[dateISO] = layoutOverlappingLessons(lessonsByDate[dateISO] ?? []);
    }
    return map;
  }, [days, lessonsByDate]);

  const dayWeights = useMemo(
    () =>
      days.map((dateISO) => {
        const layout = layoutsByDate[dateISO] ?? [];
        const maxCols = layout.reduce(
          (max, item) => Math.max(max, item.columnCount),
          1,
        );
        if (maxCols <= 1) return 1;
        if (maxCols === 2) return 1.65;
        return Math.min(2.4, 1.15 + maxCols * 0.4);
      }),
    [days, layoutsByDate],
  );

  const weekColumns = `3.25rem ${dayWeights.map((weight) => `${weight}fr`).join(" ")}`;

  if (compact) {
    return (
      <div className={styles.weekList}>
        {days.map((dateISO, index) => {
          const lessons = lessonsByDate[dateISO] ?? [];
          const date = parseDateISO(dateISO);
          return (
            <section key={dateISO} className={styles.weekListDay}>
              <button
                type="button"
                className={styles.weekListDayHeader}
                onClick={() => onSelectDate(dateISO)}
              >
                <span>
                  {WEEKDAY_SHORT_RU[index]}, {date.getDate()}
                </span>
                {dateISO === today ? (
                  <span className={styles.todayChip}>сегодня</span>
                ) : null}
              </button>
              {lessons.length ? (
                <div className={styles.weekListLessons}>
                  {lessons.map((lesson) => (
                    <LessonCard
                      key={lesson._id}
                      lesson={lesson}
                      compact
                      onClick={() => onLessonClick?.(lesson)}
                    />
                  ))}
                </div>
              ) : (
                <p className={styles.weekListEmpty}>Нет занятий</p>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className={styles.weekGrid}>
      <div className={styles.weekHeaderRow} style={{ gridTemplateColumns: weekColumns }}>
        <div className={styles.weekCorner} />
        {days.map((dateISO, index) => {
          const date = parseDateISO(dateISO);
          const isToday = dateISO === today;
          const isSelected = dateISO === selectedDate;
          return (
            <button
              key={dateISO}
              type="button"
              className={`${styles.weekDayHeader} ${isSelected ? styles.weekDayHeaderActive : ""} ${isToday ? styles.weekDayHeaderToday : ""}`}
              onClick={() => onSelectDate(dateISO)}
            >
              <span>{WEEKDAY_SHORT_RU[index]}</span>
              <span className={styles.weekDayNum}>{date.getDate()}</span>
            </button>
          );
        })}
      </div>
      <div className={styles.weekBody} style={{ gridTemplateColumns: weekColumns }}>
        <div className={styles.weekHoursCol}>
          {bounds.hourMarks.map((minute) => (
            <div
              key={minute}
              className={styles.weekHourLabel}
              style={{
                top: `${((minute - bounds.startMinute) / bounds.totalMinutes) * 100}%`,
              }}
            >
              {fromMinutes(minute)}
            </div>
          ))}
        </div>
        {days.map((dateISO) => {
          const layout = layoutsByDate[dateISO] ?? [];
          const nowPercent = getNowLinePercent(
            bounds.startMinute,
            bounds.totalMinutes,
            dateISO,
          );
          return (
            <div key={dateISO} className={styles.weekDayCol}>
              {bounds.hourMarks.map((minute) => (
                <div
                  key={`${dateISO}-${minute}`}
                  className={styles.timelineGridLine}
                  style={{
                    top: `${((minute - bounds.startMinute) / bounds.totalMinutes) * 100}%`,
                  }}
                />
              ))}
              {nowPercent != null ? (
                <div className={styles.nowLine} style={{ top: `${nowPercent}%` }}>
                  <span className={styles.nowDot} />
                </div>
              ) : null}
              {layout.map((item) => (
                <LessonCard
                  key={item.lesson._id}
                  lesson={item.lesson}
                  compact
                  className={styles.timelineLesson}
                  style={lessonLayoutStyle(
                    item,
                    bounds.startMinute,
                    bounds.totalMinutes,
                    { minHeightPercent: 3.5, gapPercent: 1.2 },
                  )}
                  onClick={() => onLessonClick?.(item.lesson)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
