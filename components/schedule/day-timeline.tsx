"use client";

import { LessonCard } from "@/components/schedule/lesson-card";
import styles from "@/components/schedule/schedule.module.css";
import type { ScheduleLesson } from "@/lib/schedule/types";
import {
  fromMinutes,
  getNowLinePercent,
  getTimelineBounds,
  layoutOverlappingLessons,
  lessonLayoutStyle,
} from "@/lib/schedule/utils";
import { useMemo } from "react";

interface DayTimelineProps {
  dateISO: string;
  lessons: ScheduleLesson[];
  onLessonClick?: (lesson: ScheduleLesson) => void;
}

export function DayTimeline({
  dateISO,
  lessons,
  onLessonClick,
}: DayTimelineProps) {
  const bounds = getTimelineBounds(lessons);
  const nowPercent = getNowLinePercent(
    bounds.startMinute,
    bounds.totalMinutes,
    dateISO,
  );
  const layout = useMemo(
    () => layoutOverlappingLessons(lessons),
    [lessons],
  );

  return (
    <div className={styles.timeline}>
      <div className={styles.timelineHours}>
        {bounds.hourMarks.map((minute) => (
          <div
            key={minute}
            className={styles.timelineHour}
            style={{
              top: `${((minute - bounds.startMinute) / bounds.totalMinutes) * 100}%`,
            }}
          >
            {fromMinutes(minute)}
          </div>
        ))}
      </div>
      <div className={styles.timelineTrack}>
        {bounds.hourMarks.map((minute) => (
          <div
            key={`line-${minute}`}
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
            className={styles.timelineLesson}
            style={lessonLayoutStyle(
              item,
              bounds.startMinute,
              bounds.totalMinutes,
              { minHeightPercent: 4 },
            )}
            onClick={() => onLessonClick?.(item.lesson)}
          />
        ))}
        {!lessons.length ? (
          <div className={styles.emptyHint}>Нет занятий в этот день</div>
        ) : null}
      </div>
    </div>
  );
}
