"use client";

import styles from "./test-attempt.module.css";
import { TestAttemptSubmitDialog } from "./test-attempt-submit-dialog";
import { LoadingState } from "@/components/ui/loading-state";
import {
  fetchTestAttempt, finalizeTestAttemptV2, getAttemptErrorMessage,
  startTestAttempt,
} from "@/lib/student/test-attempt-api";
import {
  commitDraft, createV2Bundle, loadV2Bundle,
  effectiveNowAfterReload, hasSeriousClockRollback, preflightAttemptStorage,
  reanchorV2Time, saveDraft, saveV2Bundle, sealV2Bundle,
  updateLocalStatus, updateV2Time, type AttemptV2Bundle,
} from "@/lib/student/test-attempt-v2-store";
import {
  cancelScheduledOfficialSync, scheduleOfficialSync, syncOfficialNow,
} from "@/lib/student/test-attempt-v2-sync";
import type { AnswerDraft } from "@/lib/student/test-attempt-types";
import {
  createEmptyDraft, draftFromStoredAnswer, formatRemainingSeconds,
  isDraftValid, toggleMultipleAnswer,
} from "@/lib/student/test-attempt-utils";
import { AlertCircle, ArrowLeft, CheckCircle2, Cloud, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface OfficialAttemptProps {
  testId: string;
  testTitle: string;
  timeLimitMinutes?: number | null;
  resumeAttemptId?: string;
  onExit: () => void;
  onCompleted: () => void;
}

type Phase = "confirm" | "loading" | "active" | "sealed" | "uploading" | "done" | "fatal";

export function OfficialTestAttemptScreen(props: OfficialAttemptProps) {
  const [phase, setPhase] = useState<Phase>(props.resumeAttemptId ? "loading" : "confirm");
  const [bundle, setBundle] = useState<AttemptV2Bundle | null>(null);
  const [draft, setDraft] = useState<AnswerDraft | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timerReady, setTimerReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"confirm" | "error" | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [viewQuestionId, setViewQuestionId] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [clockBlocked, setClockBlocked] = useState(false);
  const textSaveTimer = useRef<number | null>(null);
  const draftRef = useRef<AnswerDraft | null>(null);
  const draftWriteChain = useRef<Promise<unknown>>(Promise.resolve());
  const monotonicAnchor = useRef<{ perf: number; epoch: number } | null>(null);
  const sealing = useRef(false);

  const questions = bundle?.questions ?? [];
  const currentIndex = Math.max(0, questions.findIndex((q) => q.questionId === (viewQuestionId ?? bundle?.currentQuestionId)));
  const currentQuestion = questions[currentIndex] ?? null;
  const committedCount = bundle ? Object.keys(bundle.committedByQuestion).length : 0;
  const uploadWindowClosed = bundle?.localStatus === "upload_window_closed";
  const isSealed = bundle?.localStatus === "sealed_pending_upload" || uploadWindowClosed || phase === "sealed";

  const applyBundle = useCallback((next: AttemptV2Bundle) => {
    setBundle(next);
    setViewQuestionId((current) => current ?? next.currentQuestionId);
    const effectiveNow = effectiveNowAfterReload(next.time);
    setRemainingSeconds(Math.max(0, Math.floor((next.time.answerDeadlineEpochMs - effectiveNow) / 1000)));
    setTimerReady(true);
    setPhase(next.localStatus === "sealed_pending_upload" || next.localStatus === "upload_window_closed" ? "sealed" : next.localStatus === "uploaded" ? "done" : "active");
  }, []);

  const initializeFromAttempt = useCallback(async (attemptId?: string) => {
    setPhase("loading"); setError(null);
    try {
      if (attemptId) {
        let local = await loadV2Bundle(attemptId);
        if (local) {
          const clockMovedBack = hasSeriousClockRollback(local.time);
          if (clockMovedBack && navigator.onLine) {
            try {
              const fresh = await fetchTestAttempt(attemptId);
              if (fresh.attempt?.serverNowEpochMs) local = await reanchorV2Time(attemptId, fresh.attempt.serverNowEpochMs);
            } catch {
              // Keep the local bundle intact; answering stays blocked until time can be verified.
            }
          }
          const stillUnverified = hasSeriousClockRollback(local.time);
          setClockBlocked(stillUnverified);
          applyBundle(local);
          return;
        }
      }
      const response = attemptId ? await fetchTestAttempt(attemptId) : await startTestAttempt(props.testId);
      if (!response.success || !response.attempt || response.attempt.schemaVersion !== 2) {
        throw new Error(response.error ?? "invalid_v2_attempt");
      }
      let next = createV2Bundle(response.attempt, props.testTitle);
      await saveV2Bundle(next);
      if (response.attempt.timeExpired) {
        next = await sealV2Bundle(next.attemptId, "timeout", next.currentQuestionId);
      }
      applyBundle(next);
    } catch (cause) {
      setError(getAttemptErrorMessage(cause instanceof Error ? cause.message : "attempt_not_found"));
      setPhase("fatal");
    }
  }, [applyBundle, props.testId, props.testTitle]);

  useEffect(() => {
    if (!props.resumeAttemptId) return;
    const timer = window.setTimeout(() => void initializeFromAttempt(props.resumeAttemptId), 0);
    return () => window.clearTimeout(timer);
  }, [initializeFromAttempt, props.resumeAttemptId]);

  const handleConfirmedStart = async () => {
    setPhase("loading"); setError(null);
    try { await preflightAttemptStorage(); await initializeFromAttempt(); }
    catch (cause) {
      const code = cause instanceof Error ? cause.message : "storage_error";
      setError(code === "indexeddb_unsupported"
        ? "Этот браузер не поддерживает локальное хранилище IndexedDB. Официальный тест нельзя безопасно начать."
        : code === "insufficient_local_storage"
          ? "На устройстве недостаточно свободного места для безопасного сохранения теста."
          : "На устройстве не удалось подготовить надёжное локальное хранилище.");
      setPhase("fatal");
    }
  };

  useEffect(() => {
    if (!bundle || !currentQuestion) return;
    const localDraft = bundle.draftsByQuestion[String(currentQuestion.questionId)];
    const committed = bundle.committedByQuestion[String(currentQuestion.questionId)];
    const timer = window.setTimeout(() => {
      const restored = localDraft ?? (committed ? draftFromStoredAnswer(committed) : createEmptyDraft(currentQuestion));
      draftRef.current = restored;
      setDraft(restored);
    }, 0);
    return () => window.clearTimeout(timer);
    // Delivery-only bundle updates must not replace the editable draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle?.attemptId, currentQuestion?.questionId]);

  const persistCurrentDraft = useCallback(async () => {
    const latestDraft = draftRef.current;
    if (!bundle || !currentQuestion || !latestDraft || isSealed || bundle.committedByQuestion[String(currentQuestion.questionId)]) return bundle;
    await draftWriteChain.current.catch(() => undefined);
    const next = await saveDraft(bundle.attemptId, currentQuestion.questionId, latestDraft);
    setBundle(next); return next;
  }, [bundle, currentQuestion, isSealed]);

  const changeDraft = (next: AnswerDraft, immediate: boolean) => {
    draftRef.current = next;
    setDraft(next);
    if (!bundle || !currentQuestion) return;
    if (textSaveTimer.current) window.clearTimeout(textSaveTimer.current);
    if (immediate) {
      textSaveTimer.current = null;
      const write = draftWriteChain.current.catch(() => undefined)
        .then(() => saveDraft(bundle.attemptId, currentQuestion.questionId, next));
      draftWriteChain.current = write;
      void write
        .then(setBundle)
        .catch(() => setError("Не удалось сохранить черновик на устройстве."));
      return;
    }
    textSaveTimer.current = window.setTimeout(() => {
      const write = draftWriteChain.current.catch(() => undefined)
        .then(() => saveDraft(bundle.attemptId, currentQuestion.questionId, next));
      draftWriteChain.current = write;
      void write
        .then(setBundle)
        .catch(() => setError("Не удалось сохранить черновик на устройстве."));
    }, 250);
  };

  useEffect(() => () => {
    if (textSaveTimer.current) window.clearTimeout(textSaveTimer.current);
  }, []);

  useEffect(() => {
    const save = () => { void persistCurrentDraft(); };
    const visibility = () => { if (document.visibilityState === "hidden") save(); };
    window.addEventListener("pagehide", save); document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("pagehide", save); document.removeEventListener("visibilitychange", visibility); };
  }, [persistCurrentDraft]);

  const timerAttemptId = bundle?.attemptId;
  const timerStatus = bundle?.localStatus;
  const timerLastEffective = bundle?.time.lastEffectiveNowEpochMs;
  const timerServerOffset = bundle?.time.serverOffsetMs;
  const timerDeadline = bundle?.time.answerDeadlineEpochMs;
  useEffect(() => {
    if (!timerAttemptId || timerStatus !== "active" || timerLastEffective == null || timerServerOffset == null || timerDeadline == null) return;
    monotonicAnchor.current = { perf: performance.now(), epoch: Math.max(timerLastEffective, Date.now() + timerServerOffset) };
    const tick = () => {
      const anchor = monotonicAnchor.current!;
      const now = Math.max(timerLastEffective, anchor.epoch + (performance.now() - anchor.perf));
      setRemainingSeconds(Math.max(0, Math.floor((timerDeadline - now) / 1000)));
    };
    tick(); const timer = window.setInterval(tick, 1000);
    const checkpoint = window.setInterval(() => {
      const anchor = monotonicAnchor.current!;
      void updateV2Time(timerAttemptId, anchor.epoch + (performance.now() - anchor.perf))
        .catch(() => setError("Не удалось обновить локальное время попытки."));
    }, 5000);
    return () => { window.clearInterval(timer); window.clearInterval(checkpoint); };
  }, [timerAttemptId, timerDeadline, timerLastEffective, timerServerOffset, timerStatus]);

  const seal = useCallback(async (reason: "manual" | "timeout"): Promise<AttemptV2Bundle | null> => {
    if (!bundle || sealing.current) return null;
    sealing.current = true;
    try {
      if (textSaveTimer.current) {
        window.clearTimeout(textSaveTimer.current);
        textSaveTimer.current = null;
      }
      await persistCurrentDraft();
      const next = await sealV2Bundle(bundle.attemptId, reason, bundle.currentQuestionId);
      cancelScheduledOfficialSync(bundle.attemptId); applyBundle(next);
      return next;
    } catch { setError("Не удалось создать локальный итоговый слепок. Повторите действие."); return null; }
    finally { sealing.current = false; }
  }, [applyBundle, bundle, persistCurrentDraft]);

  useEffect(() => { if (timerReady && phase === "active" && remainingSeconds === 0 && bundle && !sealing.current) void seal("timeout"); }, [bundle, phase, remainingSeconds, seal, timerReady]);

  useEffect(() => {
    if (!bundle) return;
    const online = async () => {
      if (clockBlocked) {
        try {
          const fresh = await fetchTestAttempt(bundle.attemptId);
          if (fresh.attempt?.serverNowEpochMs) {
            const next = await reanchorV2Time(bundle.attemptId, fresh.attempt.serverNowEpochMs);
            setClockBlocked(false);
            applyBundle(next);
          }
        } catch {
          return;
        }
      }
      if (bundle.localStatus === "active") scheduleOfficialSync(bundle.attemptId, setBundle, Math.floor(Math.random() * 15000));
    };
    window.addEventListener("online", online); return () => window.removeEventListener("online", online);
  }, [applyBundle, bundle, clockBlocked]);

  const handleNext = async () => {
    if (clockBlocked || !bundle || !currentQuestion || !draft || !isDraftValid(draft)) return;
    try {
      if (textSaveTimer.current) {
        window.clearTimeout(textSaveTimer.current);
        textSaveTimer.current = null;
      }
      await draftWriteChain.current.catch(() => undefined);
      await saveDraft(bundle.attemptId, currentQuestion.questionId, draft);
      const nextQuestion = questions[currentIndex + 1];
      const next = await commitDraft(bundle.attemptId, currentQuestion.questionId, nextQuestion?.questionId);
      setBundle(next); setViewQuestionId(next.currentQuestionId); scheduleOfficialSync(bundle.attemptId, setBundle);
    } catch { setError("Не удалось зафиксировать ответ на устройстве."); }
  };

  const requestFinish = () => setDialog("confirm");

  const upload = async (sourceBundle = bundle) => {
    if (!sourceBundle?.finalSnapshot) return;
    if (effectiveNowAfterReload(sourceBundle.time) > sourceBundle.time.uploadDeadlineEpochMs) {
      const next = await updateLocalStatus(sourceBundle.attemptId, "upload_window_closed");
      setBundle(next);
      setError("Срок самостоятельной отправки истёк. Локальные данные сохранены — обратитесь к администратору.");
      setPhase("sealed");
      return;
    }
    setPhase("uploading"); setError(null);
    try {
      await updateLocalStatus(sourceBundle.attemptId, "uploading");
      const response = await finalizeTestAttemptV2(sourceBundle.attemptId, sourceBundle.finalSnapshot);
      const next = await updateLocalStatus(sourceBundle.attemptId, "uploaded");
      setBundle(next); setScore(response.score != null ? Math.round(response.score) : null); setDialog(null); setPhase("done");
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "answers_not_synced";
      const next = await updateLocalStatus(sourceBundle.attemptId, code === "upload_window_closed" ? "upload_window_closed" : "sealed_pending_upload");
      setBundle(next);
      setError(getAttemptErrorMessage(code));
      setPhase("sealed"); setDialog("error");
    }
  };

  const confirmFinish = async () => {
    setDialog(null);
    const next = await seal("manual");
    if (next) await upload(next);
  };

  const exit = async () => {
    await persistCurrentDraft().catch(() => undefined);
    if (window.confirm("Выйти в систему? Таймер не остановится, текущий выбор останется изменяемым черновиком.")) props.onExit();
  };

  if (phase === "confirm") return <div className={styles.attemptOverlay}><div className={styles.attemptCenterState}>
    <h2 className={styles.attemptCenterTitle}>Начать тест?</h2>
    <p className={styles.attemptCenterText}>{props.testTitle}{props.timeLimitMinutes ? ` · ${props.timeLimitMinutes} мин.` : ""}<br/>Тест будет загружен на устройство. После старта таймер не останавливается, всё время считается по Москве.</p>
    <div className={styles.submitDialogActions}><button className={styles.submitDialogBtnSecondary} onClick={props.onExit}>Отмена</button><button className={styles.submitDialogBtnPrimary} onClick={() => void handleConfirmedStart()}>Начать тест</button></div>
  </div></div>;
  if (phase === "loading" || phase === "uploading") return <div className={styles.attemptOverlay}><div className={styles.attemptCenterState}><LoadingState label={phase === "loading" ? "Подготовка теста…" : "Отправка результата…"} variant="compact" /></div></div>;
  if (phase === "fatal") return <div className={styles.attemptOverlay}><div className={styles.attemptCenterState}><AlertCircle size={42}/><h2 className={styles.attemptCenterTitle}>Не удалось открыть тест</h2><p className={styles.attemptCenterText}>{error}</p><button className={styles.attemptBackBtn} onClick={() => void initializeFromAttempt(props.resumeAttemptId)} >Повторить</button><button className={styles.attemptBackBtn} onClick={props.onExit}>В систему</button></div></div>;
  if (phase === "done") return <div className={styles.attemptOverlay}><div className={styles.attemptCenterState}><CheckCircle2 size={48} color="#16a34a"/><h2 className={styles.attemptCenterTitle}>Тест сдан</h2>{score != null ? <p className={styles.attemptScoreValue}>{score}</p> : null}<p className={styles.attemptCenterText}>Результат принят сервером.</p><button className={styles.attemptSubmitBtn} onClick={props.onCompleted}>В систему</button></div></div>;
  if (!bundle || !currentQuestion || !draft) return null;

  const committed = Boolean(bundle.committedByQuestion[String(currentQuestion.questionId)]);
  const isLast = currentIndex === questions.length - 1;
  const pending = bundle.pendingCommitIds.length;
  const syncText = bundle.syncSummary.syncing
    ? "Синхронизация…"
    : bundle.syncSummary.paused
      ? "Синхронизация приостановлена"
      : pending
        ? `${pending} ответов ожидают сервера`
        : committedCount > 0 && bundle.syncSummary.serverAnswerCount >= committedCount
          ? "Сервер получил все зафиксированные ответы"
          : "Все ответы сохранены на устройстве";
  const activeDraft = bundle.draftsByQuestion[String(bundle.currentQuestionId)];
  const currentEditableDraft = currentQuestion.questionId === bundle.currentQuestionId ? draft : activeDraft;
  const activeCommitted = Boolean(bundle.committedByQuestion[String(bundle.currentQuestionId)]);
  const unanswered = Math.max(0, questions.length - committedCount - (!activeCommitted && currentEditableDraft && isDraftValid(currentEditableDraft) ? 1 : 0));

  return <div className={styles.attemptOverlay}>
    {dialog ? <TestAttemptSubmitDialog mode={dialog} isPractice={false} timeExpired={isSealed} loading={false} errorDescription={error} descriptionOverride={dialog === "confirm" ? `Будет зафиксировано ответов: ${questions.length - unanswered} из ${questions.length}. Пропущено: ${unanswered}. После завершения изменить ответы нельзя.` : null} onCancel={() => setDialog(null)} onConfirm={() => void confirmFinish()} onRetry={() => void upload()} /> : null}
    <header className={styles.attemptHeader}><button className={styles.attemptBackBtn} onClick={() => void exit()}><ArrowLeft size={16}/>В систему</button><div><strong>{props.testTitle}</strong><div className={styles.attemptTimer}>{formatRemainingSeconds(remainingSeconds)}</div><small>Дедлайн: {new Date(bundle.time.answerDeadlineEpochMs).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК</small></div>{!isSealed ? <button className={styles.attemptBackBtn} onClick={requestFinish}>Завершить</button> : null}<button className={styles.attemptQueueMenuBtn} onClick={() => setQueueOpen(true)}><Cloud size={16}/></button></header>
    <main className={styles.attemptMain}>
      <section className={styles.attemptQuestionNav}><div className={styles.attemptQuestionGrid}>{questions.map((q, index) => {
        const ready = Boolean(bundle.committedByQuestion[String(q.questionId)]);
        const accessible = ready || q.questionId === bundle.currentQuestionId;
        return <button key={q.questionId} disabled={!accessible} className={`${styles.attemptQuestionPill} ${index === currentIndex ? styles.attemptQuestionPillCurrent : ""} ${ready ? styles.attemptQuestionPillSynced : ""}`.trim()} onClick={() => { if (accessible) setViewQuestionId(q.questionId); }}>{index + 1}</button>;
      })}</div></section>
      <section className={styles.attemptQuestionCard}><div className={styles.attemptQuestionMeta}>Вопрос {currentIndex + 1} из {questions.length}</div><h2 className={styles.attemptQuestionText}>{currentQuestion.text}</h2>
        {currentQuestion.type === "text" ? <textarea className={styles.attemptTextInput} value={draft.type === "text" ? draft.textAnswer : ""} disabled={clockBlocked || committed || isSealed} onChange={(e) => changeDraft({ type: "text", textAnswer: e.target.value }, false)} onBlur={() => void persistCurrentDraft()} placeholder="Введите ответ..."/> : <div className={styles.attemptOptions}>{(currentQuestion.answers ?? []).map((option) => {
          const selected = currentQuestion.type === "single" ? draft.type === "single" && draft.selectedAnswer === option.id : draft.type === "multiple" && draft.selectedAnswers.includes(option.id);
          return <button key={option.id} disabled={clockBlocked || committed || isSealed} className={`${styles.attemptOption} ${selected ? styles.attemptOptionSelected : ""}`.trim()} onClick={() => changeDraft(currentQuestion.type === "single" ? { type: "single", selectedAnswer: option.id } : toggleMultipleAnswer(draft as Extract<AnswerDraft,{type:"multiple"}>, option.id), true)}><span className={styles.attemptOptionMarker}/><span>{option.text}</span></button>;
        })}</div>}
        <p className={styles.attemptQuestionStatus}>{clockBlocked ? "Системное время изменилось. Новые ответы заблокированы до сверки с сервером." : committed ? "Ответ зафиксирован — изменить нельзя" : isSealed ? "Попытка завершена" : "Ответ можно менять до нажатия «Далее»"}</p>
        {!isSealed ? <button className={styles.attemptNextBtn} disabled={clockBlocked || !isDraftValid(draft) || committed} onClick={() => isLast ? requestFinish() : void handleNext()}>{isLast ? "Завершить тест" : "Далее"}</button> : uploadWindowClosed ? <button className={`${styles.attemptSubmitBtn} ${styles.attemptExpiredSubmitBtn}`.trim()} onClick={() => setQueueOpen(true)}>Требуется помощь администратора</button> : <button className={`${styles.attemptSubmitBtn} ${styles.attemptExpiredSubmitBtn}`.trim()} onClick={() => void upload()}><Send size={16}/>Отправить сохранённые ответы</button>}
      </section>
    </main>
    {queueOpen ? <div className={styles.attemptQueueOverlay} onClick={() => setQueueOpen(false)}><aside className={styles.attemptQueuePanel} onClick={(e) => e.stopPropagation()}><button className={styles.attemptQuestionNavClose} onClick={() => setQueueOpen(false)}><X size={18}/></button><h3>Сохранение ответов</h3><p>{syncText}</p><p>Локально зафиксировано: {committedCount}</p><p>Сервер подтвердил: {bundle.syncSummary.serverAnswerCount}</p><p>Последняя попытка: {bundle.syncSummary.lastAttemptAtMoscow ?? "—"}</p>{bundle.syncSummary.lastError ? <p>{bundle.syncSummary.lastError}</p> : null}<button className={styles.attemptSubmitBtn} disabled={!pending || bundle.syncSummary.syncing} onClick={() => void syncOfficialNow(bundle.attemptId, true).then((next) => next && setBundle(next))}>Попробовать синхронизировать</button></aside></div> : null}
  </div>;
}
