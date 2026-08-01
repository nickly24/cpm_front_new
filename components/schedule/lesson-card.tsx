"use client";

import styles from "@/components/schedule/schedule.module.css";
import type { ScheduleLesson } from "@/lib/schedule/types";
import { hexTintOpaque } from "@/lib/schedule/utils";
import { Clock3, MapPin, School, UserRound } from "lucide-react";
import type { CSSProperties } from "react";

interface LessonCardProps {
  lesson: ScheduleLesson;
  compact?: boolean;
  style?: CSSProperties;
  className?: string;
  onClick?: () => void;
}

export function LessonCard({
  lesson,
  compact = false,
  style,
  className,
  onClick,
}: LessonCardProps) {
  const color = lesson.color || "#5B8DEF";
  const cardStyle: CSSProperties = {
    ...style,
    ["--lesson-color" as string]: color,
    ["--lesson-bg" as string]: hexTintOpaque(color, 0.22),
    ["--lesson-border" as string]: color,
  };

  const place = [lesson.location, lesson.classroom].filter(Boolean).join(" · ");
  const iconSize = compact ? 9 : 10;

  return (
    <button
      type="button"
      className={`${styles.lessonCard} ${compact ? styles.lessonCardCompact : ""} ${className ?? ""}`}
      style={cardStyle}
      onClick={onClick}
    >
      <div className={styles.lessonCardTop}>
        <span className={styles.lessonTitle}>{lesson.lesson_name}</span>
        <span className={styles.lessonCardIcons}>
          {!lesson.is_public ? (
            <span className={styles.schoolBadge} title="Школьное занятие">
              <School size={iconSize + 1} strokeWidth={2.25} />
            </span>
          ) : null}
          {lesson.is_changed ? (
            <span className={styles.changedBadge}>Изменено</span>
          ) : null}
        </span>
      </div>

      <div className={styles.lessonMetaRow}>
        <Clock3 size={iconSize} strokeWidth={2} className={styles.lessonMetaIcon} />
        <span>
          {lesson.start_time}–{lesson.end_time}
        </span>
      </div>

      {place ? (
        <div className={styles.lessonMetaRow}>
          <MapPin size={iconSize} strokeWidth={2} className={styles.lessonMetaIcon} />
          <span className={styles.lessonMetaTruncate}>{place}</span>
        </div>
      ) : null}

      {!compact && lesson.teacher_name ? (
        <div className={styles.lessonMetaRow}>
          <UserRound size={iconSize} strokeWidth={2} className={styles.lessonMetaIcon} />
          <span className={styles.lessonMetaTruncate}>{lesson.teacher_name}</span>
        </div>
      ) : null}
    </button>
  );
}
