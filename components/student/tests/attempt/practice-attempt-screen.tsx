"use client";

import styles from "./test-attempt.module.css";
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
  Clock3,
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
  testTitle,
  resumeAttemptId,
  onExit,
  onCompleted,
}: TestAttemptScreenProps) {
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
      setStats(response.stats ?? null);
      setPhase("done");
    } catch (cause) {
      setError(getNetworkErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const goNext = () => {
    if (currentIndex >= questions.length - 1) {
      void finishPractice();
      return;
    }
    setCurrentIndex((value) => value + 1);
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
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
      <div className={styles.attemptOverlay}>
        <div className={styles.attemptCenterState}>
          <LoadingState label="Подготовка тренировки…" variant="compact" />
        </div>
      </div>
    );
  }

  if (phase === "fatal") {
    return (
      <div className={styles.attemptOverlay}>
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
      <div className={styles.attemptOverlay}>
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
          className={styles.attemptTextInput}
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
              className={`${styles.attemptOption} ${selected ? styles.attemptOptionSelected : ""} ${revealedCorrect ? styles.practiceOptionCorrect : ""} ${revealedWrong ? styles.practiceOptionIncorrect : ""}`.trim()}
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
    <div className={styles.attemptOverlay}>
      <header className={styles.attemptHeader}>
        <div className={styles.attemptHeaderLeft}>
          <button type="button" className={styles.attemptBackBtn} onClick={handleExit}>
            <ArrowLeft size={16} />
            <span className={styles.attemptBackBtnLabel}>В систему</span>
          </button>
          <div className={styles.attemptTitleWrap}>
            <span className={styles.attemptEyebrow}>Тренировка</span>
            <h1 className={styles.attemptTitle}>{testTitle}</h1>
          </div>
          <span className={styles.attemptPracticeBadge}>Не засчитывается</span>
        </div>
        <div className={styles.attemptHeaderRight}>
          <span className={styles.practiceNoLimit}><Clock3 size={16} /> Без ограничения времени</span>
          <span className={styles.attemptProgressMeta}>
            Проверено {attempt.answeredCount} / {attempt.totalQuestions}
          </span>
        </div>
      </header>

      {error ? <div className={styles.attemptAlert}>{error}</div> : null}

      <div className={styles.attemptBody}>
        <main className={styles.attemptMain} ref={mainRef}>
          <article className={styles.attemptQuestionCard}>
            <div className={styles.attemptQuestionHead}>
              <span className={styles.attemptQuestionIndex}>Вопрос {currentIndex + 1} из {questions.length}</span>
              {currentQuestion.points != null ? (
                <span className={styles.attemptQuestionPoints}>{currentQuestion.points} б.</span>
              ) : null}
            </div>
            <h2 className={styles.attemptQuestionText}>{currentQuestion.text}</h2>
            {renderOptions(currentQuestion)}

            {currentFeedback ? (
              <div className={`${styles.practiceFeedback} ${currentFeedback.isCorrect ? styles.practiceFeedbackCorrect : styles.practiceFeedbackIncorrect}`.trim()}>
                <div className={styles.practiceFeedbackTitle}>
                  {currentFeedback.isCorrect ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                  {currentFeedback.isCorrect ? "Верно" : "Неверно"}
                  <span>{currentFeedback.points} б.</span>
                </div>
                {currentQuestion.type === "text" && currentFeedback.correct.correctAnswers?.length ? (
                  <p>Правильный ответ: {currentFeedback.correct.correctAnswers.join("; ")}</p>
                ) : !currentFeedback.isCorrect ? (
                  <p>Правильный вариант отмечен зелёным.</p>
                ) : null}
              </div>
            ) : null}
          </article>

          <footer className={styles.attemptFooter}>
            <span className={styles.attemptHint}>
              {currentFeedback
                ? "Ответ проверен и сохранён"
                : "Ответ можно менять до нажатия «Проверить ответ»"}
            </span>
            {currentFeedback ? (
              <button type="button" className={styles.attemptNextBtn} disabled={busy} onClick={goNext}>
                {currentIndex === questions.length - 1 ? "Завершить тренировку" : "Следующий вопрос"}
                {currentIndex === questions.length - 1 ? <Send size={16} /> : <ArrowRight size={16} />}
              </button>
            ) : (
              <button type="button" className={styles.attemptNextBtn} disabled={busy || !isDraftValid(draft)} onClick={() => void handleCheck()}>
                {busy ? "Проверяем…" : "Проверить ответ"}
                <CheckCircle2 size={16} />
              </button>
            )}
          </footer>
        </main>

        <section className={styles.attemptQuestionNav}>
          <div className={styles.attemptQuestionGrid}>
            {questions.map((question, index) => {
              const checked = feedbackByQuestion.has(question.questionId);
              return (
                <button
                  key={question.questionId}
                  type="button"
                  className={`${styles.attemptQuestionPill} ${index === currentIndex ? styles.attemptQuestionPillCurrent : ""} ${checked ? styles.attemptQuestionPillSynced : ""}`.trim()}
                  disabled={!checked && index > maxAccessibleIndex}
                  onClick={() => setCurrentIndex(index)}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
