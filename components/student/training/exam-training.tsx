"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchExamTrainingSelection, markCardLearned, unmarkCardLearned, updateSectionStudySettings } from "@/lib/training/training-api";
import { examTrainingPath, parseExamTrainingPath, trainingBasePath, type ExamTrainingLocation } from "@/lib/training/training-routes";
import { examPeriod, examSection, trainingError, trainingUnavailable } from "@/lib/training/exam-training";
import { BATCH_SIZE_PRESETS, CARD_STATUS_LABELS, STUDY_FILTER_LABELS, type SectionStudyViewResponse, type SectionStats, type StudySettings, type TrainingCard } from "@/lib/training/training-types";
import { TrainingFlashcards } from "./training-flashcards";
import styles from "./student-training.module.css";

function filteredCount(stats: Pick<SectionStats, "total" | "learned" | "unlearned" | "answer_changed"> | undefined, mode: StudySettings["study_mode"]) {
  if (!stats) return 0;
  return mode === "all" ? stats.total : mode === "learned" ? stats.learned : mode === "stale" ? stats.answer_changed : stats.unlearned + stats.answer_changed;
}

export function StudentExamTraining({ segments }: { segments: string[] }) {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const location = parseExamTrainingPath(segments, params);
  if (!user) return null;
  const back = () => router.push(trainingBasePath(user.role));
  if (!location) return <div className={styles.page}><p role="alert">Адрес подготовки не найден</p><Button onClick={back}>К карточкам</Button></div>;
  return <ExamTraining key={`${user.context_revision ?? `${user.account_id}:${user.organization_id}:${user.division_id}`}:${location.examId}:${location.partId}:${location.area}`} studentId={user.account_id ?? user.id} location={location}
    navigate={(next) => router.push(examTrainingPath(user.role, location.examId, next))} onBack={back} />;
}

export function ExamTrainingPreview({ examId }: { examId: number }) {
  const [location, setLocation] = useState<ExamTrainingLocation>({ examId, partId: null, area: false, study: false, batch: 0, mode: "all" });
  return <ExamTraining key={`${examId}:${location.partId}:${location.area}`} preview studentId={0} location={location}
    navigate={(next) => setLocation({ examId, partId: null, area: false, study: false, batch: 0, mode: "all", ...next })}
    onBack={() => setLocation({ examId, partId: null, area: false, study: false, batch: 0, mode: "all" })} />;
}

export function ExamTraining({ studentId, location, navigate, onBack, preview = false }: {
  studentId: number;
  location: ExamTrainingLocation;
  navigate: (next: Partial<ExamTrainingLocation>) => void;
  onBack: () => void;
  preview?: boolean;
}) {
  const { examId, partId, area, study } = location;
  const refId = partId ? `${examId}:${partId}` : String(examId);
  const [view, setView] = useState<SectionStudyViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useContextGuard(busy);
  const [listPage, setListPage] = useState(1);
  const selectionKey = `${refId}:${area}:${study}:${location.batch}:${listPage}`;
  const [loadedSelection, setLoadedSelection] = useState("");
  const request = useRef(0);
  const selectionEpoch = useRef(0);
  const saving = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const previewSettings = useRef<StudySettings | null>(null);

  const load = useCallback(async () => {
    const serial = ++request.current;
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    try {
      const selection = preview && study ? location.batch === -1 ? {} : { batchIndex: location.batch } : !area || study ? { summary: true } : { page: listPage, limit: 20 };
      let data = await fetchExamTrainingSelection(studentId, refId, { ...selection, ...(preview ? { batchSize: previewSettings.current?.batch_size } : {}) }, preview, current.signal);
      const settings = preview ? { ...data.settings, ...previewSettings.current } : data.settings;
      const last = settings.last_batch_index ?? 0;
      data = { ...data, settings: { ...settings, last_batch_index: last === -1 ? -1 : data.batches.some(batch => batch.index === last) ? last : 0 } };
      if (serial !== request.current || current.signal.aborted) return;
      setView(data); setLoadedSelection(selectionKey); setError(null);
    } catch (err) {
      if (serial === request.current && !current.signal.aborted) { setError(err); setView(null); }
    } finally {
      if (serial === request.current && !current.signal.aborted) setLoading(false);
    }
  }, [area, listPage, location.batch, preview, refId, studentId, study, selectionKey]);
  // load updates state only after the awaited request; cleanup rejects obsolete responses.
  useEffect(() => { selectionEpoch.current += 1; void load(); return () => { selectionEpoch.current += 1; request.current += 1; controller.current?.abort(); }; }, [load]);
  const refresh = () => { setLoading(true); void load(); };
  const changePage = (page: number) => { if (saving.current) return; setLoading(true); setListPage(page); };

  const saveSettings = async (patch: Partial<StudySettings>) => {
    if (!view || saving.current) return null;
    const epoch = selectionEpoch.current;
    let settings = { ...view.settings, ...patch, last_part_id: partId };
    saving.current = true;
    setBusy(true);
    setNotice("");
    try {
      if (!preview) {
        const result = await updateSectionStudySettings(studentId, "exam", refId, settings);
        if (epoch !== selectionEpoch.current) return null;
        if (!result.success) throw new Error(result.error ?? "Не удалось сохранить настройки");
        if (result.settings) settings = { ...result.settings, last_part_id: partId };
      }
      if (preview) previewSettings.current = settings;
      setView(current => current ? { ...current, settings } : current);
      if (settings.batch_size !== view.settings.batch_size) await load();
      return settings;
    } catch (err) {
      if (epoch !== selectionEpoch.current) return null;
      setNotice(trainingError(err));
      if (trainingUnavailable(err)) { setView(null); setError(err); }
      return null;
    }
    finally { saving.current = false; setBusy(false); }
  };

  const root = () => navigate({});
  const start = async (batch: number) => {
    if (!view) return;
    const saved = await saveSettings({ last_batch_index: batch });
    if (saved) navigate({ area: true, partId, study: true, batch: saved.last_batch_index ?? 0, mode: saved.study_mode });
  };
  const resume = async () => {
    if (!view || saving.current) return;
    const epoch = selectionEpoch.current;
    const selectedPart = view.settings.last_part_id;
    if (selectedPart === 0) { setNotice("Последняя выбранная часть удалена. Выберите другую часть."); return; }
    const foundPart = selectedPart ? view.parts?.find((part) => part.part_id === selectedPart) : null;
    if (selectedPart && !foundPart) { setNotice("Последняя выбранная часть удалена. Выберите другую часть."); return; }
    const nextPart = foundPart?.part_id ?? null;
    if (preview) { navigate({ area: true, partId: nextPart }); return; }
    setBusy(true);
    try {
      const scope = await fetchExamTrainingSelection(studentId, nextPart ? `${examId}:${nextPart}` : String(examId), { summary: true });
      if (epoch !== selectionEpoch.current) return;
      const batch = scope.settings.last_batch_index ?? 0;
      const stats = batch === -1 ? scope.stats : scope.batches.find(item => item.index === batch)?.stats;
      const canStart = filteredCount(stats, scope.settings.study_mode) > 0;
      navigate({ area: true, partId: nextPart, study: canStart, batch, mode: scope.settings.study_mode });
    } catch (err) { if (epoch === selectionEpoch.current) { setNotice(trainingError(err)); await load(); } }
    finally { setBusy(false); }
  };
  const toggleLearned = async (card: TrainingCard) => {
    if (preview || saving.current) return;
    const epoch = selectionEpoch.current;
    saving.current = true;
    setBusy(true);
    setNotice("");
    try {
      if (card.status === "learned") await unmarkCardLearned(studentId, card.card_ref);
      else await markCardLearned({ student_id: studentId, section_kind: "exam", section_ref_id: refId, card_ref: card.card_ref, content_fingerprint: card.content_fingerprint });
      if (epoch === selectionEpoch.current) await load();
    } catch (err) {
      if (epoch !== selectionEpoch.current) return;
      setNotice(trainingError(err));
      // Re-read to replace changed content or close a disabled/deleted source.
      await load();
    } finally { saving.current = false; setBusy(false); }
  };

  if (loading || !error && loadedSelection !== selectionKey) return <LoadingState label="Загрузка подготовки…" variant="panel" />;
  if (error || !view) return <div className={styles.page}><p className={styles.alert} role="alert">{trainingError(error)}</p>
    <div className={styles.examActions}><Button onClick={refresh}>Повторить загрузку</Button>{partId ? <Button onClick={root}>К частям экзамена</Button> : null}<Button onClick={onBack}>К карточкам</Button></div></div>;
  if (study) return <TrainingFlashcards key={`${refId}:${location.batch}:${location.mode}`} section={examSection(view)} studentId={studentId}
    batchIndex={location.batch} studyMode={location.mode} previewCards={preview ? view.cards : undefined}
    onBack={() => { setLoading(true); navigate({ area: true, partId }); }} />;

  const settings = view.settings;
  const selectedBatch = settings.last_batch_index ?? 0;
  const selectedStats = selectedBatch === -1 ? view.stats : view.batches.find(batch => batch.index === selectedBatch)?.stats;
  const filtered = filteredCount(selectedStats, settings.study_mode);
  const allFiltered = filteredCount(view.stats, settings.study_mode);
  const exam = view.exam;
  return <div className={styles.page}>
    {preview ? <p className={styles.examNotice}>Предпросмотр: прогресс не сохраняется</p> : null}
    <div className={styles.examActions}><Button disabled={busy} onClick={area ? root : onBack}>{area ? "← К частям экзамена" : "← К карточкам"}</Button><Button disabled={busy} onClick={refresh}>Обновить</Button></div>
    <header className={styles.header}><div><span className={styles.eyebrow}>Из экзамена · №{examId}</span>
      <h1 className={styles.title}>{area ? partId ? view.section_name : "Весь экзамен" : exam?.directionName ?? view.section_name}</h1>
      <p className={styles.subtitle}>{exam?.directionName} · {examPeriod(exam?.startAt, exam?.endAt)}</p>
      <p>{view.stats.learned} из {view.stats.total} выучено · {view.stats.progress_percent ?? (view.stats.total ? Math.round(view.stats.learned * 100 / view.stats.total) : 0)}%</p>
      <p className={styles.cardMeta}>Не выучено: {view.stats.unlearned} · Изменилось: {view.stats.answer_changed}</p></div></header>
    {notice ? <p className={styles.alert} role="alert">{notice}</p> : null}
    {!area ? <>
      <div className={styles.examActions}><Button onClick={() => void resume()} disabled={busy || !view.stats.total}>Продолжить</Button>
        <Button onClick={() => navigate({ area: true, batch: -1 })} disabled={busy || !view.stats.total}>Учить весь экзамен</Button></div>
      {!view.stats.total ? <p>В экзамене пока нет карточек для подготовки</p> : null}
      <div className={styles.examParts}>{view.parts?.map((part) => <article className={styles.examPanel} key={part.refId}>
        <h2>{part.name}</h2><p>{part.learned_cards} из {part.total_cards} выучено · {part.progress_percent}%</p>
        <p>Изменилось: {part.answer_changed_cards ?? 0}</p>
        {part.total_cards ? <Button disabled={busy} onClick={() => navigate({ area: true, partId: part.part_id })}>Открыть</Button> : <p>В этой части пока нет вопросов</p>}
      </article>)}</div>
    </> : <>
      <section className={styles.examPanel} aria-label="Настройки обучения"><div className={styles.examActions}>
        <label>По сколько карточек учить<select aria-label="По сколько карточек учить" value={settings.batch_size} disabled={busy} onChange={(event) => void saveSettings({ batch_size: Number(event.target.value), last_batch_index: 0 })}>{BATCH_SIZE_PRESETS.map((size) => <option key={size}>{size}</option>)}</select></label>
        <label>Режим<select aria-label="Режим" value={settings.study_mode} disabled={busy} onChange={(event) => void saveSettings({ study_mode: event.target.value as StudySettings["study_mode"] })}>{Object.entries(STUDY_FILTER_LABELS).map(([mode, label]) => <option key={mode} value={mode}>{mode === "all" ? "Все карточки" : label}</option>)}</select></label>
        <label>Набор<select aria-label="Набор" value={selectedBatch} disabled={busy} onChange={(event) => void saveSettings({ last_batch_index: Number(event.target.value) })}><option value={-1}>Все карточки области</option>{view.batches.map((batch) => <option key={batch.index} value={batch.index}>{batch.from}–{batch.to} · {batch.stats.learned}/{batch.stats.total} выучено</option>)}</select></label>
      </div><div className={styles.examActions}>
        <Button disabled={busy || !filtered} onClick={() => void start(selectedBatch)}>Учить выбранный набор ({filtered})</Button>
        <Button disabled={busy || !allFiltered} onClick={() => void start(-1)}>{partId ? "Учить всю часть" : "Учить весь экзамен"} ({allFiltered})</Button>
      </div>{!filtered ? <p>{settings.study_mode === "unlearned" && view.stats.total && !allFiltered ? "Все карточки этой области выучены. Выберите режим «Повторить выученные»." : "В выбранном наборе нет карточек для этого режима. Выберите другой набор или режим."}</p> : null}</section>
      <section className={styles.examPanel}><h2>Вопросы и ответы · {view.stats.total}</h2>
        {view.cards.map((card) => <article className={styles.examQuestion} key={card.card_ref}>
          <p className={styles.cardMeta}>Часть {card.part_code} · <span title={card.status === "answer_changed" ? "Вопрос или ответ изменился после заучивания" : undefined}>{CARD_STATUS_LABELS[card.status]}</span></p>
          <p className={styles.cardRowQuestion}>{card.question}</p><details><summary>Эталонный ответ</summary><p className={styles.cardRowAnswer}>{card.answer}</p></details>
          {!preview ? <Button disabled={busy} onClick={() => void toggleLearned(card)}>{card.status === "learned" ? "Снять отметку" : "Выучено"}</Button> : null}
        </article>)}
        {view.stats.total > 20 ? <div className={styles.examActions}><Button disabled={busy || listPage === 1} onClick={() => changePage(listPage - 1)}>Назад</Button><span>Страница {listPage} из {Math.ceil(view.stats.total / 20)}</span><Button disabled={busy || listPage * 20 >= view.stats.total} onClick={() => changePage(listPage + 1)}>Далее</Button></div> : null}
      </section>
    </>}
  </div>;
}
