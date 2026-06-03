"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import {
  getCorrectAnswerText,
  getStudentAnswerText,
} from "@/lib/student/test-review-utils";
import type { ReviewItem } from "@/lib/student/test-review-types";
import type { AdminAttemptDetailItem } from "@/lib/admin/admin-tests-monitoring-types";
import { CheckCircle2, XCircle } from "lucide-react";

export interface AdminAnswerItemRow {
  questionId: number;
  questionText: string;
  studentLabel: string;
  correctLabel: string | null;
  isCorrect: boolean;
  points: number;
}

export function reviewItemsToRows(items: ReviewItem[]): AdminAnswerItemRow[] {
  return items.map((item) => ({
    questionId: item.questionId,
    questionText: item.question.text,
    studentLabel: getStudentAnswerText(item),
    correctLabel: getCorrectAnswerText(item),
    isCorrect: Boolean(item.isCorrect),
    points: item.points ?? 0,
  }));
}

function formatAttemptAnswer(item: AdminAttemptDetailItem): string {
  const answer = item.studentAnswer;
  if (!answer) return "Ответ не дан";
  const type = answer.type as string | undefined;
  const q = item.question as { answers?: { id: string; text: string }[] } | null;
  if (type === "single" && answer.selectedAnswer != null) {
    const opt = q?.answers?.find((a) => a.id === answer.selectedAnswer);
    return opt?.text ?? String(answer.selectedAnswer);
  }
  if (type === "multiple" && Array.isArray(answer.selectedAnswers)) {
    const labels = (q?.answers ?? [])
      .filter((a) => (answer.selectedAnswers as string[]).includes(a.id))
      .map((a) => a.text);
    return labels.length ? labels.join(", ") : "—";
  }
  if (type === "text" && answer.textAnswer != null) {
    return String(answer.textAnswer);
  }
  return "—";
}

function formatAttemptCorrect(item: AdminAttemptDetailItem): string | null {
  const q = item.question as {
    type?: string;
    answers?: { id: string; text: string; isCorrect?: boolean }[];
    correctAnswers?: string[];
  } | null;
  if (!q) return null;
  if (q.type === "text") {
    const vals = q.correctAnswers ?? [];
    return vals.length ? vals.join(", ") : "—";
  }
  const labels = (q.answers ?? [])
    .filter((a) => a.isCorrect)
    .map((a) => a.text);
  return labels.length ? labels.join(", ") : null;
}

export function attemptItemsToRows(
  items: AdminAttemptDetailItem[],
): AdminAnswerItemRow[] {
  return items.map((item) => ({
    questionId: item.questionId,
    questionText:
      (item.question as { text?: string })?.text ?? `Вопрос ${item.questionId}`,
    studentLabel: formatAttemptAnswer(item),
    correctLabel: formatAttemptCorrect(item),
    isCorrect: false,
    points: 0,
  }));
}

interface AdminAnswerItemsListProps {
  items: AdminAnswerItemRow[];
  emptyLabel?: string;
}

export function AdminAnswerItemsList({
  items,
  emptyLabel = "Нет данных по вопросам",
}: AdminAnswerItemsListProps) {
  if (items.length === 0) {
    return <p className={styles.panelHint}>{emptyLabel}</p>;
  }

  return (
    <ul className={styles.reviewItemsList}>
      {items.map((item) => (
        <li
          key={item.questionId}
          className={`${styles.reviewItem} ${item.isCorrect ? styles.reviewItemOk : styles.reviewItemBad}`}
        >
          <div className={styles.reviewItemHead}>
            <span className={styles.reviewItemNum}>Вопрос {item.questionId}</span>
            {item.points > 0 ? (
              <span className={styles.reviewItemPoints}>{item.points} б.</span>
            ) : null}
            {item.isCorrect ? (
              <CheckCircle2 size={18} className={styles.iconOk} aria-hidden />
            ) : (
              <XCircle size={18} className={styles.iconBad} aria-hidden />
            )}
          </div>
          <p className={styles.reviewItemQuestion}>{item.questionText}</p>
          <div className={styles.reviewItemAnswer}>
            <span className={styles.reviewItemLabel}>Ответ студента</span>
            <p>{item.studentLabel}</p>
          </div>
          {item.correctLabel ? (
            <div className={styles.reviewItemAnswer}>
              <span className={styles.reviewItemLabel}>Правильно</span>
              <p>{item.correctLabel}</p>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
