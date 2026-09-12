"use client";

import { useHomeworkUploads } from "@/contexts/homework-upload-context";
import { useAuth } from "@/contexts/AuthContext";
import { deleteScannerProject } from "@/lib/homework-scanner/project-store";
import { homeworkErrorMessage, homeworkFilesApi } from "@/lib/homework-files/api";
import type { HomeworkWorkspace, SubmissionState } from "@/lib/homework-files/types";
import { useHomeworkDialog } from "@/lib/homework-files/use-dialog";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, ArrowLeft, Check, CheckCircle2, ChevronDown, Clock3, Download, FileText, FileUp, RefreshCw, ScanLine, Send, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScannerModal } from "./scanner-modal";
import { HomeworkPdfViewer } from "./homework-pdf-viewer";
import styles from "./homework-workspace.module.css";

const states: Record<SubmissionState, { label: string; description: string }> = {
  none: { label: "Можно приступать", description: "Прикрепите готовый PDF или соберите работу из фотографий." },
  uploading: { label: "Загружаем файл", description: "Оставьте вкладку открытой до завершения передачи." },
  processing: { label: "Готовим PDF", description: "Проверяем страницы и сохраняем файл. Окно работы можно закрыть." },
  draft: { label: "Готово к отправке", description: "Проверьте, что все страницы на месте, и отправьте работу на проверку." },
  submitted: { label: "Отправлено", description: "Работа в очереди. Когда проверяющий возьмёт её, статус изменится." },
  in_review: { label: "На проверке", description: "Проверяющий изучает вашу работу. Результат появится здесь." },
  revision_requested: { label: "Нужны исправления", description: "Прочитайте комментарий, подготовьте исправленный PDF и отправьте его снова." },
  graded: { label: "Проверено", description: "Проверка завершена. Работу можно открыть и скачать." },
};
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" }) : "Без срока";
const busyJob = (status?: string) => Boolean(status && ["local", "uploading", "queued", "running", "retry"].includes(status));
const workspaceFileKey = (data: HomeworkWorkspace) => `${data.submission.id}:${data.submission.draft_file?.id || data.submission.has_draft}:${data.submission.current_file?.id || data.submission.has_file}`;

export function HomeworkWorkspaceModal({ homeworkId, onClose }: { homeworkId: number; onClose: () => void }) {
  const { user } = useAuth();
  const { enqueue, jobs, cancel, retry } = useHomeworkUploads();
  const [workspace, setWorkspace] = useState<HomeworkWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState("Домашняя работа.pdf");
  const [urlLifetime, setUrlLifetime] = useState(300);
  const [scanner, setScanner] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [preview, setPreview] = useState(true);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const fileKey = useRef("");
  const alive = useRef(true);
  const latestWorkspace = useRef<HomeworkWorkspace | null>(null);
  const fetchSequence = useRef(0);
  const fileSequence = useRef(0);
  useHomeworkDialog(dialog, onClose);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const refreshFile = useCallback(async (data = latestWorkspace.current) => {
    const sequence = ++fileSequence.current;
    if (!data?.submission.id || !(data.submission.has_draft || data.submission.has_file)) { setPdfUrl(null); fileKey.current = data ? workspaceFileKey(data) : ""; return; }
    const key = workspaceFileKey(data);
    const result = await homeworkFilesApi.fileUrl(data.submission.id, data.submission.has_draft);
    if (!alive.current || sequence !== fileSequence.current || !latestWorkspace.current || workspaceFileKey(latestWorkspace.current) !== key) return;
    fileKey.current = key;
    setPdfUrl(result.url); setFilename(result.filename || "Домашняя работа.pdf");
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
  const info = states[state];
  const file = workspace?.submission.draft_file || workspace?.submission.current_file;
  const maxBytes = workspace?.limits?.max_bytes || 10 * 1024 * 1024;
  const maxPages = workspace?.limits?.max_pages || 35;
  const uploadAllowed = Boolean(workspace?.permissions.upload && !processing && !action);
  const submitAllowed = Boolean(workspace?.permissions.submit && !processing && !action);
  const step = ["none", "uploading", "processing"].includes(state) ? 0 : ["draft", "revision_requested"].includes(state) ? 1 : 2;
  const choose = (selected?: File) => {
    if (!selected || !uploadAllowed) return;
    if ((!selected.name.toLowerCase().endsWith(".pdf") && selected.type !== "application/pdf") || (selected.type && selected.type !== "application/pdf") || selected.size > maxBytes || selected.size === 0) {
      setError(`Выберите PDF до ${Math.round(maxBytes / 1024 / 1024)} МБ. Файл не должен быть пустым.`); return;
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

  return <div className={styles.backdrop}>
    <div ref={dialog} tabIndex={-1} className={styles.workspace} role="dialog" aria-modal="true" aria-labelledby="homework-title">
      <header className={styles.header}><button type="button" className={styles.back} onClick={onClose}><ArrowLeft size={20} /><span>Все задания</span></button><span className={styles.headerHint}>Домашняя работа</span><button type="button" className={styles.iconButton} aria-label="Обновить работу" disabled={Boolean(action)} onClick={() => void load()}><RefreshCw size={18} /></button></header>
      <div className={styles.scroll}>
        {loading ? <div className={styles.loading}><Spinner /><p>Открываем работу…</p></div> : <>
          <div className={styles.intro}><div><div className={styles.eyebrow}><Clock3 size={14} />Срок сдачи: {date(workspace?.homework.deadline)}</div><h1 id="homework-title">{workspace?.homework.name || "Домашняя работа"}</h1></div><span className={styles.badge} data-state={state}>{state === "graded" ? <CheckCircle2 size={16} /> : null}{info.label}</span></div>
          <ol className={styles.steps}>{["Подготовить PDF", "Отправить работу", "Получить результат"].map((label, index) => <li key={label} data-current={step === index} data-done={step > index}><span>{step > index ? <Check size={13} /> : index + 1}</span>{label}</li>)}</ol>
          {notice ? <div className={styles.success} role="status"><CheckCircle2 size={20} />{notice}</div> : null}
          {error ? <div className={styles.error} role="alert"><AlertCircle size={20} /><div>{error}{!workspace ? <button type="button" onClick={() => void load(true)}>Попробовать снова</button> : null}</div></div> : null}
          <div className={styles.layout}>
            <div className={styles.main}>
              {workspace?.submission.revision_comment ? <div className={styles.revision}><span>Комментарий проверяющего</span><p>{workspace.submission.revision_comment}</p><small>Исправьте замечания и загрузите новый PDF целиком.</small></div> : null}
              {pdfUrl ? <section className={styles.fileCard}><div className={styles.fileHeader}><FileText size={24} /><div><strong>{file?.filename || filename}</strong><span>{file ? `${file.page_count} стр. · ${(file.size_bytes / 1024 / 1024).toFixed(1)} МБ` : "PDF"}{workspace?.submission.has_draft ? " · Черновик" : " · Отправленная работа"}</span></div><button type="button" className={styles.iconButton} aria-label="Скачать PDF" onClick={() => void download()} disabled={Boolean(action)}><Download size={18} /></button></div><button type="button" className={styles.previewToggle} aria-expanded={preview} onClick={() => setPreview(value => !value)}>{preview ? "Свернуть просмотр" : "Посмотреть страницы"}<ChevronDown size={16} data-open={preview} /></button>{preview ? <HomeworkPdfViewer url={pdfUrl} filename={filename} onRefresh={() => void refreshFile().catch(() => setError("Не удалось обновить PDF"))} /> : null}</section> : <section className={styles.dropzone} data-dragging={dragging} onDragOver={event => { event.preventDefault(); if (uploadAllowed) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]); }}>
                <div className={styles.uploadIcon}><FileUp size={32} /></div><h2>{processing ? "Файл уже в пути" : state === "graded" ? "Работа зачтена без PDF" : "Добавьте свою работу"}</h2><p>{processing ? "Как только PDF будет готов, здесь появятся его страницы." : state === "graded" ? "Результат внесён проверяющим в журнал. Прикреплённого файла у этой сдачи нет." : "Готовый PDF с компьютера или телефона — либо фотографии страниц через сканер."}</p><span>PDF до {Math.round(maxBytes / 1024 / 1024)} МБ · не больше {maxPages} страниц</span>{uploadAllowed ? <div className={styles.desktopUpload}><button type="button" className={styles.primary} onClick={() => input.current?.click()}><FileUp size={18} />Выбрать PDF</button><button type="button" className={styles.secondary} onClick={() => setScanner(true)}><ScanLine size={18} />Сканировать</button></div> : null}
              </section>}
            </div>
            <aside className={styles.aside}>
              <section className={styles.statusCard}><span className={styles.sectionLabel}>Сейчас</span><h2>{info.label}</h2><p>{info.description}</p>{workspace?.submission.reviewer?.full_name ? <p className={styles.reviewer}>Проверяет: <strong>{workspace.submission.reviewer.full_name}</strong></p> : null}{workspace?.submission.submitted_at_utc ? <small>Отправлено {date(workspace.submission.submitted_at_utc)}</small> : null}{state === "graded" && workspace?.legacy_result ? <div className={styles.score}><strong>{workspace.legacy_result.result}</strong><span>из 100 баллов</span></div> : null}{processing ? <div className={styles.progress}><progress max={100} value={activeJob?.progress || 0} /><span>{activeJob?.progress || 0}%</span><button type="button" disabled={Boolean(action)} onClick={() => void run("cancel", () => cancel(activeJob!.id))}>Отменить загрузку</button></div> : null}</section>
              {job?.status === "failed" ? <div className={styles.error} role="alert"><AlertCircle size={20} /><div><strong>PDF не готов</strong><p>{homeworkErrorMessage(job.error_code)}</p><div className={styles.inlineActions}>{!job.transferFailed || job.file ? <button type="button" disabled={Boolean(action)} onClick={() => void run("retry", () => retry(job.id))}>Повторить</button> : <button type="button" disabled={Boolean(action)} onClick={() => void run("cancel", () => cancel(job.id))}>Сбросить загрузку</button>}</div></div></div> : null}
              {pdfUrl && workspace?.permissions.upload ? <section className={styles.editCard}><span className={styles.sectionLabel}>{workspace.submission.has_draft ? "Изменить черновик" : "Подготовить исправления"}</span><button type="button" disabled={!uploadAllowed} onClick={() => input.current?.click()}><FileUp size={18} />Заменить PDF</button><button type="button" disabled={!uploadAllowed} onClick={() => setScanner(true)}><ScanLine size={18} />Открыть сканер</button>{workspace.permissions.remove_draft ? <button className={styles.remove} type="button" disabled={!uploadAllowed} onClick={() => setConfirmRemove(true)}><Trash2 size={17} />Удалить черновик</button> : null}{confirmRemove ? <div className={styles.confirm}><p>Удалить этот черновик? {workspace.submission.has_file ? "Отправленная версия останется." : "После этого можно выбрать другой PDF."}</p><button type="button" disabled={Boolean(action)} onClick={() => void run("remove", async () => { await homeworkFilesApi.removeDraft(homeworkId); setConfirmRemove(false); })}>Удалить</button><button type="button" onClick={() => setConfirmRemove(false)}>Оставить</button></div> : null}</section> : null}
              <div className={styles.help}><ShieldCheck size={18} /><p>Прикрепление сохраняет черновик. Проверяющий увидит файл только после отправки.</p></div>
            </aside>
          </div>
        </>}
      </div>
      {!loading && workspace ? <footer className={styles.footer}><p>{processing ? "Готовим файл…" : submitAllowed ? "Проверьте все страницы перед отправкой" : states[state].label}</p><div>{workspace.permissions.submit ? <button className={styles.primary} type="button" disabled={!submitAllowed} onClick={() => void submit()}>{action === "submit" ? <Spinner size="sm" /> : <Send size={18} />}{workspace.submission.has_file ? "Отправить исправления" : "Отправить на проверку"}</button> : uploadAllowed ? <><button type="button" className={styles.secondary} onClick={() => setScanner(true)}><ScanLine size={18} /><span>Сканировать</span></button><button type="button" className={styles.primary} onClick={() => input.current?.click()}><FileUp size={18} /><span>{pdfUrl ? "Заменить PDF" : "Выбрать PDF"}</span></button></> : <button type="button" className={styles.secondary} onClick={onClose}>К заданиям</button>}</div></footer> : null}
      <input ref={input} hidden type="file" accept="application/pdf,.pdf" onChange={event => choose(event.target.files?.[0])} />
    </div>
    {scanner ? <ScannerModal homeworkId={homeworkId} onClose={() => setScanner(false)} /> : null}
  </div>;
}
