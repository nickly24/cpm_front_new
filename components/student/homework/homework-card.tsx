import {
  formatHomeworkDate,
  formatHomeworkScore,
  getDeadlineHint,
  getHomeworkDeadlineState,
  isHomeworkSubmitted,
} from "@/lib/student/homework-api";
import type { StudentHomeworkItem } from "@/lib/student/homework-types";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import styles from "./homework.module.css";

interface HomeworkCardProps {
  item: StudentHomeworkItem;
}

export function HomeworkCard({ item }: HomeworkCardProps) {
  const deadlineState = getHomeworkDeadlineState(item);
  const submitted = isHomeworkSubmitted(item);
  const score = formatHomeworkScore(item.result);

  return (
    <article className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{item.homework_name}</h3>
        <p className={styles.cardHint}>{getDeadlineHint(deadlineState)}</p>
      </div>

      <div className={styles.badges}>
        <span className={`${styles.badge} ${styles.badgeType}`}>
          {item.homework_type}
        </span>
        <span className={`${styles.badge} ${styles.badgeDeadline}`}>
          <CalendarDays size={14} />
          {formatHomeworkDate(item.deadline)}
        </span>
        <span
          className={`${styles.badge} ${
            submitted ? styles.badgeDone : styles.badgeUndone
          }`}
        >
          {submitted ? <CheckCircle2 size={14} /> : null}
          {item.status}
        </span>
      </div>

      {submitted && score ? (
        <div className={styles.score}>
          <span className={styles.scoreLabel}>Балл</span>
          <span className={styles.scoreValue}>{score}</span>
        </div>
      ) : null}
    </article>
  );
}
