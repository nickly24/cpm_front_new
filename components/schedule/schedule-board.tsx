"use client";

import styles from "@/components/schedule/schedule.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import {
  SCHEDULE_DAYS,
  SCHEDULE_DAY_SHORT,
  type ScheduleDay,
} from "@/lib/schedule/constants";
import type { ScheduleLesson } from "@/lib/schedule/types";
import {
  fromMinutes,
  getLessonToneIndex,
  getTimelineBounds,
  getTodayDayName,
  groupScheduleByDay,
  toMinutes,
} from "@/lib/schedule/utils";
import { MapPin, Pencil, Trash2, UserRound } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";

const EVENT_TONE_CLASS = [
  styles.eventTone0,
  styles.eventTone1,
  styles.eventTone2,
  styles.eventTone3,
  styles.eventTone4,
  styles.eventTone5,
  styles.eventTone6,
] as const;

function getEventToneClass(lessonName: string): string {
  return EVENT_TONE_CLASS[getLessonToneIndex(lessonName)];
}

interface ScheduleBoardProps {
  lessons: ScheduleLesson[];
  loading?: boolean;
  mode?: "view" | "manage";
  onEditLesson?: (lesson: ScheduleLesson) => void;
  onDeleteLesson?: (lessonId: string) => void;
}

function EventToolbar({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={styles.eventToolbar}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={styles.eventToolBtn}
        aria-label="Редактировать"
        onClick={onEdit}
      >
        <Pencil size={13} strokeWidth={2.25} />
      </button>
      <button
        type="button"
        className={`${styles.eventToolBtn} ${styles.eventToolBtnDanger}`}
        aria-label="Удалить"
        onClick={onDelete}
      >
        <Trash2 size={13} strokeWidth={2.25} />
      </button>
    </div>
  );
}

function MobileLessonFooter({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={styles.mobileLessonFooter}
      onClick={(event) => event.stopPropagation()}
    >
      <button type="button" className={styles.footerAction} onClick={onEdit}>
        Изменить
      </button>
      <span className={styles.footerDivider} aria-hidden />
      <button
        type="button"
        className={`${styles.footerAction} ${styles.footerActionDanger}`}
        onClick={onDelete}
      >
        Удалить
      </button>
    </div>
  );
}

function EventCard({
  lesson,
  top,
  height,
  compact,
  mode,
  onEdit,
  onDelete,
}: {
  lesson: ScheduleLesson;
  top: number;
  height: number;
  compact: boolean;
  mode: "view" | "manage";
  onEdit?: (lesson: ScheduleLesson) => void;
  onDelete?: (lessonId: string) => void;
}) {
  const interactive = mode === "manage" && onEdit;
  const toneClass = getEventToneClass(lesson.lesson_name);

  const content = (
    <>
      {mode === "manage" && onEdit && onDelete ? (
        <EventToolbar
          onEdit={() => onEdit(lesson)}
          onDelete={() => onDelete(lesson._id)}
        />
      ) : null}
      <div className={styles.eventTime}>
        {lesson.start_time} – {lesson.end_time}
      </div>
      <div className={styles.eventTitle}>{lesson.lesson_name}</div>
      {!compact ? (
        <>
          <div className={styles.eventMeta}>{lesson.teacher_name}</div>
          <div className={styles.eventMeta}>{lesson.location}</div>
        </>
      ) : null}
    </>
  );

  const style = {
    top: `${top}%`,
    height: `${height}%`,
  } as CSSProperties;

  return (
    <article
      className={`${styles.event} ${toneClass} ${interactive ? `${styles.eventInteractive} ${styles.eventManage}` : ""}`}
      style={style}
      title={`${lesson.lesson_name} (${lesson.start_time}–${lesson.end_time})`}
      onClick={interactive ? () => onEdit?.(lesson) : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onEdit?.(lesson);
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      {content}
    </article>
  );
}

function MobileLessonCard({
  lesson,
  mode,
  onEdit,
  onDelete,
}: {
  lesson: ScheduleLesson;
  mode: "view" | "manage";
  onEdit?: (lesson: ScheduleLesson) => void;
  onDelete?: (lessonId: string) => void;
}) {
  const toneClass = getEventToneClass(lesson.lesson_name);
  const interactive = mode === "manage" && onEdit;

  const body = (
    <>
      <div className={styles.mobileLessonTime}>
        {lesson.start_time} – {lesson.end_time}
      </div>
      <h4 className={styles.mobileLessonTitle}>{lesson.lesson_name}</h4>
      <p className={styles.mobileLessonMeta}>
        <UserRound size={12} style={{ display: "inline", marginRight: 4 }} />
        {lesson.teacher_name}
      </p>
      <p className={styles.mobileLessonMeta}>
        <MapPin size={12} style={{ display: "inline", marginRight: 4 }} />
        {lesson.location}
      </p>
      {mode === "manage" && onEdit && onDelete ? (
        <MobileLessonFooter
          onEdit={() => onEdit(lesson)}
          onDelete={() => onDelete(lesson._id)}
        />
      ) : null}
    </>
  );

  return (
    <article
      className={`${styles.mobileLesson} ${toneClass} ${interactive ? styles.mobileLessonInteractive : ""}`}
      onClick={interactive ? () => onEdit?.(lesson) : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onEdit?.(lesson);
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      {body}
    </article>
  );
}

export function ScheduleBoard({
  lessons,
  loading = false,
  mode = "view",
  onEditLesson,
  onDeleteLesson,
}: ScheduleBoardProps) {
  const today = getTodayDayName();
  const [selectedDay, setSelectedDay] = useState<ScheduleDay>(today);

  const groupedSchedule = useMemo(() => groupScheduleByDay(lessons), [lessons]);
  const { startMinute, hourMarks, totalMinutes } = useMemo(
    () => getTimelineBounds(lessons),
    [lessons],
  );

  if (loading) {
    return <LoadingState label="Загрузка расписания…" variant="panel" />;
  }

  const renderDayColumn = (day: ScheduleDay) => {
    const dayLessons = groupedSchedule[day] ?? [];

    return (
      <div key={`col-${day}`} className={styles.dayCol}>
        <div className={styles.dayColBody}>
          {hourMarks.map((mark) => {
            const top = ((mark - startMinute) / totalMinutes) * 100;
            return (
              <div
                key={`${day}-${mark}`}
                className={styles.gridLine}
                style={{ top: `${top}%` }}
              />
            );
          })}

          {dayLessons.map((lesson) => {
            const start = toMinutes(lesson.start_time);
            const end = toMinutes(lesson.end_time);

            if (start == null || end == null || end <= start) {
              return null;
            }

            const duration = end - start;
            const top = ((start - startMinute) / totalMinutes) * 100;
            const height = Math.max(8, ((end - start) / totalMinutes) * 100);

            return (
              <EventCard
                key={lesson._id}
                lesson={lesson}
                top={top}
                height={height}
                compact={duration < 75}
                mode={mode}
                onEdit={onEditLesson}
                onDelete={onDeleteLesson}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.board}>
      <section className={styles.desktop} aria-label="Расписание на неделю">
        <div className={styles.gridScroll}>
          <div className={styles.grid}>
            <div className={styles.timeHead} />

            {SCHEDULE_DAYS.map((day) => (
              <div
                key={`head-${day}`}
                className={`${styles.dayHead} ${day === today ? styles.dayHeadToday : ""}`}
              >
                <span className={styles.dayHeadShort}>{SCHEDULE_DAY_SHORT[day]}</span>
                <span className={styles.dayHeadFull}>{day}</span>
              </div>
            ))}

            <div className={styles.timeCol}>
              {hourMarks.map((mark) => {
                const top = ((mark - startMinute) / totalMinutes) * 100;
                return (
                  <span
                    key={`time-${mark}`}
                    className={styles.timeLabel}
                    style={{ top: `${top}%` }}
                  >
                    {fromMinutes(mark)}
                  </span>
                );
              })}
            </div>

            {SCHEDULE_DAYS.map((day) => renderDayColumn(day))}
          </div>
        </div>
      </section>

      <section className={styles.mobile} aria-label="Расписание по дням">
        <div className={styles.mobileTabs} role="tablist">
          {SCHEDULE_DAYS.map((day) => (
            <button
              key={`mobile-${day}`}
              type="button"
              role="tab"
              aria-selected={selectedDay === day}
              className={`${styles.mobileTab} ${selectedDay === day ? styles.mobileTabActive : ""}`}
              onClick={() => setSelectedDay(day)}
            >
              <span className={styles.mobileTabLabel}>{SCHEDULE_DAY_SHORT[day]}</span>
              <span className={styles.mobileTabCount}>
                {(groupedSchedule[day] ?? []).length}
              </span>
            </button>
          ))}
        </div>

        <div className={styles.mobileDayTitle}>{selectedDay}</div>

        <div className={styles.mobileList}>
          {(groupedSchedule[selectedDay] ?? []).length === 0 ? (
            <div className={styles.empty}>
              <p>На этот день занятий нет</p>
            </div>
          ) : (
            (groupedSchedule[selectedDay] ?? []).map((lesson) => (
              <MobileLessonCard
                key={`m-${lesson._id}`}
                lesson={lesson}
                mode={mode}
                onEdit={onEditLesson}
                onDelete={onDeleteLesson}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
