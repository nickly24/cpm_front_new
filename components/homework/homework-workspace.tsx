"use client";
import { useContextGuard } from "@/lib/bff/use-context-guard";

import { useHomeworkUploads } from "@/contexts/homework-upload-context";
import { useAuth } from "@/contexts/AuthContext";
import { deleteScannerProject } from "@/lib/homework-scanner/project-store";
import { homeworkErrorMessage, homeworkFilesApi } from "@/lib/homework-files/api";
import { homeworkMiB, homeworkWorkspaceLimits } from "@/lib/homework-files/limits";
import type { HomeworkWorkspace, SubmissionState } from "@/lib/homework-files/types";
import { useHomeworkDialog } from "@/lib/homework-files/use-dialog";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, Clock3, FileText, FileUp, Info, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScannerModal } from "./scanner-modal";
import { HomeworkAttachmentPicker, HomeworkFileScreen, HomeworkStatusLegend, HomeworkStatusSymbol, homeworkWorkspaceStates } from "./student-workspace-panels";
import { StudentNavIcon } from "@/components/student/navigation/student-nav-icon";
import { homeworkFileSize } from "./staff-homework-utils";
import styles from "./homework-workspace.module.css";

const date = (value?: string | null) => value ? new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" }) : "Без срока";
const busyJob = (status?: string) => Boolean(status && ["local", "uploading", "queued", "running", "retry"].includes(status));
const workspaceFileKey = (data: HomeworkWorkspace) => `${data.submission.id}:${data.submission.draft_file?.id || data.submission.has_draft}:${data.submission.current_file?.id || data.submission.has_file}`;

export function HomeworkWorkspaceModal({ homeworkId, onClose, presentation = "modal" }: { homeworkId: number; onClose: () => void; presentation?: "modal" | "page" }) {
  const { user } = useAuth();
  const { enqueue, jobs, cancel, retry } = useHomeworkUploads();
  const [workspace, setWorkspace] = useState<HomeworkWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [urlLifetime, setUrlLifetime] = useState(300);
  const [scanner, setScanner] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  useContextGuard(scanner || Boolean(action));
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [preview, setPreview] = useState(false);
  const [legend, setLegend] = useState(false);
  const [attachmentPicker, setAttachmentPicker] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const fileKey = useRef("");
  const alive = useRef(true);
  const latestWorkspace = useRef<HomeworkWorkspace | null>(null);
  const fetchSequence = useRef(0);
  const fileSequence = useRef(0);
  useHomeworkDialog(dialog, onClose, presentation === "modal");
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const refreshFile = useCallback(async (data = latestWorkspace.current) => {
    const sequence = ++fileSequence.current;
    if (!data?.submission.id || !(data.submission.has_draft || data.submission.has_file)) { setPdfUrl(null); fileKey.current = data ? workspaceFileKey(data) : ""; return; }
    const key = workspaceFileKey(data);
    const result = await homeworkFilesApi.fileUrl(data.submission.id, data.submission.has_draft);
    if (!alive.current || sequence !== fileSequence.current || !latestWorkspace.current || workspaceFileKey(latestWorkspace.current) !== key) return;
    fileKey.current = key;
    setPdfUrl(result.url);
    setUrlLifetime(result.expires_in || 300);
  }, []);
  useEffect(() => {
    if (!pdfUrl) return;
    const timer = window.setTimeout(() => void refreshFile().catch(() => undefined), Math.max(30, urlLifetime - 30) * 1000);
    return () => window.clearTimeout(timer);
  }, [pdfUrl, urlLifetime, refreshFile]);
  const load = useCallback(async (initial = false) => {
    const sequence = ++fetchSequence.current;
    if (initial) setLoading(true);
    try {
      const data = await homeworkFilesApi.workspace(homeworkId);
      if (!alive.current || sequence !== fetchSequence.current) return;
      latestWorkspace.current = data; setWorkspace(data); setError(null);
      window.dispatchEvent(new CustomEvent("homework-workspace-updated", { detail: { homeworkId, workspace: data } }));
      const key = workspaceFileKey(data);
      if (key !== fileKey.current) await refreshFile(data);
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "Не удалось открыть работу"); }
    finally { if (alive.current) setLoading(false); }
  }, [homeworkId, refreshFile]);
  useEffect(() => { const timer = window.setTimeout(() => void load(true), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible" && !action) void load(); };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 30_000);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [load, action]);
  const job = [...jobs].reverse().find(item => item.homework_id === homeworkId && item.status !== "cancelled");
  const jobMarker = job ? `${job.id}:${job.status}` : "";
  useEffect(() => { const timer = window.setTimeout(() => { if (jobMarker) void load(); }, 0); return () => window.clearTimeout(timer); }, [jobMarker, load]);
  const activeJob = busyJob(job?.status) ? job : busyJob(workspace?.active_job?.status) ? workspace?.active_job : null;
  const processing = Boolean(activeJob);
  const state: SubmissionState = processing ? (activeJob?.status === "local" || activeJob?.status === "uploading" ? "uploading" : "processing") : workspace?.submission.state === "none" && workspace.legacy_result?.status ? "graded" : workspace?.submission.state || "none";
  const info = homeworkWorkspaceStates[state];
  const file = workspace?.submission.draft_file || workspace?.submission.current_file;
  const uploadLimits = homeworkWorkspaceLimits(workspace?.limits);
  const uploadAllowed = Boolean(workspace?.permissions.upload && uploadLimits && !processing && !action);
  const submitAllowed = Boolean(workspace?.permissions.submit && !processing && !action);
  const choose = (selected?: File) => {
    if (!selected || !uploadAllowed || !uploadLimits) return;
    if ((!selected.name.toLowerCase().endsWith(".pdf") && selected.type !== "application/pdf") || (selected.type && selected.type !== "application/pdf") || selected.size > uploadLimits.max_source_bytes || selected.size === 0) {
      setError(`Выберите PDF до ${homeworkMiB(uploadLimits.max_source_bytes)} МиБ. Файл не должен быть пустым.`); return;
    }
    try { enqueue(homeworkId, selected); setError(null); setNotice(null); setConfirmRemove(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось добавить файл"); }
    if (input.current) input.current.value = "";
  };
  const run = async (name: string, operation: () => Promise<unknown>, message?: string) => {
    if (action) return;
    setAction(name); setError(null);
    try { await operation(); if (message) setNotice(message); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось выполнить действие"); }
    finally { setAction(null); }
  };
  const submit = () => run("submit", async () => { await homeworkFilesApi.submit(homeworkId); await deleteScannerProject(homeworkId, user?.id).catch(() => undefined); }, "Работа отправлена на проверку");
  const download = () => run("download", async () => {
    if (!workspace?.submission.id) return;
    const result = await homeworkFilesApi.fileUrl(workspace.submission.id, workspace.submission.has_draft, true);
    const link = document.createElement("a"); link.href = result.url; link.target = "_blank"; link.rel = "noreferrer"; link.click();
  });

  const covered = scanner || (preview && Boolean(pdfUrl)) || legend || attachmentPicker;
  const grade = state === "graded" ? workspace?.legacy_result?.result : null;
  const pages = file?.page_count;
  const pagesLabel = pages == null ? "PDF" : `${pages} ${pages % 10 === 1 && pages % 100 !== 11 ? "страница" : pages % 10 >= 2 && pages % 10 <= 4 && (pages % 100 < 12 || pages % 100 > 14) ? "страницы" : "страниц"}`;
  return <div className={presentation === "page" ? styles.pageBackdrop : styles.backdrop}>
    <div ref={dialog} tabIndex={-1} className={`${styles.workspace} ${presentation === "page" ? styles.pageWorkspace : ""}`} role={presentation === "page" ? "region" : "dialog"} aria-modal={presentation === "modal" ? true : undefined} aria-labelledby="homework-title" aria-hidden={covered || undefined} inert={covered} data-covered={covered}>
      <header className={styles.header}><button type="button" className={styles.roundBack} onClick={onClose} aria-label="К домашним заданиям"><ArrowLeft size={23}/>{presentation === "page" ? <span>Домашние задания</span> : null}</button></header>
      <div className={styles.scroll}>
        {loading ? <div className={styles.loading}><Spinner/><p>Открываем работу…</p></div> : <div className={styles.content}>
          <div className={styles.workIntro}><div className={styles.eyebrow}><Clock3 size={15}/>Срок сдачи: {date(workspace?.homework.deadline)}</div>
          <h1 id="homework-title" className={styles.workTitle}>{workspace?.homework.name || "Домашняя работа"}</h1>
          {workspace ? <div className={styles.statusLine}><span className={styles.badge} data-state={state}><HomeworkStatusSymbol state={state}/>{info.label}{grade != null ? <strong className={styles.inlineScore}>{grade}<small>/ 100</small></strong> : null}</span><button type="button" className={styles.infoButton} aria-label="Что означают статусы" onClick={() => setLegend(true)}><Info size={19}/></button></div> : null}
          </div><div className={styles.workBody}>
          {notice ? <div className={styles.success} role="status"><CheckCircle2 size={20}/>{notice}</div> : null}
          {error ? <div className={styles.error} role="alert"><AlertCircle size={20}/><div>{error}{!workspace ? <button type="button" onClick={() => void load(true)}>Попробовать снова</button> : null}</div></div> : null}
          {workspace?.submission.revision_comment ? <div className={styles.revision}><span>Комментарий проверяющего</span><p>{workspace.submission.revision_comment}</p></div> : null}
          {pdfUrl ? <button type="button" className={styles.fileSummary} onClick={() => setPreview(true)} aria-label={workspace?.submission.has_draft ? "Открыть черновик домашней работы" : "Открыть отправленную домашнюю работу"}><span className={styles.fileArtwork}><FileText size={26}/></span><span><strong>{workspace?.submission.has_draft ? "Черновик домашней работы" : "Отправленная домашняя работа"}</strong><small>{pagesLabel}{file ? ` · ${homeworkFileSize(file.size_bytes)}` : ""}</small></span><ChevronRight size={21}/></button>
          : workspace?.submission.has_file || workspace?.submission.has_draft ? <div className={styles.noFile}><FileText size={24}/><span>Не удалось открыть файл.</span><button type="button" onClick={() => { setError(null); void refreshFile().catch(() => setError("Не удалось открыть PDF")); }}>Повторить</button></div>
          : workspace && !processing ? state === "graded" ? <div className={styles.noFile}><FileText size={24}/><span>Работа проверена без прикреплённого PDF.</span></div> : <section className={styles.addWorkArea} data-dragging={dragging} onDragOver={event => { event.preventDefault(); if (uploadAllowed) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]); }}>
            <button type="button" className={styles.addWork} disabled={!uploadAllowed} onClick={() => setAttachmentPicker(true)}><span className={styles.digitalArtwork} aria-hidden="true"><svg viewBox="0 0 640 360" fill="none"><g stroke="currentColor" strokeWidth="1.5"><rect x="45" y="66" width="38" height="48" rx="9" transform="rotate(-14 45 66)"/><path d="m56 82 14-3m-12 10 14-3M528 64h26v26h-26zM514 78h26v26h-26zM71 267v20m-10-10h20M565 249v20m-10-10h20"/><rect x="521" y="288" width="35" height="35" rx="9" transform="rotate(18 521 288)"/><path d="M116 40h22m-11-11v22M582 156l9 9-9 9-9-9zM36 189l6 6-6 6-6-6z"/></g><g fill="currentColor"><circle cx="104" cy="219" r="4"/><circle cx="488" cy="42" r="3"/><circle cx="586" cy="305" r="3"/><circle cx="160" cy="310" r="3"/></g></svg></span><span className={styles.addArtwork}><StudentNavIcon kind="homework"/></span><strong>Добавить свою работу</strong><span>PDF или сканы страниц</span><small className={styles.desktopDropHint}>Перетащите файл сюда или нажмите, чтобы выбрать</small></button>
            <p className={styles.uploadLimits}>{uploadLimits ? `PDF до ${homeworkMiB(uploadLimits.max_source_bytes)} МиБ · до ${uploadLimits.max_pages} страниц` : "Загрузка недоступна: не удалось получить лимиты файла."}</p>
          </section> : null}
          {processing ? <div className={styles.processingCard} role="status"><Spinner size="sm"/><strong>{info.label}</strong><progress max={100} value={activeJob?.progress || 0}/><span>{activeJob?.progress || 0}%</span><button type="button" disabled={Boolean(action)} onClick={() => void run("cancel", () => cancel(activeJob!.id))}>Отменить загрузку</button></div> : null}
          {job?.status === "failed" ? <div className={styles.error} role="alert"><AlertCircle size={20}/><div><strong>PDF не готов</strong><p>{homeworkErrorMessage(job.error_code, job.limits)}</p><div className={styles.inlineActions}>{!job.transferFailed || job.file ? <button type="button" disabled={Boolean(action)} onClick={() => void run("retry", () => retry(job.id))}>Повторить</button> : <button type="button" disabled={Boolean(action)} onClick={() => void run("cancel", () => cancel(job.id))}>Сбросить загрузку</button>}</div></div></div> : null}
          {pdfUrl && workspace?.permissions.upload ? <div className={styles.fileActions}><button type="button" disabled={!uploadAllowed} onClick={() => setAttachmentPicker(true)}><FileUp size={17}/>Заменить файл</button>{workspace.permissions.remove_draft ? <button className={styles.remove} type="button" disabled={!uploadAllowed} onClick={() => setConfirmRemove(true)}><Trash2 size={17}/>Удалить черновик</button> : null}</div> : null}
          {confirmRemove ? <div className={styles.confirm}><p>Удалить этот черновик? {workspace?.submission.has_file ? "Отправленная версия останется." : "После этого можно выбрать другой PDF."}</p><button type="button" disabled={Boolean(action)} onClick={() => void run("remove", async () => { await homeworkFilesApi.removeDraft(homeworkId); setConfirmRemove(false); })}>Удалить</button><button type="button" onClick={() => setConfirmRemove(false)}>Оставить</button></div> : null}
        </div></div>}
      </div>
      {!loading && workspace?.permissions.submit ? <footer className={styles.footer}><button className={styles.primary} type="button" disabled={!submitAllowed} onClick={() => void submit()}>{action === "submit" ? <Spinner size="sm"/> : <Send size={18}/>} {workspace.submission.has_file ? "Отправить исправления" : "Отправить на проверку"}</button></footer> : null}
    </div>
    <input ref={input} hidden type="file" accept="application/pdf,.pdf" onChange={event => choose(event.target.files?.[0])}/>
    {preview && pdfUrl ? <HomeworkFileScreen url={pdfUrl} onClose={() => setPreview(false)} onDownload={() => void download()} downloading={Boolean(action)} onRefresh={() => void refreshFile().catch(() => setError("Не удалось обновить PDF"))}/> : null}
    {legend ? <HomeworkStatusLegend onClose={() => setLegend(false)}/> : null}
    {attachmentPicker ? <HomeworkAttachmentPicker onClose={() => setAttachmentPicker(false)} onScan={() => { if (uploadAllowed) { setAttachmentPicker(false); setScanner(true); } }} onFile={() => { if (uploadAllowed) { setAttachmentPicker(false); input.current?.click(); } }}/> : null}
    {scanner ? <ScannerModal homeworkId={homeworkId} limits={workspace?.limits} onClose={() => setScanner(false)}/> : null}
  </div>;
}
