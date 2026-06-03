"use client";

import styles from "@/components/student/tests/attempt/test-attempt.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import { ApiError } from "@/lib/api/client";
import {
  fetchTestAttempt,
  getAttemptErrorMessage,
  isValidAttempt,
  saveTestAttemptAnswer,
  startTestAttempt,
  submitTestAttempt,
} from "@/lib/student/test-attempt-api";
import type {
  AnswerDraft,
  AttemptQuestion,
  TestAttempt,
} from "@/lib/student/test-attempt-types";
import {
  createEmptyDraft,
  draftFromStoredAnswer,
  draftToStoredAnswer,
  formatRemainingSeconds,
  getStoredAnswer,
  isDraftValid,
  toggleMultipleAnswer,
} from "@/lib/student/test-attempt-utils";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface TestAttemptScreenProps {
  testId: string;
  testTitle: string;
  resumeAttemptId?: string;
  isPractice?: boolean;
  onExit: () => void;
  onCompleted: () => void;
}

type ScreenPhase = "loading" | "active" | "submitting" | "done" | "fatal";

export function TestAttemptScreen({
  testId,
  testTitle,
  resumeAttemptId,
  isPractice = false,
  onExit,
  onCompleted,
}: TestAttemptScreenProps) {
  const [phase, setPhase] = useState<ScreenPhase>("loading");
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draft, setDraft] = useState<AnswerDraft | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitScore, setSubmitScore] = useState<number | null>(null);
  const [submitStats, setSubmitStats] = useState<{
    correctAnswers?: number;
    totalQuestions?: number;
    accuracy?: number;
    timeSpentMinutes?: number;
  } | null>(null);

  const questions = attempt?.questions ?? [];
  const currentQuestion = questions[currentIndex] ?? null;

  const syncAttempt = useCallback((next: TestAttempt) => {
    setAttempt(next);
    setRemainingSeconds(next.remainingSeconds);
  }, []);

  const loadAttempt = useCallback(async () => {
    setPhase("loading");
    setError(null);

    try {
      const response = resumeAttemptId
        ? await fetchTestAttempt(resumeAttemptId)
        : await startTestAttempt(testId, { practice: isPractice });

      if (!response.success || !isValidAttempt(response.attempt)) {
        throw new Error(
          getAttemptErrorMessage(response.error ?? "attempt_not_found"),
        );
      }

      syncAttempt(response.attempt!);
      setCurrentIndex(0);
      setPhase("active");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? getAttemptErrorMessage(err.message)
          : err instanceof Error
            ? err.message
            : "Не удалось начать тест";

      setError(message);
      setPhase("fatal");
    }
  }, [isPractice, resumeAttemptId, syncAttempt, testId]);

  useEffect(() => {
    void loadAttempt();
  }, [loadAttempt]);

  useEffect(() => {
    if (!currentQuestion || !attempt) {
      setDraft(null);
      return;
    }

    const stored = getStoredAnswer(attempt, currentQuestion.questionId);
    if (stored) {
      setDraft(draftFromStoredAnswer(stored));
      return;
    }

    setDraft(createEmptyDraft(currentQuestion));
  }, [attempt, currentQuestion]);

  useEffect(() => {
    if (phase !== "active") {
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (phase !== "active" || !attempt) {
      return;
    }

    if (remainingSeconds > 0 && !attempt.timeExpired) {
      return;
    }

    void fetchTestAttempt(attempt.attemptId)
      .then((response) => {
        if (response.success && response.attempt) {
          syncAttempt(response.attempt);
        }
      })
      .catch(() => {
        /* ignore */
      });
  }, [attempt, phase, remainingSeconds, syncAttempt]);

  useEffect(() => {
    if (phase !== "active" || !attempt || attempt.timeExpired || remainingSeconds > 0) {
      return;
    }

    const syncTimer = window.setInterval(() => {
      void fetchTestAttempt(attempt.attemptId)
        .then((response) => {
          if (response.success && response.attempt) {
            syncAttempt(response.attempt);
          }
        })
        .catch(() => {
          /* ignore background sync errors */
        });
    }, 45000);

    const handleFocus = () => {
      void fetchTestAttempt(attempt.attemptId)
        .then((response) => {
          if (response.success && response.attempt) {
            syncAttempt(response.attempt);
          }
        })
        .catch(() => {
          /* ignore */
        });
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(syncTimer);
      window.removeEventListener("focus", handleFocus);
    };
  }, [attempt, phase, syncAttempt]);

  const timerClass = useMemo(() => {
    if (remainingSeconds <= 60) {
      return `${styles.attemptTimer} ${styles.attemptTimerDanger}`.trim();
    }

    if (remainingSeconds <= 300) {
      return `${styles.attemptTimer} ${styles.attemptTimerWarning}`.trim();
    }

    return styles.attemptTimer;
  }, [remainingSeconds]);

  const timeExpired =
    remainingSeconds <= 0 ||
    Boolean(attempt?.timeExpired) ||
    attempt?.status === "expired";

  const handleExit = () => {
    const confirmed = window.confirm(
      timeExpired
        ? "Выйти? Сохранённые ответы останутся — их можно отправить позже из списка тестов."
        : "Выйти из теста? Прогресс сохранён на сервере — можно продолжить позже.",
    );

    if (confirmed) {
      onExit();
    }
  };

  const goToQuestion = (index: number) => {
    if (index < 0 || index >= questions.length) {
      return;
    }

    setCurrentIndex(index);
    setError(null);
  };

  const persistCurrentAnswer = async (): Promise<boolean> => {
    if (!attempt || !currentQuestion || !draft || timeExpired) {
      return true;
    }

    if (currentQuestion.locked) {
      return true;
    }

    if (!isDraftValid(draft)) {
      setError("Выберите или введите ответ перед переходом дальше");
      return false;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await saveTestAttemptAnswer(
        attempt.attemptId,
        draftToStoredAnswer(currentQuestion.questionId, draft),
      );

      if (!response.success || !response.attempt) {
        throw new Error(
          getAttemptErrorMessage(response.error ?? "invalid_answer_type"),
        );
      }

      syncAttempt(response.attempt);
      return true;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? getAttemptErrorMessage(err.message)
          : err instanceof Error
            ? err.message
            : "Не удалось сохранить ответ";

      setError(message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleNext = async () => {
    if (!currentQuestion) {
      return;
    }

    if (!timeExpired && !currentQuestion.locked) {
      const saved = await persistCurrentAnswer();
      if (!saved) {
        return;
      }
    }

    if (currentIndex < questions.length - 1) {
      goToQuestion(currentIndex + 1);
    }
  };

  const handleSubmit = async () => {
    if (!attempt) {
      return;
    }

    if (
      !timeExpired &&
      currentQuestion &&
      !currentQuestion.locked &&
      draft &&
      isDraftValid(draft)
    ) {
      const saved = await persistCurrentAnswer();
      if (!saved) {
        return;
      }
    }

    const confirmed = window.confirm(
      timeExpired
        ? isPractice
          ? "Отправить сохранённые ответы? Результат тренировки не засчитается."
          : "Отправить сохранённые ответы на проверку? Новые ответы добавить уже нельзя."
        : isPractice
          ? "Завершить тренировку и посмотреть результат? Официальный балл не изменится."
          : "Завершить тест и отправить ответы на проверку?",
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setPhase("submitting");
    setError(null);

    try {
      const response = await submitTestAttempt(attempt.attemptId);

      if (!response.success) {
        throw new Error(
          getAttemptErrorMessage(response.error ?? "attempt_not_active"),
        );
      }

      setSubmitScore(
        response.score != null ? Math.round(Number(response.score)) : null,
      );
      setSubmitStats(response.stats ?? null);
      setPhase("done");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? getAttemptErrorMessage(err.message)
          : err instanceof Error
            ? err.message
            : "Не удалось сдать тест";

      setError(message);
      setPhase("active");
    } finally {
      setBusy(false);
    }
  };

  const renderQuestionBody = (
    question: AttemptQuestion,
    currentDraft: AnswerDraft,
    readOnly: boolean,
  ) => {
    if (question.type === "text") {
      return (
        <textarea
          className={styles.attemptTextInput}
          value={currentDraft.type === "text" ? currentDraft.textAnswer : ""}
          onChange={(event) =>
            setDraft({ type: "text", textAnswer: event.target.value })
          }
          disabled={readOnly || busy || timeExpired}
          placeholder="Введите ответ..."
        />
      );
    }

    return (
      <div className={styles.attemptOptions}>
        {(question.answers ?? []).map((option) => {
          const selected =
            question.type === "single"
              ? currentDraft.type === "single" &&
                currentDraft.selectedAnswer === option.id
              : currentDraft.type === "multiple" &&
                currentDraft.selectedAnswers.includes(option.id);

          return (
            <button
              key={option.id}
              type="button"
              className={`${styles.attemptOption} ${
                selected ? styles.attemptOptionSelected : ""
              }`.trim()}
              disabled={readOnly || busy || timeExpired}
              onClick={() => {
                if (question.type === "single") {
                  setDraft({ type: "single", selectedAnswer: option.id });
                  return;
                }

                if (currentDraft.type === "multiple") {
                  setDraft(toggleMultipleAnswer(currentDraft, option.id));
                }
              }}
            >
              <span className={styles.attemptOptionMarker} />
              <span className={styles.attemptOptionText}>{option.text}</span>
            </button>
          );
        })}
      </div>
    );
  };

  if (phase === "loading" || phase === "submitting") {
    return (
      <div className={styles.attemptOverlay}>
        <div className={styles.attemptCenterState}>
          <LoadingState
            label={
              phase === "loading" ? "Подготовка теста…" : "Отправка ответов…"
            }
            variant="compact"
          />
        </div>
      </div>
    );
  }

  if (phase === "fatal") {
    return (
      <div className={styles.attemptOverlay}>
        <div className={styles.attemptCenterState}>
          <h2 className={styles.attemptCenterTitle}>Не удалось открыть тест</h2>
          <p className={styles.attemptCenterText}>{error}</p>
          <button
            type="button"
            className={styles.attemptBackBtn}
            onClick={onExit}
          >
            <ArrowLeft size={16} />
            <span className={styles.attemptBackBtnLabel}>В систему</span>
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className={styles.attemptOverlay}>
        <div className={styles.attemptCenterState}>
          <CheckCircle2 size={48} color="#16a34a" />
          <h2 className={styles.attemptCenterTitle}>
            {isPractice ? "Тренировка завершена" : "Тест сдан"}
          </h2>
          {submitScore != null ? (
            <p className={styles.attemptScoreValue}>{submitScore}</p>
          ) : null}
          {isPractice ? (
            <p className={styles.attemptPracticeNotice}>
              Результаты тренировки не засчитываются в рейтинг
            </p>
          ) : null}
          {submitStats ? (
            <div className={styles.attemptDoneStats}>
              <span>
                Верно: {submitStats.correctAnswers ?? 0} /{" "}
                {submitStats.totalQuestions ?? attempt?.totalQuestions ?? 0}
              </span>
              <span>Точность: {submitStats.accuracy ?? 0}%</span>
              {submitStats.timeSpentMinutes != null ? (
                <span>Время: {submitStats.timeSpentMinutes} мин</span>
              ) : null}
            </div>
          ) : null}
          <p className={styles.attemptCenterText}>
            {isPractice
              ? "Можно вернуться к списку и потренироваться снова."
              : "Результат сохранён. Можно вернуться к списку тестов."}
          </p>
          <button
            type="button"
            className={styles.attemptSubmitBtn}
            onClick={onCompleted}
          >
            В систему
          </button>
        </div>
      </div>
    );
  }

  if (!attempt || !currentQuestion || !draft) {
    return null;
  }

  const readOnly = currentQuestion.locked || timeExpired;
  const isLastQuestion = currentIndex === questions.length - 1;
  const answeredCount = attempt.answeredCount;

  return (
    <div className={styles.attemptOverlay}>
      <header className={styles.attemptHeader}>
        <div className={styles.attemptHeaderLeft}>
          <button
            type="button"
            className={styles.attemptBackBtn}
            onClick={handleExit}
          >
            <ArrowLeft size={16} />
            <span className={styles.attemptBackBtnLabel}>В систему</span>
          </button>

          <div className={styles.attemptTitleWrap}>
            <span className={styles.attemptEyebrow}>
              {isPractice ? "Тренировка" : "Прохождение теста"}
            </span>
            <h1 className={styles.attemptTitle}>{testTitle}</h1>
          </div>
          {isPractice ? (
            <span className={styles.attemptPracticeBadge}>Не засчитывается</span>
          ) : null}
        </div>

        <div className={styles.attemptHeaderRight}>
          <div className={timerClass}>
            <Clock3 size={18} />
            {formatRemainingSeconds(remainingSeconds)}
          </div>

          <span className={styles.attemptProgressMeta}>
            Отвечено {answeredCount} / {attempt.totalQuestions}
          </span>

          <button
            type="button"
            className={styles.attemptSubmitBtn}
            disabled={
              busy ||
              (!timeExpired && answeredCount === 0)
            }
            onClick={() => void handleSubmit()}
          >
            <Send size={16} />
            {timeExpired ? "Отправить ответы" : isPractice ? "Завершить тренировку" : "Завершить"}
          </button>
        </div>
      </header>

      {timeExpired ? (
        <div className={styles.attemptExpiredPanel}>
          <div className={styles.attemptExpiredText}>
            <h3 className={styles.attemptExpiredTitle}>Время попытки истекло</h3>
            <p className={styles.attemptExpiredDescription}>
              Попытка завершена по времени. Новые ответы добавить нельзя, но можно
              отправить уже сохранённые — отвечено {answeredCount} из{" "}
              {attempt.totalQuestions}.
            </p>
          </div>
          <button
            type="button"
            className={`${styles.attemptSubmitBtn} ${styles.attemptExpiredSubmitBtn}`.trim()}
            disabled={busy}
            onClick={() => void handleSubmit()}
          >
            <Send size={16} />
            Отправить сохранённые ответы
          </button>
        </div>
      ) : null}

      {error ? <div className={styles.attemptAlert}>{error}</div> : null}

      <div className={styles.attemptBody}>
        <aside className={styles.attemptSidebar}>
          <p className={styles.attemptSidebarTitle}>Вопросы</p>
          <div className={styles.attemptQuestionGrid}>
            {questions.map((question, index) => {
              const answered = question.locked;
              const isCurrent = index === currentIndex;

              return (
                <button
                  key={question.questionId}
                  type="button"
                  className={`${styles.attemptQuestionPill} ${
                    isCurrent ? styles.attemptQuestionPillCurrent : ""
                  } ${answered ? styles.attemptQuestionPillAnswered : ""} ${
                    answered ? styles.attemptQuestionPillLocked : ""
                  }`.trim()}
                  onClick={() => goToQuestion(index)}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </aside>

        <main className={styles.attemptMain}>
          <article className={styles.attemptQuestionCard}>
            <div className={styles.attemptQuestionHead}>
              <span className={styles.attemptQuestionIndex}>
                Вопрос {currentIndex + 1} из {questions.length}
              </span>
              {currentQuestion.points != null ? (
                <span className={styles.attemptQuestionPoints}>
                  {currentQuestion.points} б.
                </span>
              ) : null}
            </div>

            <h2 className={styles.attemptQuestionText}>{currentQuestion.text}</h2>

            {readOnly && currentQuestion.locked ? (
              <p className={styles.attemptLockedNote}>
                {timeExpired
                  ? "Время вышло — ответ только для просмотра"
                  : "Ответ зафиксирован — можно только просмотреть"}
              </p>
            ) : null}

            {!readOnly && timeExpired ? (
              <p className={styles.attemptLockedNote}>
                На этот вопрос ответ не был сохранён до истечения времени
              </p>
            ) : null}

            {renderQuestionBody(currentQuestion, draft, readOnly)}
          </article>

          <footer className={styles.attemptFooter}>
            <span className={styles.attemptHint}>
              {timeExpired
                ? "Можно просмотреть вопросы и отправить сохранённые ответы"
                : readOnly
                  ? "Этот вопрос уже сохранён на сервере"
                  : "После «Далее» ответ нельзя изменить"}
            </span>

            {!isLastQuestion ? (
              <button
                type="button"
                className={styles.attemptNextBtn}
                disabled={busy}
                onClick={() => void handleNext()}
              >
                Далее
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                className={styles.attemptNextBtn}
                disabled={busy}
                onClick={() => void handleSubmit()}
              >
                {timeExpired ? "Отправить ответы" : isPractice ? "Завершить тренировку" : "Завершить тест"}
                <Send size={16} />
              </button>
            )}
          </footer>
        </main>
      </div>
    </div>
  );
}
