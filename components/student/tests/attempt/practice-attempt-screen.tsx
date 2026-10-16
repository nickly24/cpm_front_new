"use client";

import { useContextGuard } from "@/lib/bff/use-context-guard";
import styles from "./test-attempt.module.css";
import player from "../test-player.module.css";
import { QuestionPagination } from "../question-pagination";
import { useTestViewport } from "../use-test-viewport";
import { LoadingState } from "@/components/ui/loading-state";
import {
  checkPracticeAnswer,
  fetchTestAttempt,
  getAttemptErrorMessage,
  getNetworkErrorMessage,
  startTestAttempt,
  submitTestAttempt,
} from "@/lib/student/test-attempt-api";
import type {
  AnswerDraft,
  AttemptQuestion,
  PracticeFeedback,
  TestAttempt,
} from "@/lib/student/test-attempt-types";
import {
  createEmptyDraft,
  draftFromStoredAnswer,
  draftToStoredAnswer,
  isDraftValid,
  toggleMultipleAnswer,
} from "@/lib/student/test-attempt-utils";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Send,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TestAttemptScreenProps } from "./test-attempt-screen";

type PracticePhase = "loading" | "active" | "done" | "fatal";

function feedbackMap(attempt: TestAttempt | null) {
  return new Map(
    (attempt?.practiceFeedback ?? []).map((item) => [item.questionId, item]),
  );
}

export function PracticeAttemptScreen({
  testId,
  resumeAttemptId,
  onExit,
  onCompleted,
}: TestAttemptScreenProps) {
  const overlayRef = useTestViewport();
  const questionRef = useRef<HTMLHeadingElement>(null);
  const [phase, setPhase] = useState<PracticePhase>("loading");
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftsByQuestion, setDraftsByQuestion] = useState<Record<number, AnswerDraft>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [stats, setStats] = useState<{
    correctAnswers?: number;
    totalQuestions?: number;
    accuracy?: number;
  } | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  useContextGuard(phase === "loading" || phase === "active" || busy);

  const questions = attempt?.questions ?? [];
  const currentQuestion = questions[currentIndex] ?? null;
  const feedbackByQuestion = useMemo(() => feedbackMap(attempt), [attempt]);
  const currentFeedback = currentQuestion
    ? feedbackByQuestion.get(currentQuestion.questionId) ?? null
    : null;
  const draft = currentQuestion
    ? draftsByQuestion[currentQuestion.questionId]
      ?? (currentFeedback
        ? draftFromStoredAnswer(currentFeedback.answer)
        : createEmptyDraft(currentQuestion))
    : null;
  const setDraft = (next: AnswerDraft) => {
    if (!currentQuestion) return;
    setDraftsByQuestion((current) => ({
      ...current,
      [currentQuestion.questionId]: next,
    }));
  };

  const applyLoadedAttempt = useCallback((next: TestAttempt) => {
    const feedback = feedbackMap(next);
    const firstUnanswered = next.questions.findIndex(
      (question) => !feedback.has(question.questionId),
    );
    setAttempt(next);
    setCurrentIndex(firstUnanswered === -1 ? Math.max(0, next.questions.length - 1) : firstUnanswered);
    setPhase("active");
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setPhase("loading");
      setError(null);
      try {
        const response = resumeAttemptId
          ? await fetchTestAttempt(resumeAttemptId)
          : await startTestAttempt(testId, { practice: true });
        const next = response.attempt;
        if (!response.success || !next || !next.isPractice || !next.questions?.length) {
          throw new Error(response.error ?? "attempt_not_found");
        }
        if (!cancelled) applyLoadedAttempt(next);
      } catch (cause) {
        if (!cancelled) {
          const message = cause instanceof Error
            ? getAttemptErrorMessage(cause.message)
            : "Не удалось открыть тренировку";
          setError(message);
          setPhase("fatal");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [applyLoadedAttempt, resumeAttemptId, testId]);

  const mergeFeedback = useCallback((feedback: PracticeFeedback, answeredCount?: number) => {
    setAttempt((current) => {
      if (!current) return current;
      const nextFeedback = [
        ...(current.practiceFeedback ?? []).filter(
          (item) => item.questionId !== feedback.questionId,
        ),
        feedback,
      ];
      const nextAnswers = [
        ...current.answers.filter((item) => item.questionId !== feedback.questionId),
        feedback.answer,
      ];
      return {
        ...current,
        practiceFeedback: nextFeedback,
        answers: nextAnswers,
        answeredCount: answeredCount ?? nextAnswers.length,
        questions: current.questions.map((question) =>
          question.questionId === feedback.questionId
            ? { ...question, locked: true }
            : question,
        ),
      };
    });
  }, []);

  const handleCheck = async () => {
    if (!attempt || !currentQuestion || !draft || !isDraftValid(draft)) {
      setError("Выберите или введите ответ");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await checkPracticeAnswer(
        attempt.attemptId,
        draftToStoredAnswer(currentQuestion.questionId, draft),
      );
      if (!response.success || !response.feedback) {
        throw new Error(response.error ?? "Не удалось проверить ответ");
      }
      mergeFeedback(response.feedback, response.answeredCount);
    } catch (cause) {
      setError(getNetworkErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const finishPractice = async () => {
    if (!attempt) return;
    setBusy(true);
    setError(null);
    try {
      const response = await submitTestAttempt(attempt.attemptId);
      if (!response.success) {
        throw new Error(response.error ?? "attempt_not_active");
      }
      setScore(response.score != null ? Math.round(Number(response.score)) : null);
      if (response.stats) {
        const totalQuestions = response.stats.totalQuestions ?? questions.length;
        const correctAnswers = response.stats.correctAnswers
          ?? attempt.practiceFeedback?.filter(item => item.isCorrect).length ?? 0;
        setStats({
          ...response.stats,
          totalQuestions,
          correctAnswers,
          accuracy: totalQuestions ? Math.round(correctAnswers / totalQuestions * 1000) / 10 : 0,
        });
      } else {
        setStats(null);
      }
      setPhase("done");
    } catch (cause) {
      setError(getNetworkErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const goToQuestion = (index: number) => {
    setCurrentIndex(index); setError(null);
    mainRef.current?.scrollTo({ top: 0 });
    window.requestAnimationFrame(() => questionRef.current?.focus({ preventScroll: true }));
  };

  const goNext = () => {
    if (currentIndex >= questions.length - 1) {
      void finishPractice();
      return;
    }
    goToQuestion(currentIndex + 1);
  };

  const firstUnansweredIndex = questions.findIndex(
    (question) => !feedbackByQuestion.has(question.questionId),
  );
  const maxAccessibleIndex = firstUnansweredIndex === -1
    ? Math.max(0, questions.length - 1)
    : firstUnansweredIndex;

  const handleExit = () => {
    const hasProgress = (attempt?.answeredCount ?? 0) > 0 || Boolean(draft && isDraftValid(draft));
    if (!hasProgress || window.confirm("Выйти из тренировки? Проверенные ответы сохранятся, и вы сможете продолжить позже.")) {
      onExit();
    }
  };

  if (phase === "loading") {
    return (
      <div className={player.overlay} ref={overlayRef} role="dialog" aria-modal="true" aria-label="Тренировка">
        <div className={styles.attemptCenterState}>
          <LoadingState label="Подготовка тренировки…" variant="compact" />
        </div>
      </div>
    );
  }

  if (phase === "fatal") {
    return (
      <div className={player.overlay} ref={overlayRef} role="dialog" aria-modal="true" aria-label="Тренировка">
        <div className={styles.attemptCenterState}>
          <h2 className={styles.attemptCenterTitle}>Не удалось открыть тренировку</h2>
          <p className={styles.attemptCenterText}>{error}</p>
          <button type="button" className={styles.attemptBackBtn} onClick={onExit}>
            <ArrowLeft size={16} /> В систему
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className={player.overlay} ref={overlayRef} role="dialog" aria-modal="true" aria-label="Тренировка">
        <div className={styles.attemptCenterState}>
          <CheckCircle2 size={48} color="#16a34a" />
          <h2 className={styles.attemptCenterTitle}>Тренировка завершена</h2>
          {score != null ? <p className={styles.attemptScoreValue}>{score}</p> : null}
          {stats ? (
            <div className={styles.attemptDoneStats}>
              <span>Верно: {stats.correctAnswers ?? 0} / {stats.totalQuestions ?? 0}</span>
              <span>Точность: {stats.accuracy ?? 0}%</span>
            </div>
          ) : null}
          <p className={styles.attemptPracticeNotice}>Результат не влияет на официальный балл</p>
          <button type="button" className={styles.attemptSubmitBtn} onClick={onCompleted}>
            В систему
          </button>
        </div>
      </div>
    );
  }

  if (!attempt || !currentQuestion || !draft) return null;

  const renderOptions = (question: AttemptQuestion) => {
    if (question.type === "text") {
      return (
        <textarea
          aria-label="Ваш ответ" rows={3} className={`${styles.attemptTextInput} ${player.input}`}
          value={draft.type === "text" ? draft.textAnswer : ""}
          onChange={(event) => setDraft({ type: "text", textAnswer: event.target.value })}
          disabled={Boolean(currentFeedback) || busy}
          placeholder="Введите ответ..."
        />
      );
    }

    const correctIds = new Set(currentFeedback?.correct.correctOptionIds ?? []);
    return (
      <div className={styles.attemptOptions}>
        {(question.answers ?? []).map((option) => {
          const selected = question.type === "single"
            ? draft.type === "single" && draft.selectedAnswer === option.id
            : draft.type === "multiple" && draft.selectedAnswers.includes(option.id);
          const revealedCorrect = Boolean(currentFeedback && correctIds.has(option.id));
          const revealedWrong = Boolean(currentFeedback && selected && !correctIds.has(option.id));
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              className={`${styles.attemptOption} ${player.option} ${question.type === "multiple" ? player.multipleOption : ""} ${selected ? styles.attemptOptionSelected : ""} ${revealedCorrect ? styles.practiceOptionCorrect : ""} ${revealedWrong ? styles.practiceOptionIncorrect : ""}`.trim()}
              disabled={Boolean(currentFeedback) || busy}
              onClick={() => {
                if (question.type === "single") {
                  setDraft({ type: "single", selectedAnswer: option.id });
                } else if (draft.type === "multiple") {
                  setDraft(toggleMultipleAnswer(draft, option.id));
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

  return (
    <div className={player.overlay} ref={overlayRef} role="dialog" aria-modal="true" aria-label="Тренировка">
      <header className={player.header}>
        <button type="button" className={player.iconButton} onClick={handleExit} aria-label="К списку тестов"><ArrowLeft size={20}/></button>
        <span className={player.timerCenter}>Тренировка</span><span className={player.headerSpacer} aria-hidden/>
      </header>
      <QuestionPagination pages={questions.map((question, index) => ({ id: question.questionId, status: feedbackByQuestion.has(question.questionId) ? feedbackByQuestion.get(question.questionId)!.isCorrect ? "correct" : "incorrect" : "empty", disabled: !feedbackByQuestion.has(question.questionId) && index > maxAccessibleIndex }))} currentIndex={currentIndex} onSelect={goToQuestion} disabled={busy} summary={`Проверено ${attempt.answeredCount} из ${questions.length}`} />
      {error ? <p className={player.error} role="alert">{error}</p> : null}
      <main className={player.main} ref={mainRef} data-test-scroll>
          <article className={`${styles.attemptQuestionCard} ${player.card}`}>
            <div className={player.questionType}><span>{currentQuestion.type === "single" ? "Выберите один ответ" : currentQuestion.type === "multiple" ? "Выберите несколько ответов" : "Напишите ответ"}</span></div>
            <h2 ref={questionRef} tabIndex={-1} className={player.questionText}>{currentQuestion.text}</h2>
            {renderOptions(currentQuestion)}

            {currentFeedback ? (
              <div className={`${styles.practiceFeedback} ${currentFeedback.isCorrect ? styles.practiceFeedbackCorrect : styles.practiceFeedbackIncorrect}`.trim()}>
                <div className={styles.practiceFeedbackTitle}>
                  {currentFeedback.isCorrect ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                  {currentFeedback.isCorrect ? "Верно" : "Неверно"}

                </div>
                {currentQuestion.type === "text" && currentFeedback.correct.correctAnswers?.length ? (
                  <p>Правильный ответ: {currentFeedback.correct.correctAnswers.join("; ")}</p>
                ) : !currentFeedback.isCorrect ? (
                  <p>Правильный вариант отмечен зелёным.</p>
                ) : null}
              </div>
            ) : null}
          </article>

      </main>
      <footer className={player.footer}><div className={player.footerInner}>
        <div className={player.actions}>
          <button type="button" className={player.secondary} disabled={busy || currentIndex === 0} onClick={() => goToQuestion(currentIndex - 1)}><ArrowLeft size={17}/>Назад</button>
          {currentFeedback ? <button type="button" className={player.primary} disabled={busy} onClick={goNext}>{currentIndex === questions.length - 1 ? "Завершить" : "Далее"}{currentIndex === questions.length - 1 ? <Send size={17}/> : <ArrowRight size={17}/>}</button> : <button type="button" className={player.primary} disabled={busy || !isDraftValid(draft)} onClick={() => void handleCheck()}>{busy ? "Проверяем…" : "Проверить ответ"}<CheckCircle2 size={17}/></button>}
        </div>
      </div></footer>
    </div>
  );
}
