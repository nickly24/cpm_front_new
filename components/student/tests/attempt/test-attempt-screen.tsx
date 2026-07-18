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
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Cloud,
  CloudUpload,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TouchEvent } from "react";
import { OfficialTestAttemptScreen } from "./official-test-attempt-screen";
import { PracticeAttemptScreen } from "./practice-attempt-screen";

export interface TestAttemptScreenProps {
  testId: string;
  testTitle: string;
  timeLimitMinutes?: number | null;
  resumeAttemptId?: string;
  isPractice?: boolean;
  onExit: () => void;
  onCompleted: () => void;
}

type ScreenPhase = "loading" | "active" | "submitting" | "done" | "fatal";
type QueueStatus = "pending" | "syncing" | "failed";

type QueueItem = {
  questionId: number;
  attempts: number;
  status: QueueStatus;
  lastError?: string;
  nextRetryAt?: number;
};

const RETRY_DELAY_MS = 10000;
const SWIPE_NEXT_MIN_DISTANCE = 72;
const SWIPE_NEXT_MAX_VERTICAL_DISTANCE = 56;

type SwipeStart = {
  x: number;
  y: number;
};

const isSwipeIgnoredTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest("button, a, input, textarea, select, [role='button']"),
  );
};

export function TestAttemptScreen(props: TestAttemptScreenProps) {
  if (!props.isPractice) {
    return <OfficialTestAttemptScreen {...props} />;
  }
  return <PracticeAttemptScreen {...props} />;
}

export function LegacyTestAttemptScreen({
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
  const [queueItems, setQueueItems] = useState<Record<number, QueueItem>>({});
  const [queueOpen, setQueueOpen] = useState(false);
  const [questionNavOpen, setQuestionNavOpen] = useState(false);
  const [queueNow, setQueueNow] = useState(() => Date.now());
  const [syncing, setSyncing] = useState(false);
  const [textAnswerFocused, setTextAnswerFocused] = useState(false);
  const [submitDialog, setSubmitDialog] = useState<"confirm" | "error" | null>(
    null,
  );
  const [submitErrorDescription, setSubmitErrorDescription] = useState<
    string | null
  >(null);
  const attemptMainRef = useRef<HTMLElement>(null);
  const swipeStartRef = useRef<SwipeStart | null>(null);
  const pendingCount = pendingQuestionIds.length;

  const questions = attempt?.questions ?? [];
  const currentQuestion = questions[currentIndex] ?? null;
  const timeExpired =
    remainingSeconds <= 0 ||
    Boolean(attempt?.timeExpired) ||
    attempt?.status === "expired";

  const applyAttempt = useCallback(
    async (next: TestAttempt, pendingQuestionIds: number[]) => {
      setAttempt(next);
      setRemainingSeconds(next.remainingSeconds);
      setPendingQuestionIds(pendingQuestionIds);
      setQueueItems((current) => {
        const pendingSet = new Set(pendingQuestionIds);
        const nextQueue: Record<number, QueueItem> = {};

        for (const questionId of pendingQuestionIds) {
          nextQueue[questionId] =
            current[questionId] ?? {
              questionId,
              attempts: 0,
              status: "pending",
            };
        }

        for (const item of Object.values(current)) {
          if (pendingSet.has(item.questionId)) {
            nextQueue[item.questionId] = item;
          }
        }

        return nextQueue;
      });
      await persistBundle(next, pendingQuestionIds);
    },
    [],
  );

  const markQueueBeforeSend = useCallback((questionIds: number[]) => {
    const now = Date.now();
    setQueueItems((current) => {
      const next = { ...current };
      for (const questionId of questionIds) {
        const item = next[questionId];
        next[questionId] = {
          questionId,
          attempts: (item?.attempts ?? 0) + 1,
          status: "syncing",
          lastError: item?.lastError,
          nextRetryAt: undefined,
        };
      }
      return next;
    });
    setQueueNow(now);
  }, []);

  const markQueueFailed = useCallback(
    (questionIds: number[], message: string) => {
      const now = Date.now();
      setQueueItems((current) => {
        const next = { ...current };
        for (const questionId of questionIds) {
          const item = next[questionId];
          next[questionId] = {
            questionId,
            attempts: item?.attempts ?? 0,
            status: "failed",
            lastError: message,
            nextRetryAt: now + RETRY_DELAY_MS,
          };
        }
        return next;
      });
      setQueueNow(now);
    },
    [],
  );

  const removeSyncedQueueItems = useCallback((pending: number[]) => {
    const pendingSet = new Set(pending);
    setQueueItems((current) => {
      const next: Record<number, QueueItem> = {};
      for (const item of Object.values(current)) {
        if (pendingSet.has(item.questionId)) {
          next[item.questionId] = item;
        }
      }
      return next;
    });
  }, []);

  const runBackgroundSync = useCallback(
    async (current: TestAttempt) => {
      const bundle = await loadAttemptBundle(current.attemptId);
      const pending = bundle?.pendingQuestionIds ?? [];
      if (pending.length === 0) {
        removeSyncedQueueItems([]);
        return;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        markQueueBeforeSend(pending);
        markQueueFailed(pending, "Нет сети. Переотправка через 10 секунд.");
        return;
      }

      markQueueBeforeSend(pending);
      setSyncing(true);
      try {
        const result = await flushPendingAnswers(current.attemptId, current);
        if (result) {
          await applyAttempt(result.attempt, result.pendingQuestionIds);
          removeSyncedQueueItems(result.pendingQuestionIds);
          if (result.pendingQuestionIds.length > 0 || result.hadErrors) {
            markQueueFailed(
              result.pendingQuestionIds.length
                ? result.pendingQuestionIds
                : pending,
              "Не удалось отправить. Переотправка через 10 секунд.",
            );
          }
        } else {
          markQueueFailed(pending, "Попытка не найдена. Переотправка через 10 секунд.");
        }
      } catch (err) {
        markQueueFailed(
          pending,
          err instanceof Error
            ? err.message
            : "Не удалось отправить. Переотправка через 10 секунд.",
        );
      } finally {
        setSyncing(false);
      }
    },
    [
      applyAttempt,
      markQueueBeforeSend,
      markQueueFailed,
      removeSyncedQueueItems,
    ],
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
          pending = cached.pendingQuestionIds;
          nextAttempt = mergeAttemptFromServer(cached.attempt, nextAttempt, {
            preserveQuestionIds: pending,
          });
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
    const timeout = window.setTimeout(() => {
      void loadAttempt();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadAttempt]);

  useEffect(() => {
    let nextDraft: AnswerDraft | null;
    if (!currentQuestion || !attempt) {
      nextDraft = null;
    } else {
      const stored = getStoredAnswer(attempt, currentQuestion.questionId);
      nextDraft = stored
        ? draftFromStoredAnswer(stored)
        : createEmptyDraft(currentQuestion);
    }

    const timeout = window.setTimeout(() => {
      setDraft(nextDraft);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [attempt, currentQuestion]);

  const buildDraftPayload = useCallback(() => {
    if (!currentQuestion || !draft || timeExpired) {
      return null;
    }
    return {
      questionId: currentQuestion.questionId,
      draft,
      timeExpired,
    };
  }, [currentQuestion, draft, timeExpired]);

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
          const merged = mergeAttemptFromServer(attempt, response.attempt, {
            preserveQuestionIds: pendingQuestionIds,
          });
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
      void resolveAttemptBundleState(
        attempt.attemptId,
        { attempt, pendingQuestionIds },
        buildDraftPayload(),
      )
        .then((resolved) =>
          fetchTestAttempt(attempt.attemptId).then((response) => {
            if (response.success && response.attempt) {
              const merged = mergeAttemptFromServer(
                resolved.attempt,
                response.attempt,
                {
                  preserveQuestionIds: resolved.pendingQuestionIds,
                },
              );
              void applyAttempt(merged, resolved.pendingQuestionIds).then(() => {
                void runBackgroundSync(merged);
              });
            }
          }),
        )
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
  }, [
    attempt,
    applyAttempt,
    buildDraftPayload,
    pendingQuestionIds,
    phase,
    runBackgroundSync,
  ]);

  useEffect(() => {
    if (phase !== "active") {
      return;
    }

    const timer = window.setInterval(() => {
      setQueueNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "active" || !attempt || pendingQuestionIds.length === 0) {
      return;
    }

    const nextRetryAt = Object.values(queueItems)
      .filter((item) => item.status === "failed" && item.nextRetryAt)
      .reduce<number | null>((min, item) => {
        const value = item.nextRetryAt ?? null;
        if (value == null) {
          return min;
        }
        return min == null ? value : Math.min(min, value);
      }, null);

    if (nextRetryAt == null) {
      return;
    }

    const delay = Math.max(0, nextRetryAt - Date.now());
    const timeout = window.setTimeout(() => {
      void runBackgroundSync(attempt);
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [attempt, pendingQuestionIds.length, phase, queueItems, runBackgroundSync]);

  const timerClass = useMemo(() => {
    if (remainingSeconds <= 60) {
      return `${styles.attemptTimer} ${styles.attemptTimerDanger}`.trim();
    }

    if (remainingSeconds <= 300) {
      return `${styles.attemptTimer} ${styles.attemptTimerWarning}`.trim();
    }

    return styles.attemptTimer;
  }, [remainingSeconds]);

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

  const getMaxAccessibleQuestionIndex = useCallback(
    (nextAttempt: TestAttempt | null) => {
      if (!nextAttempt) {
        return 0;
      }

      const answeredQuestionIds = new Set(
        nextAttempt.answers.map((answer) => answer.questionId),
      );
      const firstUnansweredIndex = nextAttempt.questions.findIndex(
        (question) => !answeredQuestionIds.has(question.questionId),
      );

      return firstUnansweredIndex === -1
        ? nextAttempt.questions.length - 1
        : firstUnansweredIndex;
    },
    [],
  );

  const canOpenQuestion = useCallback(
    (index: number) => {
      if (!attempt || timeExpired) {
        return true;
      }

      if (index === currentIndex) {
        return true;
      }

      const question = attempt.questions[index];
      const answered = question
        ? attempt.answers.some(
            (answer) => answer.questionId === question.questionId,
          )
        : false;

      return answered || index <= getMaxAccessibleQuestionIndex(attempt);
    },
    [
      attempt,
      currentIndex,
      getMaxAccessibleQuestionIndex,
      timeExpired,
    ],
  );

  const goToQuestion = (index: number) => {
    if (index < 0 || index >= questions.length) {
      return;
    }

    if (!canOpenQuestion(index)) {
      return;
    }

    setCurrentIndex(index);
    setQuestionNavOpen(false);
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
    const bundle = await loadAttemptBundle(attempt.attemptId);
    const sourceAttempt = bundle?.attempt ?? attempt;
    const sourcePendingQuestionIds =
      bundle?.pendingQuestionIds ?? pendingQuestionIds;
    const next = {
      ...upsertLocalAnswer(sourceAttempt, stored),
      remainingSeconds,
    };
    const pending = addPendingQuestionId(
      sourcePendingQuestionIds,
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
      setCurrentIndex(currentIndex + 1);
      setQuestionNavOpen(false);
      setError(null);
      attemptMainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleQuestionSwipeStart = (event: TouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1 || isSwipeIgnoredTarget(event.target)) {
      swipeStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  };

  const handleQuestionSwipeEnd = (event: TouchEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;

    if (
      !start ||
      event.changedTouches.length !== 1 ||
      busy ||
      isLastQuestion ||
      questionNavOpen ||
      queueOpen
    ) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const horizontalEnough = Math.abs(deltaX) >= SWIPE_NEXT_MIN_DISTANCE;
    const verticalSmallEnough =
      Math.abs(deltaY) <= SWIPE_NEXT_MAX_VERTICAL_DISTANCE;
    const mostlyHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.4;

    if (deltaX < 0 && horizontalEnough && verticalSmallEnough && mostlyHorizontal) {
      void handleNext();
    }
  };

  const performSubmit = useCallback(async () => {
    if (!attempt) {
      return;
    }

    setBusy(true);
    setError(null);
    setSubmitErrorDescription(null);

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
        throw new Error("answers_not_synced");
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
      setSubmitErrorDescription(
        err instanceof ApiError
          ? getAttemptErrorMessage(err.message)
          : err instanceof Error
            ? getAttemptErrorMessage(err.message)
            : getAttemptErrorMessage("answers_not_synced"),
      );
      setSubmitDialog("error");
      setPhase("active");
    } finally {
      setBusy(false);
    }
  }, [
    applyAttempt,
    attempt,
    buildDraftPayload,
    pendingQuestionIds,
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
    setSubmitErrorDescription(null);

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

  const handleTextAnswerFocus = (target: HTMLTextAreaElement) => {
    setTextAnswerFocused(true);
    target.focus();
    window.setTimeout(() => {
      attemptMainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 80);
    window.setTimeout(() => {
      attemptMainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 320);
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
          onFocus={(event) => handleTextAnswerFocus(event.currentTarget)}
          onBlur={() => setTextAnswerFocused(false)}
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
  const queueList = Object.values(queueItems).sort(
    (a, b) => a.questionId - b.questionId,
  );
  const hasQueue = queueList.length > 0;
  const failedQueueCount = queueList.filter(
    (item) => item.status === "failed",
  ).length;
  const syncingQueueCount = queueList.filter(
    (item) => item.status === "syncing",
  ).length;

  const getQuestionNumber = (questionId: number) => {
    const index = questions.findIndex(
      (question) => question.questionId === questionId,
    );
    return index >= 0 ? index + 1 : questionId;
  };

  const getQueueItemText = (item: QueueItem) => {
    if (item.status === "syncing") {
      return "Отправка...";
    }
    if (item.status === "failed") {
      const seconds = Math.max(
        0,
        Math.ceil(((item.nextRetryAt ?? queueNow) - queueNow) / 1000),
      );
      return `Неудачно. Переотправка через ${seconds} сек.`;
    }
    return "Ждет отправки";
  };

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
  const overlayClass = `${styles.attemptOverlay} ${
    textAnswerFocused ? styles.attemptTextEntryMode : ""
  }`.trim();

  const renderQuestionNavigation = () => (
    <section
      className={`${styles.attemptQuestionNav} ${
        questionNavOpen ? styles.attemptQuestionNavOpen : ""
      }`.trim()}
    >
      <div className={styles.attemptQuestionNavBar}>
        <button
          type="button"
          className={styles.attemptQuestionNavToggle}
          onClick={() => setQuestionNavOpen((value) => !value)}
          aria-expanded={questionNavOpen}
        >
          <span>Вопросы</span>
          <strong>
            {currentIndex + 1}/{questions.length}
          </strong>
        </button>

        <button
          type="button"
          className={styles.attemptQueueMenuBtn}
          onClick={() => setQueueOpen(true)}
          disabled={!hasQueue}
          aria-label="Открыть очередь запросов"
        >
          <Cloud size={16} />
          {hasQueue ? (
            <span className={styles.attemptQueueCount}>{queueList.length}</span>
          ) : null}
        </button>
      </div>

      <div className={styles.attemptQuestionNavPanel}>
        <div className={styles.attemptQuestionNavHead}>
          <div>
            <p className={styles.attemptSidebarTitle}>Вопросы</p>
            <p className={styles.attemptQuestionNavMeta}>
              {currentIndex + 1} из {questions.length}
            </p>
          </div>

          <button
            type="button"
            className={styles.attemptQuestionNavClose}
            onClick={() => setQuestionNavOpen(false)}
            aria-label="Закрыть список вопросов"
          >
            <X size={16} />
          </button>
        </div>

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
            const accessible = canOpenQuestion(index);
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
                title={
                  accessible
                    ? questionSyncStateLabel(syncState)
                    : "Сначала ответьте на предыдущий вопрос"
                }
                className={`${styles.attemptQuestionPill} ${
                  isCurrent ? styles.attemptQuestionPillCurrent : ""
                } ${syncClass}`.trim()}
                disabled={!accessible}
                onClick={() => goToQuestion(index)}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );

  const renderQueuePanel = () => (
    <aside
      className={`${styles.attemptQueueDrawer} ${
        queueOpen ? styles.attemptQueueDrawerOpen : ""
      }`.trim()}
      aria-hidden={!queueOpen}
    >
      <div className={styles.attemptQueueDrawerHead}>
        <div>
          <p className={styles.attemptSidebarTitle}>Очередь запросов</p>
          <p className={styles.attemptQueueSummary}>
            {failedQueueCount > 0
              ? `Неудачно: ${failedQueueCount}. Повтор каждые 10 сек.`
              : syncingQueueCount > 0
                ? `Отправка: ${syncingQueueCount}`
                : hasQueue
                  ? "Ответы ждут отправки"
                  : "Очередь пустая"}
          </p>
        </div>
        <button
          type="button"
          className={styles.attemptQueueClose}
          onClick={() => setQueueOpen(false)}
          aria-label="Закрыть очередь"
        >
          <X size={18} />
        </button>
      </div>

      {hasQueue ? (
        <ul className={styles.attemptQueueList}>
          {queueList.map((item) => (
            <li
              key={item.questionId}
              className={`${styles.attemptQueueItem} ${
                item.status === "failed"
                  ? styles.attemptQueueItemFailed
                  : item.status === "syncing"
                    ? styles.attemptQueueItemSyncing
                    : ""
              }`.trim()}
            >
              <div className={styles.attemptQueueItemTop}>
                <span className={styles.attemptQueueQuestion}>
                  Вопрос {getQuestionNumber(item.questionId)}
                </span>
                <span className={styles.attemptQueueAttempts}>
                  попытка {item.attempts}
                </span>
              </div>
              <p className={styles.attemptQueueStatus}>
                {item.status === "failed" ? (
                  <AlertCircle size={13} />
                ) : item.status === "syncing" ? (
                  <RefreshCw size={13} />
                ) : (
                  <Cloud size={13} />
                )}
                {getQueueItemText(item)}
              </p>
              {item.lastError ? (
                <p className={styles.attemptQueueError}>{item.lastError}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );

  return (
    <div className={overlayClass}>
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
            className={styles.attemptQueueMenuBtn}
            onClick={() => setQueueOpen(true)}
            disabled={!hasQueue}
          >
            <Cloud size={16} />
            <span>Очередь</span>
            {hasQueue ? (
              <span className={styles.attemptQueueCount}>
                {queueList.length}
              </span>
            ) : null}
          </button>

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
        <main
          className={styles.attemptMain}
          ref={attemptMainRef}
          onTouchStart={handleQuestionSwipeStart}
          onTouchEnd={handleQuestionSwipeEnd}
        >
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

        {renderQuestionNavigation()}
      </div>

      {queueOpen ? (
        <button
          type="button"
          className={styles.attemptQueueBackdrop}
          onClick={() => setQueueOpen(false)}
          aria-label="Закрыть очередь"
        />
      ) : null}

      {queueOpen ? renderQueuePanel() : null}

      {submitDialog ? (
        <TestAttemptSubmitDialog
          mode={submitDialog}
          isPractice={isPractice}
          timeExpired={timeExpired}
          loading={busy}
          errorDescription={submitErrorDescription}
          onCancel={() => {
            if (!busy) {
              setSubmitDialog(null);
              setSubmitErrorDescription(null);
            }
          }}
          onConfirm={() => void performSubmit()}
          onRetry={() => void performSubmit()}
        />
      ) : null}
    </div>
  );
}
