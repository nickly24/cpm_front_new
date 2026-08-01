"use client";

import styles from "@/components/schedule/schedule.module.css";
import type { AdminSchool } from "@/lib/admin/admin-schools-types";
import { SCHEDULE_DEFAULT_COLOR, SCHEDULE_PRESET_COLORS } from "@/lib/schedule/constants";
import type { ScheduleLesson } from "@/lib/schedule/types";

export const PUBLIC_CALENDAR_KEY = "public";

export type ActiveCalendarKey = typeof PUBLIC_CALENDAR_KEY | `school:${number}`;

export function schoolCalendarKey(schoolId: number): ActiveCalendarKey {
  return `school:${schoolId}`;
}

export function schoolCalendarColor(schoolId: number): string {
  return SCHEDULE_PRESET_COLORS[schoolId % SCHEDULE_PRESET_COLORS.length];
}

export function filterLessonsByActiveCalendar(
  lessons: ScheduleLesson[],
  active: ActiveCalendarKey,
): ScheduleLesson[] {
  if (active === PUBLIC_CALENDAR_KEY) {
    return lessons.filter((lesson) => lesson.is_public !== false);
  }
  const schoolId = Number(active.slice("school:".length));
  return lessons.filter(
    (lesson) => lesson.is_public === false && lesson.school_id === schoolId,
  );
}

export function calendarLabel(
  active: ActiveCalendarKey,
  schools: AdminSchool[],
): string {
  if (active === PUBLIC_CALENDAR_KEY) return "Общие";
  const schoolId = Number(active.slice("school:".length));
  const school = schools.find((item) => item.school_id === schoolId);
  return school?.short_name || school?.name || `Школа ${schoolId}`;
}

interface ScheduleCalendarsPanelProps {
  schools: AdminSchool[];
  active: ActiveCalendarKey;
  onSelect: (key: ActiveCalendarKey) => void;
  onClose: () => void;
}

export function ScheduleCalendarsPanel({
  schools,
  active,
  onSelect,
  onClose,
}: ScheduleCalendarsPanelProps) {
  return (
    <aside className={styles.calendarsPanel}>
      <div className={styles.calendarsPanelHeader}>
        <h3 className={styles.calendarsPanelTitle}>Календари</h3>
        <button
          type="button"
          className={styles.panelToggleBtn}
          aria-label="Закрыть"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <p className={styles.calendarsHint}>
        Выберите один календарь — занятия других скрыты
      </p>
      <ul className={styles.calendarsList} role="listbox" aria-label="Календари">
        <li>
          <button
            type="button"
            role="option"
            aria-selected={active === PUBLIC_CALENDAR_KEY}
            className={`${styles.calendarPickItem} ${active === PUBLIC_CALENDAR_KEY ? styles.calendarPickItemActive : ""}`}
            onClick={() => onSelect(PUBLIC_CALENDAR_KEY)}
          >
            <span
              className={styles.calendarSwatch}
              style={{ background: SCHEDULE_DEFAULT_COLOR }}
            />
            <span className={styles.calendarName}>Общие</span>
            {active === PUBLIC_CALENDAR_KEY ? (
              <span className={styles.calendarPickCheck}>✓</span>
            ) : null}
          </button>
        </li>
        {schools.map((school) => {
          const key = schoolCalendarKey(school.school_id);
          const color = schoolCalendarColor(school.school_id);
          const selected = active === key;
          return (
            <li key={school.school_id}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                className={`${styles.calendarPickItem} ${selected ? styles.calendarPickItemActive : ""}`}
                onClick={() => onSelect(key)}
              >
                <span
                  className={styles.calendarSwatch}
                  style={{ background: color }}
                />
                <span className={styles.calendarName}>
                  {school.short_name || school.name}
                </span>
                {selected ? (
                  <span className={styles.calendarPickCheck}>✓</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
