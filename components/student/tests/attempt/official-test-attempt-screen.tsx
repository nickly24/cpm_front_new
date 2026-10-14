"use client";

import { formatAttemptDeadline } from "@/lib/student/test-attempt-catalog";

import { BFF_DEV } from "@/lib/config";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import styles from "./test-attempt.module.css";
import { TestAttemptSubmitDialog } from "./test-attempt-submit-dialog";
import { LoadingState } from "@/components/ui/loading-state";
import {
  fetchTestAttempt, getAttemptErrorMessage,
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
import { subscribeAttemptChanges } from "@/lib/student/test-attempt-v2-events";
import { uploadOfficialSnapshot } from "@/lib/student/test-attempt-v2-upload";
import { createOfficialUploadScheduler } from "@/lib/student/test-attempt-v2-upload-scheduler";
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
  const draftDirty = useRef(false);
  const draftWriteChain = useRef<Promise<unknown>>(Promise.resolve());
  const monotonicAnchor = useRef<{ perf: number; epoch: number } | null>(null);
  const sealing = useRef(false);
  useContextGuard(phase === "loading" || phase === "active" || phase === "sealed" || phase === "uploading");
  useEffect(() => () => {
    if (props.resumeAttemptId) cancelScheduledOfficialSync(props.resumeAttemptId);
  }, [props.resumeAttemptId]);
  useEffect(() => {
    const id = bundle?.attemptId;
    return () => { if (id) cancelScheduledOfficialSync(id); };
  }, [bundle?.attemptId]);

  const questions = bundle?.questions ?? [];
  const currentIndex = Math.max(0, questions.findIndex((q) => q.questionId === (viewQuestionId ?? bundle?.currentQuestionId)));
  const currentQuestion = questions[currentIndex] ?? null;
  const committedCount = bundle ? Object.keys(bundle.committedByQuestion).length : 0;
  const uploadWindowClosed = bundle?.localStatus === "upload_window_closed";
  const isSealed = Boolean(bundle?.finalSnapshot) || bundle?.localStatus === "sealing" || uploadWindowClosed || phase === "sealed";

  const applyBundle = useCallback((next: AttemptV2Bundle) => {
    setBundle(next);
    setViewQuestionId((current) => current ?? next.currentQuestionId);
    const effectiveNow = effectiveNowAfterReload(next.time);
    setRemainingSeconds(Math.max(0, Math.floor((next.time.answerDeadlineEpochMs - effectiveNow) / 1000)));
    setTimerReady(true);
    if (next.localStatus === "uploaded") { setDialog(null); setError(null); }
    setPhase(next.localStatus === "uploaded" ? "done" : next.localStatus === "uploading" || next.localStatus === "sealing" ? "uploading" : next.finalSnapshot || next.localStatus === "sealed_pending_upload" || next.localStatus === "upload_window_closed" ? "sealed" : "active");
  }, []);

  const initializeFromAttempt = useCallback(async (attemptId?: string) => {
    setPhase("loading"); setError(null);
    try {
      if (attemptId) {
        let local = await loadV2Bundle(attemptId);
        if (local) {
          if (BFF_DEV && navigator.onLine) {
            try {
              const fresh = await fetchTestAttempt(attemptId);
              if (!fresh.attempt || fresh.attempt.testId !== props.testId) throw new Error("attempt_not_found");
              if (fresh.attempt.status === "accepted") {
                const accepted = await updateLocalStatus(attemptId, "uploaded");
                applyBundle(accepted);
                return;
              }
              if (fresh.attempt.serverNowEpochMs) local = await reanchorV2Time(attemptId, fresh.attempt.serverNowEpochMs);
            } catch (cause) {
              const status = (cause as { status?: number }).status;
              if (status === 401 || status === 403 || status === 404 || status === 409) throw cause;
              // An unavailable dependency keeps the scoped local draft intact for offline delivery.
            }
          }
          if (local.localStatus === "sealing") local = await sealV2Bundle(attemptId, local.sealingReason ?? "timeout");
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
      next = await saveV2Bundle(next);
      if (response.attempt.status === "accepted") {
        next = await updateLocalStatus(next.attemptId, "uploaded");
        applyBundle(next);
        return;
      }
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

  const displayedCommitId = currentQuestion ? bundle?.committedByQuestion[String(currentQuestion.questionId)]?.commitId : undefined;
  useEffect(() => {
    if (!bundle || !currentQuestion) return;
    const localDraft = bundle.draftsByQuestion[String(currentQuestion.questionId)];
    const committed = bundle.committedByQuestion[String(currentQuestion.questionId)];
    const timer = window.setTimeout(() => {
      const restored = localDraft ?? (committed ? draftFromStoredAnswer(committed) : createEmptyDraft(currentQuestion));
      draftRef.current = restored;
      draftDirty.current = false;
      setDraft(restored);
    }, 0);
    return () => window.clearTimeout(timer);
    // Delivery-only bundle updates must not replace the editable draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle?.attemptId, currentQuestion?.questionId, displayedCommitId]);


  useEffect(() => {
    if (!bundle?.attemptId) return;
    const id = bundle.attemptId;
    let disposed = false;
    const refresh = async () => {
      let next = await loadV2Bundle(id);
      if (!next || disposed) return;
      if (next.localStatus === "sealing") next = await sealV2Bundle(id, next.sealingReason ?? "timeout");
      if (disposed) return;
      if (currentQuestion) {
        const answer = next.committedByQuestion[String(currentQuestion.questionId)];
        if (answer || next.finalSnapshot || !draftDirty.current) {
          if (textSaveTimer.current) window.clearTimeout(textSaveTimer.current);
          textSaveTimer.current = null;
          const restored = answer ? draftFromStoredAnswer(answer) : next.draftsByQuestion[String(currentQuestion.questionId)] ?? createEmptyDraft(currentQuestion);
          draftRef.current = restored;
          draftDirty.current = false;
          setDraft(restored);
          setDialog(null);
        }
      }
      applyBundle(next);
    };
    const stop = subscribeAttemptChanges(id, () => { void refresh().catch(() => setError("Не удалось обновить состояние попытки.")); });
    return () => { disposed = true; stop(); };
  }, [applyBundle, bundle?.attemptId, currentQuestion]);

  const persistCurrentDraft = useCallback(async () => {
    const latestDraft = draftRef.current;
    if (!draftDirty.current || !bundle || !currentQuestion || !latestDraft || isSealed || bundle.committedByQuestion[String(currentQuestion.questionId)]) return bundle;
    await draftWriteChain.current.catch(() => undefined);
    const next = await saveDraft(bundle.attemptId, currentQuestion.questionId, latestDraft);
    if (draftRef.current === latestDraft) draftDirty.current = false;
    setBundle(next); return next;
  }, [bundle, currentQuestion, isSealed]);

  const changeDraft = (next: AnswerDraft, immediate: boolean) => {
    draftRef.current = next;
    draftDirty.current = true;
    setDraft(next);
    if (!bundle || !currentQuestion) return;
    if (textSaveTimer.current) window.clearTimeout(textSaveTimer.current);
    if (immediate) {
      textSaveTimer.current = null;
      const write = draftWriteChain.current.catch(() => undefined)
        .then(() => saveDraft(bundle.attemptId, currentQuestion.questionId, next));
      draftWriteChain.current = write;
      void write
        .then((saved) => { if (draftRef.current === next) draftDirty.current = false; setBundle(saved); })
        .catch(() => setError("Не удалось сохранить черновик на устройстве."));
      return;
    }
    textSaveTimer.current = window.setTimeout(() => {
      const write = draftWriteChain.current.catch(() => undefined)
        .then(() => saveDraft(bundle.attemptId, currentQuestion.questionId, next));
      draftWriteChain.current = write;
      void write
        .then((saved) => { if (draftRef.current === next) draftDirty.current = false; setBundle(saved); })
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

  const requestFinish = async () => {
    if (!bundle) return;
    await persistCurrentDraft();
    const latest = await loadV2Bundle(bundle.attemptId);
    if (!latest) return;
    if (latest.localStatus !== "active") { applyBundle(latest); return; }
    // The summary must include drafts/commits written by the other tab too.
    setBundle(latest);
    if (currentQuestion) {
      const answer = latest.committedByQuestion[String(currentQuestion.questionId)];
      const restored = answer ? draftFromStoredAnswer(answer) : latest.draftsByQuestion[String(currentQuestion.questionId)] ?? createEmptyDraft(currentQuestion);
      draftRef.current = restored;
      draftDirty.current = false;
      setDraft(restored);
    }
    setDialog("confirm");
  };

  const upload = useCallback(async (sourceBundle = bundle, manual = true) => {
    if (!sourceBundle?.finalSnapshot) return;
    if (manual) setError(null);
    try {
      const result = await uploadOfficialSnapshot(sourceBundle.attemptId, { manual });
      if (result.bundle) applyBundle(result.bundle);
      if (result.response) setScore(result.response.score != null ? Math.round(result.response.score) : null);
      if (result.error && result.bundle?.localStatus !== "uploaded") {
        setError(getAttemptErrorMessage(result.error));
        if (manual) setDialog("error");
      }
    } catch (cause) {
      setError(getAttemptErrorMessage(cause instanceof Error ? cause.message : "answers_not_synced"));
      if (!manual) throw cause;
    }
  }, [applyBundle, bundle]);

  const uploadRef = useRef(upload);
  const uploadScheduler = useRef<ReturnType<typeof createOfficialUploadScheduler> | null>(null);
  useEffect(() => { uploadRef.current = upload; }, [upload]);
  const uploadAttemptId = bundle?.attemptId;
  useEffect(() => {
    if (!uploadAttemptId) return;
    const scheduler = createOfficialUploadScheduler({
      read: () => loadV2Bundle(uploadAttemptId),
      send: current => uploadRef.current(current, false),
      expire: async () => { applyBundle(await updateLocalStatus(uploadAttemptId, "upload_window_closed")); },
      online: () => navigator.onLine,
      events: window,
      onError: cause => setError(getAttemptErrorMessage(cause instanceof Error ? cause.message : "answers_not_synced")),
    });
    uploadScheduler.current = scheduler;
    return () => { scheduler.dispose(); uploadScheduler.current = null; };
  }, [applyBundle, uploadAttemptId]);
  useEffect(() => { uploadScheduler.current?.update(bundle); }, [bundle]);

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
  if (phase === "loading" || phase === "uploading") return <div className={styles.attemptOverlay}><div className={styles.attemptCenterState}><LoadingState label={phase === "loading" ? "Подготовка теста…" : "Отправка ответов…"} variant="compact" /></div></div>;
  if (phase === "fatal") return <div className={styles.attemptOverlay}><div className={styles.attemptCenterState}><AlertCircle size={42}/><h2 className={styles.attemptCenterTitle}>Не удалось открыть тест</h2><p className={styles.attemptCenterText}>{error}</p><button className={styles.attemptBackBtn} onClick={() => void initializeFromAttempt(props.resumeAttemptId)} >Повторить</button><button className={styles.attemptBackBtn} onClick={props.onExit}>В систему</button></div></div>;
  if (phase === "done") return <div className={styles.attemptOverlay}><div className={styles.attemptCenterState}><CheckCircle2 size={48} color="#16a34a"/><h2 className={styles.attemptCenterTitle}>{BFF_DEV ? "Ответы приняты" : "Тест сдан"}</h2>{!BFF_DEV && score != null ? <p className={styles.attemptScoreValue}>{score}</p> : null}<p className={styles.attemptCenterText}>{BFF_DEV ? "Тест отправлен в очередь на проверку. Статус и результат появятся в карточке теста после проверки." : "Результат принят сервером."}</p><button className={styles.attemptSubmitBtn} onClick={props.onCompleted}>В систему</button></div></div>;
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
    <header className={`${styles.attemptHeader} ${styles.officialAttemptHeader}`.trim()}>
      <button className={styles.attemptBackBtn} onClick={() => void exit()}><ArrowLeft size={16}/><span className={styles.attemptBackBtnLabel}>В систему</span></button>
      <div className={styles.officialAttemptHeaderMain}>
        <strong className={styles.officialAttemptTitle}>{props.testTitle}</strong>
        <div className={styles.officialAttemptTimeRow}>
          <div className={styles.attemptTimer}>{formatRemainingSeconds(remainingSeconds)}</div>
          <small>{isSealed ? "Отправить до" : "Ответить до"} {formatAttemptDeadline(isSealed ? bundle.time.uploadDeadlineEpochMs : bundle.time.answerDeadlineEpochMs)}</small>
        </div>
      </div>
      <div className={styles.officialAttemptHeaderActions}>
        {!isSealed ? <button className={`${styles.attemptBackBtn} ${styles.officialAttemptFinish}`.trim()} onClick={requestFinish}>Завершить</button> : null}
        <button className={styles.attemptQueueMenuBtn} onClick={() => setQueueOpen(true)} aria-label="Состояние сохранения"><Cloud size={16}/></button>
      </div>
    </header>
    <main className={styles.attemptMain}>
      <section className={styles.attemptQuestionCard}><div className={styles.attemptQuestionMeta}>Вопрос {currentIndex + 1} из {questions.length}</div><h2 className={styles.attemptQuestionText}>{currentQuestion.text}</h2>
        {currentQuestion.type === "text" ? <textarea className={styles.attemptTextInput} value={draft.type === "text" ? draft.textAnswer : ""} disabled={clockBlocked || committed || isSealed} onChange={(e) => changeDraft({ type: "text", textAnswer: e.target.value }, false)} onBlur={() => void persistCurrentDraft()} placeholder="Введите ответ..."/> : <div className={styles.attemptOptions}>{(currentQuestion.answers ?? []).map((option) => {
          const selected = currentQuestion.type === "single" ? draft.type === "single" && draft.selectedAnswer === option.id : draft.type === "multiple" && draft.selectedAnswers.includes(option.id);
          return <button key={option.id} disabled={clockBlocked || committed || isSealed} className={`${styles.attemptOption} ${selected ? styles.attemptOptionSelected : ""}`.trim()} onClick={() => changeDraft(currentQuestion.type === "single" ? { type: "single", selectedAnswer: option.id } : toggleMultipleAnswer(draft as Extract<AnswerDraft,{type:"multiple"}>, option.id), true)}><span className={styles.attemptOptionMarker}/><span>{option.text}</span></button>;
        })}</div>}
        <p className={styles.attemptQuestionStatus}>{clockBlocked ? "Системное время изменилось. Новые ответы заблокированы до сверки с сервером." : committed ? "Ответ зафиксирован — изменить нельзя" : isSealed ? "Попытка завершена" : "Ответ можно менять до нажатия «Далее»"}</p>
        {!isSealed ? <button className={styles.attemptNextBtn} disabled={clockBlocked || !isDraftValid(draft) || committed} onClick={() => isLast ? requestFinish() : void handleNext()}>{isLast ? "Завершить тест" : "Далее"}</button> : uploadWindowClosed ? <button className={`${styles.attemptSubmitBtn} ${styles.attemptExpiredSubmitBtn}`.trim()} onClick={() => setQueueOpen(true)}>Требуется помощь администратора</button> : <button className={`${styles.attemptSubmitBtn} ${styles.attemptExpiredSubmitBtn}`.trim()} onClick={() => void upload()}><Send size={16}/>Отправить сохранённые ответы</button>}
      </section>
      <section className={`${styles.attemptQuestionNav} ${styles.officialAttemptNav}`.trim()}>
        <span className={styles.officialAttemptNavTitle}>Навигация по вопросам</span>
        <div className={styles.attemptQuestionGrid}>{questions.map((q, index) => {
          const ready = Boolean(bundle.committedByQuestion[String(q.questionId)]);
          const accessible = ready || q.questionId === bundle.currentQuestionId;
          return <button key={q.questionId} disabled={!accessible} className={`${styles.attemptQuestionPill} ${index === currentIndex ? styles.attemptQuestionPillCurrent : ""} ${ready ? styles.attemptQuestionPillSynced : ""}`.trim()} onClick={() => { if (accessible) setViewQuestionId(q.questionId); }}>{index + 1}</button>;
        })}</div>
      </section>
    </main>
    {queueOpen ? <button type="button" className={styles.attemptQueueBackdrop} onClick={() => setQueueOpen(false)} aria-label="Закрыть состояние сохранения"/> : null}
    {queueOpen ? <aside className={`${styles.attemptQueueDrawer} ${styles.attemptQueueDrawerOpen}`.trim()}>
      <div className={styles.attemptQueueDrawerHead}>
        <div><p className={styles.attemptSidebarTitle}>Сохранение ответов</p><p className={styles.attemptQueueSummary}>{syncText}</p></div>
        <button type="button" className={styles.attemptQueueClose} onClick={() => setQueueOpen(false)} aria-label="Закрыть"><X size={18}/></button>
      </div>
      {uploadWindowClosed ? <div className={styles.attemptQueueError} role="status">
        <p>Срок отправки истёк {formatAttemptDeadline(bundle.time.uploadDeadlineEpochMs)}. Самостоятельная отправка больше недоступна. Ответы на устройстве не удалены.</p>
        <p>Обратитесь к администратору и передайте название теста и номер попытки {bundle.attemptId}. Сохраните данные этого браузера до решения вопроса.</p>
      </div> : null}
      <ul className={styles.attemptQueueList}>
        <li className={styles.attemptQueueItem}><div className={styles.attemptQueueItemTop}><span className={styles.attemptQueueQuestion}>Локально зафиксировано</span><strong className={styles.officialAttemptQueueValue}>{committedCount}</strong></div></li>
        <li className={styles.attemptQueueItem}><div className={styles.attemptQueueItemTop}><span className={styles.attemptQueueQuestion}>Сервер подтвердил</span><strong className={styles.officialAttemptQueueValue}>{bundle.syncSummary.serverAnswerCount}</strong></div></li>
        <li className={styles.attemptQueueItem}><div className={styles.attemptQueueItemTop}><span className={styles.attemptQueueQuestion}>Ожидают сервера</span><strong className={styles.officialAttemptQueueValue}>{pending}</strong></div></li>
      </ul>
      <p className={styles.attemptQueueSummary}>Последняя попытка по Москве: {bundle.syncSummary.lastAttemptAtMoscow ?? "—"}</p>
      {bundle.syncSummary.lastError ? <p className={styles.attemptQueueError}>{getAttemptErrorMessage(bundle.syncSummary.lastError)}</p> : null}
      <button className={`${styles.attemptSubmitBtn} ${styles.officialAttemptSyncButton}`.trim()} disabled={!pending || bundle.syncSummary.syncing} onClick={() => void syncOfficialNow(bundle.attemptId, true).then((next) => next && setBundle(next))}>Попробовать синхронизировать</button>
    </aside> : null}
  </div>;
}
