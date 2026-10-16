"use client";

import { useContextGuard } from "@/lib/bff/use-context-guard";
import styles from "@/components/student/tests/review/test-review.module.css";
import player from "../test-player.module.css";
import { QuestionPagination } from "../question-pagination";
import { useTestViewport } from "../use-test-viewport";
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
  ArrowRight,
  CheckCircle2,
  Target,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const overlayRef = useTestViewport();
  const mainRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<ReviewPhase>("loading");
  const [review, setReview] = useState<TestSessionReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useContextGuard(phase === "loading" || phase === "ready");

  const loadReview = useCallback(async (signal?: AbortSignal) => {
    setPhase("loading");
    setError(null);

    try {
      const response = await fetchTestSessionReview(sessionId, signal);
      if (signal?.aborted) return;

      if (!response.success || !response.review) {
        throw new Error(
          getReviewErrorMessage(response.error ?? "session_not_found"),
        );
      }

      setReview(response.review);
      setCurrentIndex(0);
      setPhase("ready");
    } catch (err) {
      if (signal?.aborted) return;
      const message =
        err instanceof ApiError
          ? getReviewErrorMessage(err.message)
          : err instanceof Error
            ? getReviewErrorMessage(err.message)
            : "Не удалось загрузить разбор";

      setError(message);
      setPhase("fatal");
    }
  }, [sessionId]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadReview(controller.signal), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [loadReview]);

  if (phase === "loading") {
    return (
      <div className={player.overlay} ref={overlayRef} role="dialog" aria-modal="true" aria-label="Разбор теста">
        <div className={styles.reviewCenterState}>
          <LoadingState label="Загрузка разбора…" variant="compact" />
        </div>
      </div>
    );
  }

  if (phase === "fatal") {
    return (
      <div className={player.overlay} ref={overlayRef} role="dialog" aria-modal="true" aria-label="Разбор теста">
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
    <div className={player.overlay} ref={overlayRef} role="dialog" aria-modal="true" aria-label="Разбор теста">
      <header className={player.header}>
        <button type="button" className={player.iconButton} onClick={onExit} aria-label="К списку тестов"><ArrowLeft size={20}/></button>
        <div className={player.heading}><span className={player.eyebrow}>Разбор теста</span><h1 className={player.title}>{review.testTitle || testTitle}</h1><div className={player.headerMeta}>{score != null ? <span><Target size={12}/> {score} баллов</span> : null}<span>Верно {correctCount} из {review.items.length}</span></div></div>
      </header>
      {review.items.length ? <QuestionPagination pages={review.items.map(item => ({ id: item.questionId, status: item.isCorrect ? "correct" : "incorrect" }))} currentIndex={currentIndex} onSelect={index => { setCurrentIndex(index); mainRef.current?.scrollTo({ top: 0 }); }} summary={`Верно ${correctCount} из ${review.items.length}`} /> : null}
      <div className={player.main} ref={mainRef} data-test-scroll>
      <details className={styles.reviewExplanation}>
        <summary>О разборе и доступности ответов</summary>

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
      </details>
        <div className={styles.reviewList}>
          {review.items.slice(currentIndex, currentIndex + 1).map((item) => {
            const index = currentIndex;
            const studentText = getStudentAnswerText(item);
            const correctText = getCorrectAnswerText(item);
            const statusClass = item.isCorrect
              ? styles.reviewStatusCorrect
              : styles.reviewStatusIncorrect;
            const answerBoxClass = item.isCorrect
              ? styles.reviewAnswerBoxCorrect
              : styles.reviewAnswerBoxIncorrect;

            return (
              <article key={item.questionId} className={`${styles.reviewCard} ${player.card}`}>
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
      {review.items.length ? <footer className={player.footer}><div className={player.footerInner}><div className={player.actions}>
        <button type="button" className={player.secondary} disabled={currentIndex === 0} onClick={() => { setCurrentIndex(index => index - 1); mainRef.current?.scrollTo({ top: 0 }); }}><ArrowLeft size={17}/>Назад</button>
        <button type="button" className={player.primary} onClick={() => { if (currentIndex === review.items.length - 1) onExit(); else { setCurrentIndex(index => index + 1); mainRef.current?.scrollTo({ top: 0 }); } }}>{currentIndex === review.items.length - 1 ? "К списку тестов" : "Далее"}<ArrowRight size={17}/></button>
      </div></div></footer> : <p className={player.status}>В этом разборе нет доступных вопросов.</p>}
    </div>
  );
}
