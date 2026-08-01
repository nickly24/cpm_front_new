"use client";

import styles from "@/components/schedule/schedule.module.css";
import { WEEKDAY_SHORT_RU } from "@/lib/schedule/constants";
import type { ScheduleLesson } from "@/lib/schedule/types";
import {
  getMonthGridDates,
  parseDateISO,
  startOfMonthISO,
  todayISO,
} from "@/lib/schedule/utils";
import { useState } from "react";

interface MonthGridProps {
  selectedDate: string;
  lessonsByDate: Record<string, ScheduleLesson[]>;
  onSelectDate: (dateISO: string) => void;
  onOpenDay: (dateISO: string) => void;
}

export function MonthGrid({
  selectedDate,
  lessonsByDate,
  onSelectDate,
  onOpenDay,
}: MonthGridProps) {
  const dates = getMonthGridDates(selectedDate);
  const monthPrefix = startOfMonthISO(selectedDate).slice(0, 7);
  const today = todayISO();
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  return (
    <div className={styles.monthGrid}>
      <div className={styles.monthWeekdays}>
        {WEEKDAY_SHORT_RU.map((label, index) => (
          <div
            key={label}
            className={`${styles.monthWeekday} ${index >= 5 ? styles.monthWeekend : ""}`}
          >
            {label}
          </div>
        ))}
      </div>
      <div className={styles.monthCells}>
        {dates.map((dateISO, index) => {
          const inMonth = dateISO.startsWith(monthPrefix);
          const lessons = lessonsByDate[dateISO] ?? [];
          const isToday = dateISO === today;
          const isSelected = dateISO === selectedDate;
          const date = parseDateISO(dateISO);
          const col = index % 7;
          const isWeekend = col >= 5;
          const popupOnLeft = col >= 5;
          const showPopup = hoveredDate === dateISO && lessons.length > 0;

          return (
            <div
              key={dateISO}
              className={styles.monthCellWrap}
              onMouseEnter={() => setHoveredDate(dateISO)}
              onMouseLeave={() => setHoveredDate(null)}
            >
              <button
                type="button"
                className={[
                  styles.monthCell,
                  inMonth ? "" : styles.monthCellMuted,
                  isWeekend ? styles.monthWeekend : "",
                  isSelected ? styles.monthCellSelected : "",
                  isToday ? styles.monthCellToday : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  onSelectDate(dateISO);
                  onOpenDay(dateISO);
                }}
              >
                <span
                  className={[
                    styles.monthCellDay,
                    isToday ? styles.monthCellDayToday : "",
                    isSelected && !isToday ? styles.monthCellDaySelected : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {date.getDate()}
                </span>
                {lessons.length > 0 ? (
                  <div className={styles.monthDots}>
                    {lessons.slice(0, 3).map((lesson) => (
                      <span
                        key={lesson._id}
                        className={styles.monthDot}
                        style={{ background: lesson.color || "#5B8DEF" }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={styles.monthDotsSpacer} />
                )}
              </button>

              {showPopup ? (
                <div
                  className={`${styles.monthPopup} ${popupOnLeft ? styles.monthPopupLeft : ""}`}
                  role="tooltip"
                >
                  <div className={styles.monthPopupDate}>
                    {new Intl.DateTimeFormat("ru-RU", {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                    }).format(date)}
                  </div>
                  <ul className={styles.monthPopupList}>
                    {lessons.map((lesson) => (
                      <li key={lesson._id} className={styles.monthPopupItem}>
                        <span
                          className={styles.monthPopupDot}
                          style={{ background: lesson.color || "#5B8DEF" }}
                        />
                        <span className={styles.monthPopupTime}>
                          {lesson.start_time}–{lesson.end_time}
                        </span>
                        <span className={styles.monthPopupName}>
                          {lesson.lesson_name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
