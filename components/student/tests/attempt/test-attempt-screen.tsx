"use client";

import styles from "@/components/student/tests/attempt/test-attempt.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import { ApiError } from "@/lib/api/client";
import {
  fetchTestAttempt,
  getAttemptErrorMessage,
  isValidAttempt,
  startTestAttempt,
  submitTestAttempt,
} from "@/lib/student/test-attempt-api";
import {
  addPendingQuestionId,
  deleteAttemptBundle,
  loadAttemptBundle,
  upsertLocalAnswer,
} from "@/lib/student/test-attempt-store";
import { TestAttemptSubmitDialog } from "@/components/student/tests/attempt/test-attempt-submit-dialog";
import {
  flushPendingAnswers,
  persistBundle,
  resolveAttemptBundleState,
} from "@/lib/student/test-attempt-sync";
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
  getQuestionSyncState,
  mergeAttemptFromServer,
  questionSyncStateLabel,
  toggleMultipleAnswer,
} from "@/lib/student/test-attempt-utils";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Cloud,
  CloudUpload,
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
  const [pendingQuestionIds, setPendingQuestionIds] = useState<number[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [submitDialog, setSubmitDialog] = useState<"confirm" | "error" | null>(
    null,
  );
  const pendingCount = pendingQuestionIds.length;

  const questions = attempt?.questions ?? [];
  const currentQuestion = questions[currentIndex] ?? null;

  const applyAttempt = useCallback(
    async (next: TestAttempt, pendingQuestionIds: number[]) => {
      setAttempt(next);
      setRemainingSeconds(next.remainingSeconds);
      setPendingQuestionIds(pendingQuestionIds);
      await persistBundle(next, pendingQuestionIds);
    },
    [],
  );

  const runBackgroundSync = useCallback(
    async (current: TestAttempt) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return;
      }

      setSyncing(true);
      try {
        const result = await flushPendingAnswers(current.attemptId, current);
        if (result) {
          await applyAttempt(result.attempt, result.pendingQuestionIds);
        }
      } finally {
        setSyncing(false);
      }
    },
    [applyAttempt],
  );

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

      let nextAttempt = response.attempt!;
      let pending: number[] = [];

      if (resumeAttemptId) {
        const cached = await loadAttemptBundle(resumeAttemptId);
        if (cached?.attempt?.questions?.length) {
          nextAttempt = mergeAttemptFromServer(cached.attempt, nextAttempt);
          pending = cached.pendingQuestionIds;
          for (const answer of cached.attempt.answers) {
            if (
              !nextAttempt.answers.some(
                (item) => item.questionId === answer.questionId,
              )
            ) {
              nextAttempt = upsertLocalAnswer(nextAttempt, answer);
              if (!pending.includes(answer.questionId)) {
                pending = addPendingQuestionId(pending, answer.questionId);
              }
            }
          }
        }
      }

      await applyAttempt(nextAttempt, pending);
      setCurrentIndex(0);
      setPhase("active");
      void runBackgroundSync(nextAttempt);
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
  }, [applyAttempt, isPractice, resumeAttemptId, runBackgroundSync, testId]);

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
          const merged = mergeAttemptFromServer(attempt, response.attempt);
          void applyAttempt(merged, pendingQuestionIds);
        }
      })
      .catch(() => {
        /* ignore */
      });
  }, [attempt, applyAttempt, pendingQuestionIds, phase, remainingSeconds]);

  useEffect(() => {
    if (phase !== "active" || !attempt) {
      return;
    }

    const syncTimer = window.setInterval(() => {
      void runBackgroundSync(attempt);
    }, 12000);

    const handleOnline = () => {
      void runBackgroundSync(attempt);
    };

    const handleFocus = () => {
      void fetchTestAttempt(attempt.attemptId)
        .then((response) => {
          if (response.success && response.attempt) {
            const merged = mergeAttemptFromServer(attempt, response.attempt);
            void applyAttempt(merged, pendingQuestionIds).then(() => {
              void runBackgroundSync(merged);
            });
          }
        })
        .catch(() => {
          void runBackgroundSync(attempt);
        });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(syncTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
    };
  }, [attempt, applyAttempt, pendingQuestionIds, phase, runBackgroundSync]);

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
        : "Выйти из теста? Ответы сохранены на устройстве и синхронизируются при появлении сети.",
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

  const saveLocalAnswer = async (): Promise<boolean> => {
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

    setError(null);
    const stored = draftToStoredAnswer(currentQuestion.questionId, draft);
    const next = upsertLocalAnswer(attempt, stored);
    const pending = addPendingQuestionId(
      pendingQuestionIds,
      currentQuestion.questionId,
    );
    await applyAttempt(next, pending);
    void runBackgroundSync(next);
    return true;
  };

  const handleNext = async () => {
    if (!currentQuestion) {
      return;
    }

    if (!timeExpired && !currentQuestion.locked) {
      const saved = await saveLocalAnswer();
      if (!saved) {
        return;
      }
    }

    if (currentIndex < questions.length - 1) {
      goToQuestion(currentIndex + 1);
    }
  };

  const buildDraftPayload = () => {
    if (!currentQuestion || !draft || timeExpired) {
      return null;
    }
    return {
      questionId: currentQuestion.questionId,
      draft,
      timeExpired,
    };
  };

  const performSubmit = useCallback(async () => {
    if (!attempt) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const resolved = await resolveAttemptBundleState(
        attempt.attemptId,
        { attempt, pendingQuestionIds },
        buildDraftPayload(),
      );
      await applyAttempt(resolved.attempt, resolved.pendingQuestionIds);

      const flush = await flushPendingAnswers(attempt.attemptId);
      if (!flush) {
        throw new Error("attempt_not_found");
      }

      await applyAttempt(flush.attempt, flush.pendingQuestionIds);

      if (flush.hadErrors || flush.pendingQuestionIds.length > 0) {
        throw new Error("sync_incomplete");
      }

      const response = await submitTestAttempt(flush.attempt.attemptId);

      if (!response.success) {
        throw new Error(
          getAttemptErrorMessage(response.error ?? "attempt_not_active"),
        );
      }

      setSubmitDialog(null);
      await deleteAttemptBundle(flush.attempt.attemptId);
      setSubmitScore(
        response.score != null ? Math.round(Number(response.score)) : null,
      );
      setSubmitStats(response.stats ?? null);
      setPhase("done");
    } catch (err) {
      setError(null);
      setSubmitDialog("error");
      setPhase("active");
    } finally {
      setBusy(false);
    }
  }, [
    applyAttempt,
    attempt,
    currentQuestion,
    draft,
    pendingQuestionIds,
    timeExpired,
  ]);

  const openSubmitConfirm = async () => {
    if (!attempt) {
      return;
    }

    if (
      !timeExpired &&
      currentQuestion &&
      draft &&
      !isDraftValid(draft) &&
      !getStoredAnswer(attempt, currentQuestion.questionId)
    ) {
      setError("Выберите или введите ответ перед завершением");
      return;
    }

    setError(null);

    try {
      const resolved = await resolveAttemptBundleState(
        attempt.attemptId,
        { attempt, pendingQuestionIds },
        buildDraftPayload(),
      );
      await applyAttempt(resolved.attempt, resolved.pendingQuestionIds);
      setSubmitDialog("confirm");
    } catch {
      setError("Не удалось сохранить ответ локально");
    }
  };

  const handleSubmit = () => {
    void openSubmitConfirm();
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
  const currentSyncState = getQuestionSyncState(
    currentQuestion.questionId,
    attempt,
    pendingQuestionIds,
    syncing,
  );

  const renderSyncStatusIcon = (state: ReturnType<typeof getQuestionSyncState>) => {
    if (state === "synced") {
      return <CheckCircle2 size={16} className={styles.attemptSyncStatusIcon} />;
    }
    if (state === "syncing") {
      return <CloudUpload size={16} className={styles.attemptSyncStatusIcon} />;
    }
    if (state === "pending") {
      return <Cloud size={16} className={styles.attemptSyncStatusIcon} />;
    }
    return null;
  };

  const currentSyncStatusClass =
    currentSyncState === "synced"
      ? styles.attemptSyncStatusSynced
      : currentSyncState === "syncing"
        ? styles.attemptSyncStatusSyncing
        : currentSyncState === "pending"
          ? styles.attemptSyncStatusPending
          : "";

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
            {pendingCount > 0 ? (
              <span className={styles.attemptSyncPending}>
                {" "}
                · ждут отправки: {pendingCount}
                {syncing ? " · отправка…" : ""}
              </span>
            ) : syncing ? (
              <span className={styles.attemptSyncPending}> · синхронизация…</span>
            ) : null}
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
          <ul className={styles.attemptSyncLegend} aria-label="Статусы ответов">
            <li className={styles.attemptSyncLegendItem}>
              <span
                className={`${styles.attemptSyncLegendDot} ${styles.attemptSyncLegendDotPending}`.trim()}
                aria-hidden
              />
              ждёт отправки
            </li>
            <li className={styles.attemptSyncLegendItem}>
              <span
                className={`${styles.attemptSyncLegendDot} ${styles.attemptSyncLegendDotSynced}`.trim()}
                aria-hidden
              />
              на сервере
            </li>
          </ul>
          <div className={styles.attemptQuestionGrid}>
            {questions.map((question, index) => {
              const isCurrent = index === currentIndex;
              const syncState = getQuestionSyncState(
                question.questionId,
                attempt,
                pendingQuestionIds,
                syncing,
              );
              const syncClass =
                syncState === "synced"
                  ? styles.attemptQuestionPillSynced
                  : syncState === "syncing"
                    ? `${styles.attemptQuestionPillPending} ${styles.attemptQuestionPillSyncing}`
                    : syncState === "pending"
                      ? styles.attemptQuestionPillPending
                      : "";

              return (
                <button
                  key={question.questionId}
                  type="button"
                  title={questionSyncStateLabel(syncState)}
                  className={`${styles.attemptQuestionPill} ${
                    isCurrent ? styles.attemptQuestionPillCurrent : ""
                  } ${syncClass}`.trim()}
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

            {currentSyncState !== "empty" ? (
              <p
                className={`${styles.attemptSyncStatus} ${currentSyncStatusClass}`.trim()}
              >
                {renderSyncStatusIcon(currentSyncState)}
                {questionSyncStateLabel(currentSyncState)}
              </p>
            ) : null}

            {readOnly && currentSyncState === "synced" ? (
              <p className={styles.attemptLockedNote}>
                {timeExpired
                  ? "Время вышло — ответ только для просмотра"
                  : "Ответ на сервере — изменить нельзя"}
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
                : currentSyncState === "syncing"
                  ? "Отправляем ответ на сервер…"
                  : currentSyncState === "pending"
                    ? "Ответ на устройстве — уйдёт на сервер, когда появится сеть"
                    : currentSyncState === "synced"
                      ? "Ответ на сервере — изменить нельзя"
                      : "После «Далее» ответ сохранится и отправится в фоне"}
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

      {submitDialog ? (
        <TestAttemptSubmitDialog
          mode={submitDialog}
          isPractice={isPractice}
          timeExpired={timeExpired}
          loading={busy}
          onCancel={() => {
            if (!busy) {
              setSubmitDialog(null);
            }
          }}
          onConfirm={() => void performSubmit()}
          onRetry={() => void performSubmit()}
        />
      ) : null}
    </div>
  );
}
