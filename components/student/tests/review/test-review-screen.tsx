"use client";

import styles from "@/components/student/tests/review/test-review.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import { ApiError } from "@/lib/api/client";
import { formatTestDate } from "@/lib/student/tests-api";
import {
  fetchTestSessionReview,
  getReviewErrorMessage,
} from "@/lib/student/test-review-api";
import type { TestSessionReview } from "@/lib/student/test-review-types";
import {
  getCorrectAnswerText,
  getStudentAnswerText,
} from "@/lib/student/test-review-utils";
import {
  ArrowLeft,
  CheckCircle2,
  Target,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface TestReviewScreenProps {
  sessionId: string;
  testTitle: string;
  onExit: () => void;
}

type ReviewPhase = "loading" | "ready" | "fatal";

export function TestReviewScreen({
  sessionId,
  testTitle,
  onExit,
}: TestReviewScreenProps) {
  const [phase, setPhase] = useState<ReviewPhase>("loading");
  const [review, setReview] = useState<TestSessionReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReview = useCallback(async () => {
    setPhase("loading");
    setError(null);

    try {
      const response = await fetchTestSessionReview(sessionId);

      if (!response.success || !response.review) {
        throw new Error(
          getReviewErrorMessage(response.error ?? "session_not_found"),
        );
      }

      setReview(response.review);
      setPhase("ready");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? getReviewErrorMessage(err.message)
          : err instanceof Error
            ? err.message
            : "Не удалось загрузить разбор";

      setError(message);
      setPhase("fatal");
    }
  }, [sessionId]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (phase === "loading") {
    return (
      <div className={styles.reviewOverlay}>
        <div className={styles.reviewCenterState}>
          <LoadingState label="Загрузка разбора…" variant="compact" />
        </div>
      </div>
    );
  }

  if (phase === "fatal") {
    return (
      <div className={styles.reviewOverlay}>
        <div className={styles.reviewCenterState}>
          <h2 className={styles.reviewCenterTitle}>Не удалось открыть разбор</h2>
          <p className={styles.reviewCenterText}>{error}</p>
          <button
            type="button"
            className={styles.reviewBackBtn}
            onClick={onExit}
          >
            <ArrowLeft size={16} />
            Назад
          </button>
        </div>
      </div>
    );
  }

  if (!review) {
    return null;
  }

  const score =
    review.score != null ? Math.round(Number(review.score)) : null;
  const correctCount = review.items.filter((item) => item.isCorrect).length;

  return (
    <div className={styles.reviewOverlay}>
      <header className={styles.reviewHeader}>
        <div className={styles.reviewHeaderLeft}>
          <button
            type="button"
            className={styles.reviewBackBtn}
            onClick={onExit}
          >
            <ArrowLeft size={16} />
            К списку
          </button>

          <div className={styles.reviewTitleWrap}>
            <span className={styles.reviewEyebrow}>Разбор теста</span>
            <h1 className={styles.reviewTitle}>
              {review.testTitle || testTitle}
            </h1>
          </div>
        </div>

        <div className={styles.reviewHeaderRight}>
          {score != null ? (
            <span className={styles.reviewScoreBadge}>
              <Target size={16} />
              {score} баллов
            </span>
          ) : null}
          <span className={styles.reviewScoreBadge}>
            Верно {correctCount} / {review.items.length}
          </span>
        </div>
      </header>

      <div className={styles.reviewNoticeWrap}>
        {review.showCorrectAnswers ? (
          <p className={styles.reviewNotice}>
            Показаны ваши ответы и правильные варианты. Вопросы — в том порядке,
            в котором вы их проходили
            {review.completedAt
              ? ` · сдан ${formatTestDate(review.completedAt)}`
              : ""}
            {review.timeSpentMinutes != null
              ? ` · ${review.timeSpentMinutes} мин`
              : ""}
            .
          </p>
        ) : (
          <p
            className={`${styles.reviewNotice} ${styles.reviewNoticeHidden}`.trim()}
          >
            Правильные ответы пока скрыты преподавателем. Видны только ваши ответы
            и отметка верно / неверно
            {review.completedAt
              ? ` · сдан ${formatTestDate(review.completedAt)}`
              : ""}
            .
          </p>
        )}
      </div>

      <div className={styles.reviewBody}>
        <div className={styles.reviewList}>
          {review.items.map((item, index) => {
            const studentText = getStudentAnswerText(item);
            const correctText = getCorrectAnswerText(item);
            const statusClass = item.isCorrect
              ? styles.reviewStatusCorrect
              : styles.reviewStatusIncorrect;
            const answerBoxClass = item.isCorrect
              ? styles.reviewAnswerBoxCorrect
              : styles.reviewAnswerBoxIncorrect;

            return (
              <article key={item.questionId} className={styles.reviewCard}>
                <div className={styles.reviewCardHead}>
                  <span className={styles.reviewQuestionIndex}>
                    Вопрос {index + 1}
                  </span>
                  <span
                    className={`${styles.reviewStatus} ${statusClass}`.trim()}
                  >
                    {item.isCorrect ? (
                      <>
                        <CheckCircle2 size={14} />
                        Верно
                      </>
                    ) : (
                      <>
                        <XCircle size={14} />
                        Неверно
                      </>
                    )}
                  </span>
                  <span className={styles.reviewPoints}>
                    {item.points} / {item.question.points ?? 0} б.
                  </span>
                </div>

                <p className={styles.reviewQuestionText}>{item.question.text}</p>

                <div className={styles.reviewSections}>
                  <div>
                    <p className={styles.reviewSectionTitle}>Ваш ответ</p>
                    <div
                      className={`${styles.reviewAnswerBox} ${answerBoxClass}`.trim()}
                    >
                      {studentText}
                    </div>
                  </div>

                  {review.showCorrectAnswers && correctText ? (
                    <div>
                      <p className={styles.reviewSectionTitle}>
                        Правильный ответ
                      </p>
                      <div className={styles.reviewCorrectBox}>{correctText}</div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
