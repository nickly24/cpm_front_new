"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { examGet } from "@/lib/exams-v2/api";
import { fetchSectionStudyView, markCardLearned, unmarkCardLearned, updateSectionStudySettings } from "@/lib/training/training-api";
import { examTrainingPath, parseExamTrainingPath, trainingBasePath, type ExamTrainingLocation } from "@/lib/training/training-routes";
import { examPeriod, examSection, filterStudyCards, studyBatches, trainingError, trainingStats } from "@/lib/training/exam-training";
import { BATCH_SIZE_PRESETS, CARD_STATUS_LABELS, STUDY_FILTER_LABELS, type SectionStudyViewResponse, type StudySettings, type TrainingCard } from "@/lib/training/training-types";
import { TrainingFlashcards } from "./training-flashcards";
import styles from "./student-training.module.css";

export function StudentExamTraining({ segments }: { segments: string[] }) {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const location = parseExamTrainingPath(segments, params);
  if (!user) return null;
  const back = () => router.push(trainingBasePath(user.role));
  if (!location) return <div className={styles.page}><p role="alert">Адрес подготовки не найден</p><Button onClick={back}>К карточкам</Button></div>;
  return <ExamTraining key={`${user.id}:${location.examId}:${location.partId}:${location.area}`} studentId={user.id} location={location}
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
  const [listPage, setListPage] = useState(1);
  const request = useRef(0);
  const saving = useRef(false);
  const previewDeck = useMemo(() => {
    if (!preview || !view) return undefined;
    return location.batch === -1 ? view.cards : view.cards.slice(location.batch * view.settings.batch_size, (location.batch + 1) * view.settings.batch_size);
  }, [preview, view, location.batch]);

  const load = useCallback(async () => {
    const serial = ++request.current;
    try {
      let data = preview
        ? await examGet<SectionStudyViewResponse>(`/api/exams/${examId}/training/preview`)
        : await fetchSectionStudyView(studentId, "exam", refId);
      if (preview && partId) {
        const part = data.parts?.find((item) => item.part_id === partId);
        if (!part) throw new Error("Часть удалена из экзамена");
        const cards = data.cards.filter((card) => card.part_id === partId);
        data = { ...data, section_name: part.name, section_ref_id: refId, part_id: partId,
          cards, stats: trainingStats(cards), batches: studyBatches(cards, 10) };
      }
      const last = data.settings.last_batch_index ?? 0;
      data = { ...data, settings: { ...data.settings, last_batch_index: last === -1 ? -1 : data.batches[last] ? last : 0 } };
      if (serial !== request.current) return;
      setView(data);
      setError(null);
      setListPage(1);
    } catch (err) {
      if (serial === request.current) { setError(err); setView(null); }
    } finally {
      if (serial === request.current) setLoading(false);
    }
  }, [examId, partId, preview, refId, studentId]);
  // load updates state only after the awaited request; cleanup rejects obsolete responses.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); return () => { request.current += 1; }; }, [load]);
  const refresh = () => { setLoading(true); void load(); };

  const saveSettings = async (patch: Partial<StudySettings>) => {
    if (!view || saving.current) return null;
    let settings = { ...view.settings, ...patch, last_part_id: partId };
    saving.current = true;
    setBusy(true);
    setNotice("");
    try {
      if (!preview) {
        const result = await updateSectionStudySettings(studentId, "exam", refId, settings);
        if (!result.success) throw new Error(result.error ?? "Не удалось сохранить настройки");
        if (result.settings) settings = { ...result.settings, last_part_id: partId };
      }
      setView((current) => current ? { ...current, settings, batches: studyBatches(current.cards, settings.batch_size) } : current);
      return settings;
    } catch (err) {
      setNotice(trainingError(err));
      if (err instanceof ApiError && [403, 404, 422].includes(err.status ?? 0)) { setView(null); setError(err); }
      return null;
    }
    finally { saving.current = false; setBusy(false); }
  };

  const root = () => { navigate({}); void load(); };
  const start = async (batch: number) => {
    if (!view) return;
    const saved = await saveSettings({ last_batch_index: batch });
    if (saved) navigate({ area: true, partId, study: true, batch: saved.last_batch_index ?? 0, mode: saved.study_mode });
  };
  const resume = async () => {
    if (!view) return;
    const selectedPart = view.settings.last_part_id;
    if (selectedPart === 0) { setNotice("Последняя выбранная часть удалена. Выберите другую часть."); return; }
    const foundPart = selectedPart ? view.parts?.find((part) => part.part_id === selectedPart) : null;
    if (selectedPart && !foundPart) { setNotice("Последняя выбранная часть удалена. Выберите другую часть."); return; }
    const nextPart = foundPart?.part_id ?? null;
    if (preview) { navigate({ area: true, partId: nextPart }); return; }
    setBusy(true);
    try {
      const scope = await fetchSectionStudyView(studentId, "exam", nextPart ? `${examId}:${nextPart}` : String(examId));
      const batch = scope.settings.last_batch_index ?? 0;
      const size = scope.settings.batch_size;
      const source = batch === -1 ? scope.cards : scope.cards.slice(batch * size, (batch + 1) * size);
      const canStart = filterStudyCards(source, scope.settings.study_mode).length > 0;
      navigate({ area: true, partId: nextPart, study: canStart, batch, mode: scope.settings.study_mode });
    } catch (err) { setNotice(trainingError(err)); await load(); }
    finally { setBusy(false); }
  };
  const toggleLearned = async (card: TrainingCard) => {
    if (preview || saving.current) return;
    saving.current = true;
    setBusy(true);
    setNotice("");
    try {
      if (card.status === "learned") await unmarkCardLearned(studentId, card.card_ref);
      else await markCardLearned({ student_id: studentId, section_kind: "exam", section_ref_id: refId, card_ref: card.card_ref, content_fingerprint: card.content_fingerprint });
      await load();
    } catch (err) {
      setNotice(trainingError(err));
      // Re-read to replace changed content or close a disabled/deleted source.
      await load();
    } finally { saving.current = false; setBusy(false); }
  };

  if (loading) return <LoadingState label="Загрузка подготовки…" variant="panel" />;
  if (error || !view) return <div className={styles.page}><p className={styles.alert} role="alert">{trainingError(error)}</p>
    <div className={styles.examActions}><Button onClick={refresh}>Повторить загрузку</Button>{partId ? <Button onClick={root}>К частям экзамена</Button> : null}<Button onClick={onBack}>К карточкам</Button></div></div>;
  if (study) return <TrainingFlashcards key={`${refId}:${location.batch}:${location.mode}`} section={examSection(view)} studentId={studentId}
    batchIndex={location.batch} studyMode={location.mode} previewCards={previewDeck}
    onBack={() => { setLoading(true); navigate({ area: true, partId }); void load(); }} />;

  const settings = view.settings;
  const selectedBatch = settings.last_batch_index ?? 0;
  const selectedCards = selectedBatch === -1 ? view.cards : view.cards.slice(selectedBatch * settings.batch_size, (selectedBatch + 1) * settings.batch_size);
  const filtered = filterStudyCards(selectedCards, settings.study_mode);
  const allFiltered = filterStudyCards(view.cards, settings.study_mode);
  const exam = view.exam;
  return <div className={styles.page}>
    {preview ? <p className={styles.examNotice}>Предпросмотр: прогресс не сохраняется</p> : null}
    <div className={styles.examActions}><Button onClick={area ? root : onBack}>{area ? "← К частям экзамена" : "← К карточкам"}</Button><Button onClick={refresh}>Обновить</Button></div>
    <header className={styles.header}><div><span className={styles.eyebrow}>Из экзамена · №{examId}</span>
      <h1 className={styles.title}>{area ? partId ? view.section_name : "Весь экзамен" : exam?.directionName ?? view.section_name}</h1>
      <p className={styles.subtitle}>{exam?.directionName} · {examPeriod(exam?.startAt, exam?.endAt)}</p>
      <p>{view.stats.learned} из {view.stats.total} выучено · {view.stats.progress_percent ?? trainingStats(view.cards).progress_percent}%</p>
      <p className={styles.cardMeta}>Не выучено: {view.stats.unlearned} · Изменилось: {view.stats.answer_changed}</p></div></header>
    {notice ? <p className={styles.alert} role="alert">{notice}</p> : null}
    {!area ? <>
      <div className={styles.examActions}><Button onClick={() => void resume()} disabled={busy || !view.cards.length}>Продолжить</Button>
        <Button onClick={() => navigate({ area: true, batch: -1 })} disabled={!view.cards.length}>Учить весь экзамен</Button></div>
      {!view.cards.length ? <p>В экзамене пока нет карточек для подготовки</p> : null}
      <div className={styles.examParts}>{view.parts?.map((part) => <article className={styles.examPanel} key={part.refId}>
        <h2>{part.name}</h2><p>{part.learned_cards} из {part.total_cards} выучено · {part.progress_percent}%</p>
        <p>Изменилось: {part.answer_changed_cards ?? 0}</p>
        {part.total_cards ? <Button onClick={() => navigate({ area: true, partId: part.part_id })}>Открыть</Button> : <p>В этой части пока нет вопросов</p>}
      </article>)}</div>
    </> : <>
      <section className={styles.examPanel} aria-label="Настройки обучения"><div className={styles.examActions}>
        <label>По сколько карточек учить<select aria-label="По сколько карточек учить" value={settings.batch_size} disabled={busy} onChange={(event) => void saveSettings({ batch_size: Number(event.target.value), last_batch_index: 0 })}>{BATCH_SIZE_PRESETS.map((size) => <option key={size}>{size}</option>)}</select></label>
        <label>Режим<select aria-label="Режим" value={settings.study_mode} disabled={busy} onChange={(event) => void saveSettings({ study_mode: event.target.value as StudySettings["study_mode"] })}>{Object.entries(STUDY_FILTER_LABELS).map(([mode, label]) => <option key={mode} value={mode}>{mode === "all" ? "Все карточки" : label}</option>)}</select></label>
        <label>Набор<select aria-label="Набор" value={selectedBatch} disabled={busy} onChange={(event) => void saveSettings({ last_batch_index: Number(event.target.value) })}><option value={-1}>Все карточки области</option>{view.batches.map((batch) => <option key={batch.index} value={batch.index}>{batch.from}–{batch.to} · {batch.stats.learned}/{batch.stats.total} выучено</option>)}</select></label>
      </div><div className={styles.examActions}>
        <Button disabled={busy || !filtered.length} onClick={() => void start(selectedBatch)}>Учить выбранный набор ({filtered.length})</Button>
        <Button disabled={busy || !allFiltered.length} onClick={() => void start(-1)}>{partId ? "Учить всю часть" : "Учить весь экзамен"} ({allFiltered.length})</Button>
      </div>{!filtered.length ? <p>{settings.study_mode === "unlearned" && view.cards.length && !allFiltered.length ? "Все карточки этой области выучены. Выберите режим «Повторить выученные»." : "В выбранном наборе нет карточек для этого режима. Выберите другой набор или режим."}</p> : null}</section>
      <section className={styles.examPanel}><h2>Вопросы и ответы · {view.cards.length}</h2>
        {view.cards.slice((listPage - 1) * 20, listPage * 20).map((card) => <article className={styles.examQuestion} key={card.card_ref}>
          <p className={styles.cardMeta}>Часть {card.part_code} · <span title={card.status === "answer_changed" ? "Вопрос или ответ изменился после заучивания" : undefined}>{CARD_STATUS_LABELS[card.status]}</span></p>
          <p className={styles.cardRowQuestion}>{card.question}</p><details><summary>Эталонный ответ</summary><p className={styles.cardRowAnswer}>{card.answer}</p></details>
          {!preview ? <Button disabled={busy} onClick={() => void toggleLearned(card)}>{card.status === "learned" ? "Снять отметку" : "Выучено"}</Button> : null}
        </article>)}
        {view.cards.length > 20 ? <div className={styles.examActions}><Button disabled={listPage === 1} onClick={() => setListPage((page) => page - 1)}>Назад</Button><span>Страница {listPage} из {Math.ceil(view.cards.length / 20)}</span><Button disabled={listPage * 20 >= view.cards.length} onClick={() => setListPage((page) => page + 1)}>Далее</Button></div> : null}
      </section>
    </>}
  </div>;
}
