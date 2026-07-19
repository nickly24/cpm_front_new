import {
  formatHomeworkDate,
  formatHomeworkScore,
  getDeadlineHint,
  getHomeworkDeadlineState,
  isHomeworkSubmitted,
} from "@/lib/student/homework-api";
import type { StudentHomeworkItem } from "@/lib/student/homework-types";
import { Atom, Beaker, BookOpen, Braces, CalendarDays, FileText, Languages } from "lucide-react";
import styles from "./homework.module.css";

interface HomeworkCardProps {
  item: StudentHomeworkItem;
  onOpen?: () => void;
}

export function HomeworkCard({ item, onOpen }: HomeworkCardProps) {
  const deadlineState = getHomeworkDeadlineState(item);
  const submitted = isHomeworkSubmitted(item);
  const score = formatHomeworkScore(item.result);
  const lower = `${item.homework_name} ${item.homework_type}`.toLowerCase();
  const SubjectIcon = lower.includes("хим") ? Beaker : lower.includes("язык") ? Languages : lower.includes("информ") ? Braces : lower.includes("физ") ? Atom : BookOpen;

  return (
    <article className={styles.card}>
      <div className={styles.subjectLine}><span className={styles.subjectIcon}><SubjectIcon /></span><span>{item.homework_type}</span></div>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{item.homework_name}</h3>
        <p className={styles.cardHint}>{getDeadlineHint(deadlineState)}</p>
      </div>

      <div className={styles.badges}>
        <span className={`${styles.badge} ${styles.badgeDeadline}`}>
          <CalendarDays size={14} />
          <span><small>Срок сдачи</small>{formatHomeworkDate(item.deadline)}</span>
        </span>
        <span
          className={`${styles.badge} ${
            submitted ? styles.badgeDone : styles.badgeUndone
          }`}
        >
          {submitted ? "Сдано" : "Не сдано"}
        </span>
      </div>

      {submitted && score ? (
        <div className={styles.score}>
          <span className={styles.scoreLabel}>Оценка</span>
          <span className={styles.scoreValue}>{score}</span>
        </div>
      ) : null}
      <button type="button" className={styles.workspaceButton} onClick={onOpen}>
        <FileText size={17} /> Открыть работу
      </button>
    </article>
  );
}
