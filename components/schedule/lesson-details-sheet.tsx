"use client";

import styles from "@/components/schedule/schedule.module.css";
import { DismissibleOverlay } from "@/components/ui/dismissible-overlay";
import type { ScheduleLesson } from "@/lib/schedule/types";
import { formatDayHeading } from "@/lib/schedule/utils";
import {
  Clock3,
  DoorOpen,
  MapPin,
  School,
  UserRound,
  Users,
  X,
} from "lucide-react";

interface LessonDetailsSheetProps {
  lesson: ScheduleLesson;
  onClose: () => void;
}

export function LessonDetailsSheet({ lesson, onClose }: LessonDetailsSheetProps) {
  const color = lesson.color || "#5B8DEF";

  return (
    <DismissibleOverlay className={styles.sheetOverlay} onDismiss={onClose}>
      <div
        className={`${styles.sheetPanel} ${styles.lessonDetailsPanel}`}
        onClick={(event) => event.stopPropagation()}
        style={{ ["--lesson-color" as string]: color }}
      >
        <div className={styles.sheetHandle} />

        <div className={styles.lessonDetailsAccent} aria-hidden />

        <div className={styles.lessonDetailsHeader}>
          <div className={styles.lessonDetailsHeaderText}>
            <h3 className={styles.lessonDetailsTitle}>{lesson.lesson_name}</h3>
            <p className={styles.lessonDetailsDate}>
              {formatDayHeading(lesson.date)}
            </p>
          </div>
          <button
            type="button"
            className={styles.lessonDetailsClose}
            aria-label="Закрыть"
            onClick={onClose}
          >
            <X size={18} strokeWidth={2.25} />
          </button>
        </div>

        <div className={styles.lessonDetailsBadges}>
          {lesson.is_changed ? (
            <span className={styles.changedBadge}>Изменено</span>
          ) : null}
          {lesson.is_public ? (
            <span className={styles.lessonDetailsChip}>
              <Users size={12} strokeWidth={2.25} />
              Общее
            </span>
          ) : (
            <span className={styles.lessonDetailsChip}>
              <School size={12} strokeWidth={2.25} />
              Школьное
            </span>
          )}
        </div>

        <ul className={styles.lessonDetailsList}>
          <li className={styles.lessonDetailsRow}>
            <span className={styles.lessonDetailsIcon}>
              <Clock3 size={16} strokeWidth={2.25} />
            </span>
            <span className={styles.lessonDetailsRowText}>
              <span className={styles.lessonDetailsRowLabel}>Время</span>
              <span className={styles.lessonDetailsRowValue}>
                {lesson.start_time}–{lesson.end_time}
              </span>
            </span>
          </li>

          {lesson.teacher_name ? (
            <li className={styles.lessonDetailsRow}>
              <span className={styles.lessonDetailsIcon}>
                <UserRound size={16} strokeWidth={2.25} />
              </span>
              <span className={styles.lessonDetailsRowText}>
                <span className={styles.lessonDetailsRowLabel}>Преподаватель</span>
                <span className={styles.lessonDetailsRowValue}>
                  {lesson.teacher_name}
                </span>
              </span>
            </li>
          ) : null}

          {lesson.location ? (
            <li className={styles.lessonDetailsRow}>
              <span className={styles.lessonDetailsIcon}>
                <MapPin size={16} strokeWidth={2.25} />
              </span>
              <span className={styles.lessonDetailsRowText}>
                <span className={styles.lessonDetailsRowLabel}>Локация</span>
                <span className={styles.lessonDetailsRowValue}>
                  {lesson.location}
                </span>
              </span>
            </li>
          ) : null}

          {lesson.classroom ? (
            <li className={styles.lessonDetailsRow}>
              <span className={styles.lessonDetailsIcon}>
                <DoorOpen size={16} strokeWidth={2.25} />
              </span>
              <span className={styles.lessonDetailsRowText}>
                <span className={styles.lessonDetailsRowLabel}>Аудитория</span>
                <span className={styles.lessonDetailsRowValue}>
                  {lesson.classroom}
                </span>
              </span>
            </li>
          ) : null}
        </ul>
      </div>
    </DismissibleOverlay>
  );
}
