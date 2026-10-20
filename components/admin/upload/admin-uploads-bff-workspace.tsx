"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { adminHref } from "@/lib/auth/admin-access";
import { domain, bffRequest, exclusiveContext, resetRequests, announceSession, type Identity } from "@/lib/bff/client";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { examsAllPages, string, number } from "@/lib/bff/exams-shared";
import { commitUpload, createUpload, downloadUploadTemplate, uploadExternalTargets, uploadDirections, uploadCanRetry, uploadCanRecover, uploadCanRevoke, uploadCanRetryConfirmation, uploadJobNeedsPolling, uploadCommandJournalState, watchedUploadJobs, pollUploadJob, recoverUploadJob, revokeUploadJob, retryUploadConfirmation, downloadUploadSource, editUpload, pendingUploadCommand, recoverUploadCommand, reconcileUpload, retryUpload, uploadCatalog, uploadError, uploadJobs, uploadLabels, uploadReport, uploadReportCSV, uploadSession, uploadSessions, uploadStates, type UploadCatalog, type UploadJob, type UploadSession } from "@/lib/bff/uploads";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { AdminUploadsBffPreview as UploadPreview, uploadPreviewCanCommit } from "./admin-uploads-bff-preview";
import s from "./admin-upload.module.css";

interface CardDirection { id: number; name: string; sections: { kind: string; id?: number; name: string }[] }
interface Target { id: string; name: string }
const instructions: Record<string, string> = {
  "users.credentials": "Колонки: full_name, login, password; необязательные role, class, tg_name, school_id, group_id, role_id. До 100 пользователей. Пароли не отображаются в предпросмотре и отчёте, исходный файл не хранится.",
  "users.legacy": "Excel: ФИО, Класс, Школа, Проктор; необязательный tg_name. Сопоставление школ, прокторов и групп выполняет Core. Максимум 100 строк; новые учётные записи требуют сброса пароля.",
  "tests.json": "Excel с колонками Название теста, Номер, Категория вопроса, Вопрос, Варианты ответов, Правильный ответ, Примечание к ответу; также JSON и JS-экспорт OnlineTestPad. Варианты в Excel отмечаются А., Б. и т. п.; за вопрос — 1 балл. Выберите подразделение и направление, затем проверьте вопросы и предупреждения перед импортом.",
  "tests.external-results": "Excel с результатами внешнего теста. Выберите существующий внешний тест; он закрепится за загрузкой. ФИО, проценты и физические строки передаются Tests без самостоятельного сопоставления или расчёта оценки.",
  "cards.xlsx": "Колонки: Вопрос, Ответ. Выберите направление и существующую или новую тему. Ответы сохраняют переносы строк. Карточки общие для организации; кабинет загрузки закреплён в журнале.",
  "exams.questions": "Колонки: part_code, question_text, answer_text. Части должны существовать в выбранном экзамене.",
  "exams.assignments": "Колонки: student_id или student_login, examinator_1_id…examinator_6_id или examinator_1_login…examinator_6_login, replacement_limit. Нужен хотя бы один экзаменатор.",
  "exams.outside": "Колонки: student_id или student_login, points, grade, examinator. Оценка 0–5; существующие результаты изменяются в разделе экзаменов.",
};
function saveBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = filename; a.hidden = true; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }

export type UploadBackgroundIntent = { action: "commit"; session: UploadSession } | { action: "recover" | "revoke" | "retry" | "confirmation"; job: UploadJob; session?: UploadSession; originalRevision?: number };
const actionLabels = { commit: "Разрешить фоновый импорт", confirmation: "Продолжить исходное подтверждение", recover: "Разрешить проверку квитанции", revoke: "Отозвать фоновое разрешение", retry: "Повторить доставку задания" };
export function UploadBackgroundConfirmation({ intent, busy, onConfirm, onCancel }: { intent: UploadBackgroundIntent; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  const { user } = useAuth();
  const scope = user?.organizations?.find(org => org.id === (intent.action === "commit" ? intent.session : intent.job).organization_id);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal(); }, []);
  const value = intent.action === "commit" ? intent.session : intent.job;
  const target = intent.session?.target_id, revision = intent.action === "commit" ? intent.session.revision : intent.originalRevision ?? intent.session?.revision;
  const ownerPreview = intent.session?.preview !== null && typeof intent.session?.preview === "object" && !Array.isArray(intent.session.preview) ? intent.session.preview as Record<string, unknown> : {};
  const savedPreview = ownerPreview.preview !== null && typeof ownerPreview.preview === "object" && !Array.isArray(ownerPreview.preview) ? ownerPreview.preview as Record<string, unknown> : {};
  const savedTest = savedPreview.preview !== null && typeof savedPreview.preview === "object" && !Array.isArray(savedPreview.preview) ? savedPreview.preview as Record<string, unknown> : {};
  const cardsDirection = savedPreview.direction_id ?? ownerPreview.direction_id, themeId = savedPreview.theme_id;
  const testDirection = savedPreview.direction_id ?? savedTest.direction_id;
  return <dialog ref={dialog} className={s.main} aria-labelledby="upload-confirm-title" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }} style={{ width: "min(560px, calc(100vw - 32px))", maxHeight: "calc(100dvh - 40px)", overflow: "auto" }}>
    <h2 id="upload-confirm-title">{actionLabels[intent.action]}</h2>
    <p>{uploadLabels[value.type] ?? "Импорт"}</p>
    <p>Организация: {scope?.name ?? value.organization_id} · подразделение: {scope?.divisions.find(division => division.id === value.division_id)?.name ?? value.division_id}</p>
    {target && <p>Выбранный объект: {target}</p>}{revision !== undefined && <p>Версия предпросмотра: {revision}</p>}
    {value.type === "cards.xlsx" && <>
      <p>Направление: {typeof cardsDirection === "number" && Number.isSafeInteger(cardsDirection) && cardsDirection > 0 ? `ID ${cardsDirection}` : "не указано в сохранённом предпросмотре"}</p>
      {savedPreview.create_new_theme === true && savedPreview.theme_name_collision !== true && typeof savedPreview.new_theme_name === "string" && savedPreview.new_theme_name.trim() ? <p>Новая тема: {savedPreview.new_theme_name}</p> : <p>Существующая тема: {savedPreview.theme_name_collision === true && typeof savedPreview.new_theme_name === "string" && savedPreview.new_theme_name.trim() ? `${savedPreview.new_theme_name} · ` : ""}{typeof themeId === "number" && Number.isSafeInteger(themeId) && themeId > 0 ? `ID ${themeId}` : "не указана в сохранённом предпросмотре"}</p>}
    </>}
    {value.type === "tests.json" && <>
      <p>Направление: {typeof savedTest.direction_name === "string" && savedTest.direction_name.trim() ? `${savedTest.direction_name} · ` : ""}{typeof testDirection === "number" && Number.isSafeInteger(testDirection) && testDirection > 0 ? `ID ${testDirection}` : "не указано в сохранённом предпросмотре"}</p>
      <p>Название теста: {typeof savedTest.title === "string" && savedTest.title.trim() ? savedTest.title : typeof savedPreview.source_title === "string" && savedPreview.source_title.trim() ? savedPreview.source_title : "не указано в сохранённом предпросмотре"}</p>
    </>}
    {["commit", "confirmation"].includes(intent.action) && <><p>Разрешение относится только к этому предпросмотру в исходном кабинете. Применение продолжится в фоне после выхода из аккаунта.</p><p>Отзыв разрешения не отменяет уже применённые данные. Начатое применение может завершиться одновременно с отзывом.</p>{intent.action === "confirmation" && <p>Будет продолжена исходная команда с прежней версией предпросмотра. Новый импорт не создаётся.</p>}</>}
    {intent.action === "recover" && <p>Будет разрешена только проверка исходной квитанции. Данные не применятся повторно; проверка может продолжиться после выхода из аккаунта.</p>}
    {intent.action === "revoke" && <p>Отзыв запрещает дальнейшее применение, но не откатывает уже выполненные изменения. Начатое применение может завершиться одновременно с отзывом.</p>}
    {intent.action === "retry" && <p>Повторяется доставка того же разрешённого задания. Новое применение или новое фоновое разрешение не создаётся.</p>}
    <div className={s.actions}><Button disabled={busy} onClick={onConfirm}>{actionLabels[intent.action]}</Button><Button variant="ghost" disabled={busy} onClick={onCancel}>Отмена</Button></div>
  </dialog>;
}
export function UploadJobSummary({ job }: { job: UploadJob }) {
  return <div><h3>{uploadLabels[job.type] ?? "Импорт"}</h3><p>Исходная организация {job.organization_id} · подразделение {job.division_id}</p><p role="status">{uploadStates[job.status] ?? "Неизвестное состояние задания"}</p><p>Обработано: {job.processed} из {job.total}</p>
    {job.authorization?.bound === false && <p>Фоновое разрешение ещё не закреплено. Исходное подтверждение сохранено.</p>}
    {job.authorization?.mode === "receipt" && <p>Разрешена только проверка квитанции; повторное применение недоступно.</p>}
    {job.status === "completed" ? <p>Применение подтверждено владельцем данных.</p> : <p>Задание сохранено. Завершение импорта пока не подтверждено.</p>}
    {["outcome_unknown", "access_required", "authorization_expired", "revoked"].includes(job.status) && <p>Данные могли быть применены. Проверка квитанции не повторяет импорт, а отзыв не откатывает изменения.</p>}
  </div>;
}

function Workspace() {
  const { user } = useAuth();
  const [scopeChanging, setScopeChanging] = useState(false);
  const [catalog, setCatalog] = useState<UploadCatalog | null>(null), [typesId, setTypesId] = useState("");
  const [sessions, setSessions] = useState<UploadSession[]>([]), [jobs, setJobs] = useState<UploadJob[]>([]);
  const [session, setSession] = useState<UploadSession | null>(null), [tab, setTab] = useState<"new" | "journal">("new");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<CardDirection[]>([]), [targets, setTargets] = useState<Target[]>([]), [targetError, setTargetError] = useState<string | null>(null);
  const [direction, setDirection] = useState(""), [theme, setTheme] = useState(""), [newTheme, setNewTheme] = useState(true), [themeName, setThemeName] = useState(""), [target, setTarget] = useState("");
  const [templateFormat, setTemplateFormat] = useState<"cpm_json"|"online_test_pad"|"question_table">("question_table");
  const [otp, setOtp] = useState(() => {
    const date = new Date(), end = new Date(); end.setFullYear(end.getFullYear() + 5);
    const local = (value: Date) => value.toLocaleString("sv-SE", { timeZone:"Europe/Moscow" }).slice(0, 16).replace(" ", "T");
    return { title:"", startDate:local(date), endDate:local(end), timeLimitMinutes:"180", published:"false", visible:"false" };
  });
  const [directions, setDirections] = useState<{id:number;name:string}[]>([]);
  const [file, setFile] = useState<File | null>(null), [limit, setLimit] = useState(50);
  const input = useRef<HTMLInputElement>(null), loadGeneration = useRef(0), selectedGeneration = useRef(0), restoredSelection = useRef(false), inFlight = useRef(false);
  const [intent, setIntent] = useState<UploadBackgroundIntent | null>(null), [selectedJob, setSelectedJob] = useState<UploadJob | null>(null);
  const [journalReady, setJournalReady] = useState(false), [, setJournalEpoch] = useState(0);
  const journal = journalReady ? uploadCommandJournalState() : { pending: null, blocked: true, otherCabinet: false, error: "" };
  const pending = journal.pending, type = catalog?.types.find(t => t.type === typesId), disabled = busy || !!pending || journal.blocked || !!intent;
  useContextGuard(!scopeChanging && (busy || !!pending || journal.blocked && journalReady && !journal.otherCabinet || dirty || !!intent || session?.state === "preview"));
  useEffect(() => {
    const changed = () => setJournalEpoch(value => value + 1);
    queueMicrotask(() => setJournalReady(true));
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  const scopeName = user?.organizations?.find(org => org.id === user.organization_id), divisionName = scopeName?.divisions.find(div => div.id === user?.division_id)?.name;

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const generation = ++loadGeneration.current;
    try {
      const [c, ss, js] = await Promise.all([uploadCatalog(signal), uploadSessions(signal, limit), uploadJobs(signal, limit)]);
      if (signal?.aborted || generation !== loadGeneration.current) return;
      setCatalog(c); setSessions(ss); setJobs(js); setTypesId(previous => c.types.some(t => t.type === previous) ? previous : c.types.find(t => t.create && ["owner_session", "validated_input"].includes(t.mode) && t.type !== "cards.transform")?.type ?? c.types[0]?.type ?? ""); setError(null);
    } catch (reason) { if (!signal?.aborted && generation === loadGeneration.current) setError(uploadError(reason).message); }
    finally { if (!signal?.aborted && generation === loadGeneration.current) setLoading(false); }
  }, [limit]);
  useEffect(() => { const controller = new AbortController(); queueMicrotask(() => { void refresh(controller.signal); }); return () => { controller.abort(); }; }, [refresh]);
  useEffect(() => {
    if (tab !== "journal" || !jobs.some(uploadJobNeedsPolling)) return;
    const controller = new AbortController(), timer = setInterval(() => { void refresh(controller.signal); }, 4000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [jobs, refresh, tab]);
  useEffect(() => {
    if (!journalReady || selectedJob || journal.blocked || !catalog || restoredSelection.current) return;
    const controller = new AbortController();
    queueMicrotask(async () => {
      try {
        const watchedId = pending?.job_ref ?? watchedUploadJobs()[0]?.id;
        if (watchedId) {
          const restored = await pollUploadJob(watchedId, controller.signal);
          if (!controller.signal.aborted) { restoredSelection.current = true; setSelectedJob(restored); setTab("journal"); setJournalEpoch(value => value + 1); }
        }
      } catch (reason) { if (!controller.signal.aborted) setError(uploadError(reason).message); }
    });
    return () => controller.abort();
  }, [catalog, journal.blocked, journalReady, pending?.job_ref, selectedJob]);
  const selectedId = selectedJob?.id;
  const selectedPolling = selectedJob ? uploadJobNeedsPolling(selectedJob) : false;
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController(), generation = ++selectedGeneration.current;
    let reading = false;
    const read = async () => {
      if (reading || controller.signal.aborted) return;
      reading = true;
      try {
        const next = await pollUploadJob(selectedId, controller.signal);
        if (!controller.signal.aborted && generation === selectedGeneration.current) {
          setSelectedJob(next); setJobs(values => values.map(value => value.id === next.id ? next : value)); setJournalEpoch(value => value + 1);
        }
      } catch (reason) { if (!controller.signal.aborted && generation === selectedGeneration.current) setError(uploadError(reason).message); }
      finally { reading = false; }
    };
    void read();
    const timer = selectedPolling ? setInterval(() => { void read(); }, 4000) : null;
    return () => { controller.abort(); if (timer) clearInterval(timer); };
  }, [selectedId, selectedPolling]);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(async () => {
      setTargetError(null); setCards([]); setDirections([]); setTargets([]); setDirection(""); setTheme(""); setTarget(""); setFile(null); if (input.current) input.current.value = "";
      try {
        if (typesId === "cards.xlsx") {
          const data = await domain<{ directions: CardDirection[] }>("/cards/admin/catalog", { signal: controller.signal });
          if (!controller.signal.aborted) { setCards(data.directions); setDirection(String(data.directions[0]?.id ?? "")); }
        } else if (typesId === "tests.json") {
          const values = await uploadDirections(controller.signal);
          if (!controller.signal.aborted) setDirections(values);
        } else if (typesId === "tests.external-results") {
          const values = await uploadExternalTargets(controller.signal);
          if (!controller.signal.aborted) setTargets(values);
        } else if (typesId.startsWith("exams.")) {
          const exams = await examsAllPages(`/exams?scope=division&type=${typesId === "exams.outside" ? "outside_lms" : "classic"}`, controller.signal);
          if (!controller.signal.aborted) setTargets(exams.map(v => ({ id: String(number(v.id)), name: string(v.name, `Экзамен ${number(v.id)}`) })));
        }
      } catch (reason) { if (!controller.signal.aborted) setTargetError(uploadError(reason).message); }
    });
    return () => controller.abort();
  }, [typesId]);
  const perform = async (fn: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try { await fn(); } catch (reason) { setError(uploadError(reason).message); }
    finally { inFlight.current = false; setBusy(false); setJournalEpoch(value => value + 1); }
  };
  const open = async (value: UploadSession) => { const next = await uploadSession(value.id); setSession(next); setTab("new"); setDirty(false); };
  const upload = () => perform(async () => {
    if (!type || !file || disabled) return;
    const fields: Record<string, string> = {};
    if (type.type === "cards.xlsx") {
      if (!direction || newTheme && !themeName.trim() || !newTheme && !theme) throw new Error("Выберите направление и тему");
      fields.direction_id = direction;
      if (newTheme) { fields.create_new_theme = "true"; fields.new_theme_name = themeName.trim(); } else fields.theme_id = theme;
    }
    if (type.type === "tests.json") {
      if (!direction) throw new Error("Выберите направление");
      fields.direction_id = direction;
      if (/\.(js|xlsx)$/i.test(file.name)) for (const [key,value] of Object.entries(otp)) if (value !== "") fields[key] = value;
    }
    if (type.type === "tests.external-results") { if (!target) throw new Error("Выберите внешний тест"); fields.target_id = target; }
    if (type.type.startsWith("exams.")) { if (!target) throw new Error("Выберите экзамен"); fields.target_id = target; }
    const next = await createUpload(type, file, fields); setSession(next); setFile(null); if (input.current) input.current.value = "";
    // Native create responses can contain only a count; fetch the live rows explicitly.
    await open(next); await refresh();
  });
  const selectedType = session ? catalog?.types.find(t => t.type === session.type) : undefined;
  const close = () => { if (dirty && !window.confirm("Неотправленные изменения будут потеряны. Закрыть предпросмотр?")) return; setSession(null); setDirty(false); setFile(null); if (input.current) input.current.value = ""; };

  const showJob = (job: UploadJob) => { restoredSelection.current = true; setSelectedJob(job); setSession(null); setDirty(false); setTab("journal"); };
  const prepareJobIntent = (action: "recover" | "revoke" | "retry", job: UploadJob) => { void perform(async () => setIntent({ action, job, session: await uploadSession(job.session_id) })); };
  const confirmIntent = () => { void perform(async () => {
    if (!intent) return;
    let job: UploadJob;
    if (intent.action === "commit") {
      if (!catalog?.types.find(value => value.type === intent.session.type)?.commit || dirty || !uploadPreviewCanCommit(intent.session)) throw new Error("Этот предпросмотр сейчас нельзя подтвердить");
      job = await commitUpload(intent.session, true);
    } else if (intent.action === "confirmation") job = await retryUploadConfirmation(intent.job, true);
    else if (intent.action === "recover") job = await recoverUploadJob(intent.job, true);
    else if (intent.action === "revoke") job = await revokeUploadJob(intent.job, true);
    else job = await retryUpload(intent.job);
    setIntent(null); showJob(job); await refresh();
  }); };

  return <div className={s.page}>
    <header className={s.pageHeader}><div><h1 className={s.pageTitle}>Загрузка</h1><p className={s.hint}>{scopeName?.name ?? `Организация ${user?.organization_id}`} · {divisionName ?? `Подразделение ${user?.division_id}`}. Журнал показывает ваши загрузки в этом кабинете.</p></div><Button variant="secondary" disabled={busy || dirty} onClick={() => { void refresh(); }}>Обновить</Button></header>
    {error && <div className={s.errorList} role="alert">{error}</div>}
    {journal.error && <div className={s.errorList} role="alert">{journal.error}</div>}
    {pending && <div className={s.notice}><strong>Исход предыдущей команды требует проверки</strong><p>Команда сохранена для исходного кабинета. Новый импорт не будет отправлен автоматически. Неизвестный исход нельзя снять вручную.</p><div className={s.actions}><Button disabled={busy || !!intent} onClick={() => { void perform(async () => { const result = await recoverUploadCommand(); if (result.session) setSession(result.session); if (result.job) showJob(result.job); await refresh(); }); }}>Проверить исход</Button></div></div>}
    {intent && <UploadBackgroundConfirmation intent={intent} busy={busy} onConfirm={confirmIntent} onCancel={() => setIntent(null)} />}
    {loading && <LoadingState label="Загружаем доступные форматы и журнал" />}
    {catalog && <>
      <nav className={s.sectionTabs} aria-label="Загрузки"><Button variant={tab === "new" ? "primary" : "ghost"} disabled={dirty || !!intent} onClick={() => setTab("new")}>Новая загрузка</Button><Button variant={tab === "journal" ? "primary" : "ghost"} disabled={dirty || !!intent} onClick={() => setTab("journal")}>Журнал</Button></nav>
      {tab === "new" && (session ? <section className={s.previewWrap}>
        <div className={s.previewHeader}><div><h2>Предпросмотр загрузки</h2><p>{uploadLabels[session.type] ?? session.type} · {uploadStates[session.state] ?? session.state}</p><p className={s.hint}>Организация {scopeName?.name ?? session.organization_id} · подразделение {scopeName?.divisions.find(division => division.id === session.division_id)?.name ?? session.division_id} · срок {new Date(session.expires_at).toLocaleString("ru-RU")}</p></div><Button variant="ghost" disabled={disabled} onClick={close}>Закрыть предпросмотр</Button></div>
        <UploadPreview key={`${session.id}:${session.revision}`} session={session} editable={!!selectedType?.edit && session.state === "preview" && !disabled} busy={busy || !!intent} onDirty={setDirty} onSave={async (payload: Record<string, unknown>) => {
          if (inFlight.current || intent) throw new Error("Предыдущее действие ещё выполняется");
          inFlight.current = true; setBusy(true); setError(null);
          try { setSession(await editUpload(session, payload)); setDirty(false); await refresh(); }
          catch (reason) { setError(uploadError(reason).message); throw reason; }
          finally { inFlight.current = false; setBusy(false); setJournalEpoch(value => value + 1); }
        }} />
        {selectedType && !selectedType.commit && <p role="status" className={s.notice}>Предпросмотр доступен. Фоновое применение ожидает разрешения доступа; данные ещё не импортированы. Повторная попытка не обходит это ограничение.</p>}
        <div className={s.actions}>
          <Button disabled={disabled || dirty || !selectedType?.commit || session.state !== "preview" || !uploadPreviewCanCommit(session)} onClick={() => setIntent({ action: "commit", session })}>Подтвердить импорт</Button>
          <Button variant="secondary" disabled={busy || dirty || !!intent} onClick={() => { void perform(() => open(session)); }}>Проверить сохранённый предпросмотр</Button>
          {["editing", "edit_unknown"].includes(session.state) && <Button variant="secondary" disabled={busy} onClick={() => { void perform(async () => { const value = await reconcileUpload(session); setSession(value); if (pendingUploadCommand()?.action === "edit") await recoverUploadCommand(); }); }}>Проверить изменение</Button>}
          {session.file_id && session.type !== "users.credentials" && <Button variant="ghost" disabled={busy} onClick={() => { void perform(async () => saveBlob(await downloadUploadSource(session), `source.${selectedType?.formats[0] ?? "bin"}`)); }}>Скачать исходный файл</Button>}
        </div>
      </section> : <>
        <div className={s.typeListHorizontal}>{catalog.types.map(item => <button key={item.type} type="button" className={`${s.typeCard} ${typesId === item.type ? s.typeCardActive : ""}`} disabled={disabled} onClick={() => setTypesId(item.type)}><span className={s.typeCardHead}><strong className={s.typeCardLabel}>{uploadLabels[item.type] ?? item.type}</strong><span className={`${s.badge} ${item.create ? s.badgeReady : s.badgeSoon}`}>{item.formats.join(" / ").toUpperCase()}</span></span><span className={s.typeCardDesc}>{item.mode === "unavailable" ? "Ожидает подключения" : !item.create ? "Просмотр" : ["owner_session", "validated_input"].includes(item.mode) ? item.commit ? "Предпросмотр и подтверждение" : "Предпросмотр; применение ожидает доступа" : "В соответствующем разделе"}</span></button>)}</div>
        {!catalog.types.length && <div className={s.stateBox}>Нет доступных форматов. Нужны права на загрузку и соответствующий раздел.</div>}
        {type && <section className={s.main}><h2 className={s.mainTitle}>{uploadLabels[type.type] ?? type.type}</h2>
          {type.mode === "unavailable" ? <p>{"Источник пока не поддерживает этот формат."}</p> : type.type === "cards.transform" ? <p>Выбор карточек и создание черновика доступны в <Link href={adminHref(user, "train")}>разделе карточек</Link>.</p> : type.mode === "owner_direct_s3" || type.mode === "owner_attachment" ? <p>Загрузите файл в <Link href={adminHref(user, type.type === "homework.pdf" ? "assignments" : "zaps")}>соответствующем разделе</Link>; там сохраняется его состояние и доступ.</p> : <>
            {type.type === "tests.json" && <label className={s.metaField}>Подразделение для теста<select aria-label="Подразделение для теста" value={String(user?.division_id ?? "")} disabled={disabled || !!file} onChange={event => {
              const division = Number(event.target.value);
              if (!division || division === user?.division_id) return;
              if (inFlight.current) return;
              inFlight.current = true; setScopeChanging(true); setBusy(true); setError(null);
              void (async () => {
                try {
                  await exclusiveContext(async () => {
                    resetRequests();
                    await bffRequest<Identity>("/auth/context", { method:"POST", body:JSON.stringify({organization_id:user?.organization_id, division_id:division}) });
                  });
                  // Release the exclusive context lock before leaving. Keep our
                  // own unload guard off until the new document takes over.
                  announceSession(); window.location.replace(window.location.pathname);
                } catch (reason) {
                  setError(uploadError(reason).message); setScopeChanging(false); setBusy(false); inFlight.current = false;
                }
              })();
            }}><option value="" disabled>Выберите подразделение</option>{scopeName?.divisions.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select><span className={s.hint}>Выберите до файла. Импорт будет закреплён за этим подразделением.</span></label>}
            <p className={s.mainDesc}>{instructions[type.type]}</p><p className={s.hint}>До {type.max_rows ?? "—"} строк; файл до {Math.floor((type.max_bytes ?? 8 * 1024 * 1024) / 1024 / 1024)} МиБ.</p><Button variant="secondary" disabled={busy || type.template !== true || (type.type.startsWith("exams.") || type.type === "tests.external-results") && !target || type.type === "tests.json" && (!direction || !!targetError)} onClick={() => { void perform(async () => { const value = await downloadUploadTemplate(type, type.type === "tests.json" ? {directionId:Number(direction),format:templateFormat} : type.type.startsWith("exams.") || type.type === "tests.external-results" ? {targetId:target} : {}); saveBlob(value.blob, value.filename); }); }}>Скачать шаблон</Button>{type.template !== true && <p className={s.hint}>{type.type === "users.legacy" && !type.create ? "Этот шаблон доступен с правами изменения пользователей и загрузок." : type.template_reason === "not_applicable" ? "Этот формат не использует файловый шаблон." : "Источник пока не предоставил шаблон этого формата."}</p>}
            {type.template === true && type.type === "tests.json" && !direction && <p className={s.hint}>Чтобы скачать шаблон, выберите направление ниже.</p>}{type.template === true && (type.type.startsWith("exams.") || type.type === "tests.external-results") && !target && <p className={s.hint}>Чтобы скачать шаблон, выберите {type.type.startsWith("exams.") ? "экзамен" : "внешний тест"} ниже.</p>}
            {!type.commit && <p role="status" className={s.notice}>{!type.create ? "Режим просмотра: можно скачать доступный шаблон. Загрузка и подтверждение импорта требуют прав изменения." : "Файл можно проверить и исправить. Фоновое применение ожидает разрешения доступа; подтверждение импорта пока недоступно. Данные не будут применены обходной повторной попыткой."}</p>}
            {targetError && <p role="alert" className={s.previewErrorText}>{targetError}</p>}
            {type.type === "cards.xlsx" && <div className={s.metaEditor}><label className={s.metaField}>Направление<select value={direction} disabled={disabled || !type.create} onChange={e => { setDirection(e.target.value); setTheme(""); }}><option value="">Выберите направление</option>{cards.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className={s.metaCheck}><input type="checkbox" checked={newTheme} disabled={disabled || !type.create} onChange={e => setNewTheme(e.target.checked)} />Создать новую тему</label>{newTheme ? <label className={s.metaField}>Название темы<input maxLength={200} value={themeName} disabled={disabled || !type.create} onChange={e => setThemeName(e.target.value)} /></label> : <label className={s.metaField}>Тема<select value={theme} disabled={disabled || !type.create} onChange={e => setTheme(e.target.value)}><option value="">Выберите тему</option>{cards.find(d => String(d.id) === direction)?.sections.filter(section => section.kind === "manual" && section.id).map(section => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label>}</div>}
            {type.type === "tests.json" && <><label className={s.metaField}>Формат шаблона<select value={templateFormat} disabled={busy || !!intent} onChange={event => setTemplateFormat(event.target.value as "cpm_json"|"online_test_pad"|"question_table")}><option value="question_table">Excel (.xlsx)</option><option value="cpm_json">JSON CPM (.json)</option><option value="online_test_pad">OnlineTestPad (.js)</option></select></label><label className={s.metaField}>Направление<select value={direction} disabled={disabled || !!targetError} onChange={e => setDirection(e.target.value)}><option value="">Выберите направление</option>{directions.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>{file && /\.(js|xlsx)$/i.test(file.name) && <div className={s.metaEditor}><p className={s.hint}>Настройки теста: пустое название берётся из файла. Время указано по Москве. Новый тест по умолчанию скрыт.</p>{(["title", "startDate", "endDate", "timeLimitMinutes"] as const).map(key => <label key={key} className={s.metaField}>{{title:"Название",startDate:"Начало",endDate:"Окончание",timeLimitMinutes:"Лимит, минут"}[key]}<input type={key === "startDate" || key === "endDate" ? "datetime-local" : key === "timeLimitMinutes" ? "number" : "text"} value={otp[key]} disabled={disabled} onChange={e => setOtp(previous => ({...previous,[key]:e.target.value}))} /></label>)}{(["published", "visible"] as const).map(key => <label key={key} className={s.metaField}>{key === "published" ? "Опубликовать" : "Показывать ответы"}<select value={otp[key]} disabled={disabled} onChange={e => setOtp(previous => ({...previous,[key]:e.target.value}))}><option value="">По источнику</option><option value="true">Да</option><option value="false">Нет</option></select></label>)}</div>}</>}
            {type.type === "tests.external-results" && <label className={s.metaField}>Внешний тест<select value={target} disabled={disabled || !!targetError} onChange={e => setTarget(e.target.value)}><option value="">Выберите внешний тест</option>{targets.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>}
            {type.type.startsWith("exams.") && <label className={s.metaField}>Экзамен<select value={target} disabled={disabled || !!targetError} onChange={e => setTarget(e.target.value)}><option value="">Выберите экзамен</option>{targets.map(exam => <option key={exam.id} value={exam.id}>{exam.name} · {exam.id}</option>)}</select></label>}
            <label className={s.metaField}>Файл<input ref={input} type="file" accept={type.formats.map(ext => `.${ext}`).join(",")} disabled={disabled || !type.create || !!targetError} onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
            {file && <p>{file.name} · {Math.ceil(file.size / 1024)} КиБ</p>}{file && <Button variant="ghost" disabled={disabled} onClick={() => { setFile(null); if (input.current) input.current.value = ""; }}>Убрать файл</Button>}<Button disabled={disabled || !type.create || !file || !!targetError} onClick={() => { void upload(); }}>Подготовить предпросмотр</Button>
          </>}
        </section>}
      </>)}
      {tab === "journal" && <section className={s.previewWrap}><h2>Журнал загрузок</h2><p className={s.hint}>Задания сохраняют исходное подразделение. После повторного входа может потребоваться подтверждение доступа. Показаны последние {limit} записей.</p><label className={s.metaField}>Количество записей<select value={limit} disabled={busy || !!intent} onChange={e => setLimit(Number(e.target.value))}>{[20, 50, 100, 200].map(v => <option key={v}>{v}</option>)}</select></label>
        {!sessions.length && !jobs.length ? <p>Загрузок пока нет.</p> : null}
        {selectedJob && <section className={s.main} aria-label="Выбранное задание"><UploadJobSummary job={selectedJob} />
          {selectedJob.error && <p role="alert" className={s.previewErrorText}>{uploadError(Object.assign(new Error(selectedJob.error), { code: selectedJob.error })).message}</p>}
          <div className={s.actions}>
            <Button variant="ghost" disabled={busy || !!intent} onClick={() => { void perform(async () => setSelectedJob(await pollUploadJob(selectedJob.id))); }}>Проверить состояние задания</Button>
            {pending?.action === "commit" && pending.job_ref === selectedJob.id && uploadCanRetryConfirmation(selectedJob) && <Button disabled={busy || !!intent || pending.expected_revision === undefined} onClick={() => { void perform(async () => setIntent({ action: "confirmation", job: selectedJob, session: await uploadSession(selectedJob.session_id), originalRevision: pending.expected_revision })); }}>Продолжить исходное подтверждение</Button>}
            {uploadCanRecover(selectedJob, catalog.types.find(value => value.type === selectedJob.type)) && <Button variant="secondary" disabled={disabled} onClick={() => prepareJobIntent("recover", selectedJob)}>Проверить квитанцию с новым разрешением</Button>}
            {uploadCanRevoke(selectedJob, catalog.types.find(value => value.type === selectedJob.type)) && <Button variant="secondary" disabled={disabled} onClick={() => prepareJobIntent("revoke", selectedJob)}>Отозвать разрешение</Button>}
            {uploadCanRetry(selectedJob, catalog.types.find(value => value.type === selectedJob.type)) && <Button variant="secondary" disabled={disabled} onClick={() => prepareJobIntent("retry", selectedJob)}>Повторить доставку задания</Button>}
            <Button variant="ghost" disabled={busy || !!intent} onClick={() => setSelectedJob(null)}>Закрыть сведения</Button>
          </div>
        </section>}
        <h3>Задания</h3><div className={s.previewTableWrap}><table className={s.previewTable}><thead><tr><th>Дата / формат</th><th>Состояние</th><th>Подтверждено</th><th>Действия</th></tr></thead><tbody>{jobs.map(job => <tr key={job.id}><td>{new Date(job.created_at).toLocaleString("ru-RU")}<br />{uploadLabels[job.type] ?? job.type}</td><td>{uploadStates[job.status] ?? job.status}{job.error && <p className={s.previewErrorText}>{uploadError(Object.assign(new Error(job.error), { code: job.error })).message}</p>}</td><td>{job.processed} из {job.total}<br />{job.status === "completed" ? "Импорт подтверждён" : "Завершение не подтверждено"}</td><td><div className={s.actions}><Button variant="ghost" disabled={busy} onClick={() => { restoredSelection.current = true; setSelectedJob(job); }}>Открыть</Button>{uploadCanRetry(job, catalog.types.find(t => t.type === job.type)) && <Button variant="secondary" disabled={disabled} onClick={() => prepareJobIntent("retry", job)}>Повторить доставку задания</Button>}{job.status === "completed" && <Button variant="ghost" disabled={busy} onClick={() => { void perform(async () => { const report = await uploadReport(job.id); saveBlob(new Blob(["\ufeff" + uploadReportCSV(report)], { type: "text/csv;charset=utf-8" }), `upload-report-${job.id}.csv`); }); }}>Скачать отчёт</Button>}</div></td></tr>)}</tbody></table></div>
        <h3>Предпросмотры</h3><div className={s.previewTableWrap}><table className={s.previewTable}><thead><tr><th>Дата / формат</th><th>Состояние</th><th>Действия</th></tr></thead><tbody>{sessions.map(value => <tr key={value.id}><td>{new Date(value.created_at).toLocaleString("ru-RU")}<br />{uploadLabels[value.type] ?? value.type}</td><td>{uploadStates[value.state] ?? value.state}</td><td><Button variant="ghost" disabled={busy} onClick={() => { void perform(() => open(value)); }}>Предпросмотр</Button></td></tr>)}</tbody></table></div>
      </section>}
    </>}
  </div>;
}

export function AdminUploadsBffWorkspace() {
  const { user } = useAuth();
  if (!user?.division_id) return <div className={s.stateBox}>Выберите подразделение в меню кабинетов, чтобы открыть загрузки.</div>;
  return <Workspace key={`${user.account_id}:${user.organization_id}:${user.division_id}`} />;
}
