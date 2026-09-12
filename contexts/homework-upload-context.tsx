"use client";

import { Spinner } from "@/components/ui/spinner";
import { homeworkErrorMessage, homeworkFilesApi, postFileToS3 } from "@/lib/homework-files/api";
import type { UploadJob } from "@/lib/homework-files/types";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, CheckCircle2, ChevronRight, CloudUpload, FileText, RotateCw, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useHomeworkDialog } from "@/lib/homework-files/use-dialog";
import styles from "@/components/homework/upload-center.module.css";

export interface QueuedUpload extends UploadJob { file?: File; clientId?: string; transferFailed?: boolean; filename?: string; serverStatus?: string }
interface UploadContextValue { jobs: QueuedUpload[]; enqueue: (homeworkId: number, file: File) => void; cancel: (id: string) => Promise<void>; retry: (id: string) => Promise<void>; dismiss: (id: string) => void }
const Context = createContext<UploadContextValue | null>(null);
const active = (job: UploadJob) => ["local", "uploading", "queued", "running", "retry"].includes(job.status);

export function HomeworkUploadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <UploadProvider key={`${user?.role}:${user?.id}`} enabled={user?.role === "student"}>{children}</UploadProvider>;
}

function UploadProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [jobs, setJobs] = useState<QueuedUpload[]>([]);
  const ref = useRef<QueuedUpload[]>([]);
  const transfer = useRef<{ id: string; controller: AbortController } | null>(null);
  const mounted = useRef(true);
  const polling = useRef(false);
  const [pollSeconds, setPollSeconds] = useState(10);
  const update = useCallback((change: (items: QueuedUpload[]) => QueuedUpload[]) => {
    if (!mounted.current) return;
    ref.current = change(ref.current); setJobs(ref.current);
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; transfer.current?.controller.abort(); }; }, []);

  const refresh = useCallback(async () => {
    if (!enabled || polling.current || document.visibilityState === "hidden") return;
    polling.current = true;
    try {
      const response = await homeworkFilesApi.jobs();
      setPollSeconds(Math.max(10, response.poll_after_seconds || 10));
      const activeIds = new Set(response.items.map(job => job.id));
      const tracked = ref.current.filter(job => !job.id.startsWith("local-") && (active(job) || job.serverStatus === "uploading") && job.id !== transfer.current?.id && !activeIds.has(job.id));
      const terminal = await Promise.all(tracked.map(job => homeworkFilesApi.job(job.id).catch(() => job)));
      update(items => {
        const map = new Map(items.map(job => [job.id, job]));
        for (const incoming of [...response.items, ...terminal]) {
          const previous = map.get(incoming.id);
          if (incoming.id === transfer.current?.id) continue;
          // An interrupted transfer cannot continue without a File from this browser session.
          if (incoming.status === "uploading" && !previous?.file) {
            map.set(incoming.id, { ...previous, ...incoming, status: "failed", serverStatus: "uploading", transferFailed: true, error_code: "Загрузка началась в другой вкладке или прервалась. Можно дождаться её или отменить и выбрать файл снова." });
          } else if (previous?.transferFailed && incoming.status === "uploading") {
            map.set(incoming.id, { ...previous, serverStatus: incoming.status });
          } else {
            map.set(incoming.id, { ...previous, ...incoming, serverStatus: incoming.status, file: incoming.status === "ready" ? undefined : previous?.file, transferFailed: false });
          }
        }
        return [...map.values()];
      });
    } catch { /* Keep local progress during a temporary network interruption. */ }
    finally { polling.current = false; }
  }, [enabled, update]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const focus = () => { void refresh(); };
    window.addEventListener("focus", focus); document.addEventListener("visibilitychange", focus);
    return () => { window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, [enabled, refresh]);
  const needsPolling = jobs.some(job => (active(job) || job.serverStatus === "uploading") && !job.id.startsWith("local-"));
  useEffect(() => {
    if (!needsPolling) return;
    const timer = window.setInterval(() => void refresh(), pollSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [needsPolling, pollSeconds, refresh]);

  useEffect(() => {
    if (!enabled || transfer.current) return;
    const next = ref.current.find(job => job.status === "local" && job.file && job.clientId);
    if (!next) return;
    const controller = new AbortController();
    const current = { id: next.id, controller };
    transfer.current = current;
    update(items => items.map(job => job.id === next.id ? { ...job, status: "uploading", stage: "uploading", progress: 0, error_code: null } : job));
    const run = async () => {
      try {
        const initialization = await homeworkFilesApi.createUpload(next.homework_id!, next.clientId!);
        if (controller.signal.aborted) { await homeworkFilesApi.cancel(initialization.job.id).catch(() => undefined); return; }
        current.id = initialization.job.id;
        update(items => [...items.filter(job => job.id !== next.id && job.id !== current.id), { ...next, ...initialization.job, serverStatus: initialization.job.status, filename: next.file?.name, id: current.id }]);
        if (initialization.upload) {
          await postFileToS3(initialization, next.file!, progress => update(items => items.map(job => job.id === current.id ? { ...job, progress } : job)), controller.signal);
          const complete = await homeworkFilesApi.completeUpload(current.id);
          if (!controller.signal.aborted) update(items => items.map(job => job.id === current.id ? { ...job, ...complete, serverStatus: complete.status, file: undefined, transferFailed: false } : job));
        } else update(items => items.map(job => job.id === current.id ? { ...job, ...initialization.job, serverStatus: initialization.job.status, file: undefined, transferFailed: false } : job));
      } catch (error) {
        if (!controller.signal.aborted) update(items => items.map(job => job.id === current.id ? { ...job, status: "failed", stage: "failed", transferFailed: true, error_code: error instanceof Error ? error.message : "upload_failed" } : job));
      } finally {
        if (controller.signal.aborted && !current.id.startsWith("local-")) await homeworkFilesApi.cancel(current.id).catch(() => undefined);
        transfer.current = null;
        update(items => [...items]);
      }
    };
    void run();
  }, [enabled, jobs, update]);

  const enqueue = useCallback((homeworkId: number, file: File) => {
    if (ref.current.some(job => job.homework_id === homeworkId && active(job))) throw new Error("Для этой работы уже загружается PDF");
    const id = crypto.randomUUID();
    update(items => [...items.filter(job => !(job.homework_id === homeworkId && job.status === "failed" && job.id.startsWith("local-"))), { id: `local-${id}`, clientId: id, homework_id: homeworkId, filename: file.name, file, status: "local", stage: "queue", progress: 0 }]);
  }, [update]);
  const cancel = useCallback(async (id: string) => {
    if (transfer.current?.id === id) transfer.current.controller.abort();
    if (!id.startsWith("local-")) {
      try { await homeworkFilesApi.cancel(id); }
      catch (reason) {
        const latest = await homeworkFilesApi.job(id).catch(() => null);
        if (!latest || !["ready", "failed", "cancelled"].includes(latest.status)) throw reason;
      }
    }
    update(items => items.filter(job => job.id !== id));
  }, [update]);
  const retry = useCallback(async (id: string) => {
    const job = ref.current.find(item => item.id === id);
    if (job?.file && job.clientId) {
      update(items => items.map(item => item.id === id ? { ...item, status: "local", stage: "queue", error_code: null, transferFailed: false } : item));
    } else {
      const next = await homeworkFilesApi.retry(id);
      update(items => items.map(item => item.id === id ? { ...item, ...next } : item));
    }
  }, [update]);
  const dismiss = useCallback((id: string) => update(items => items.filter(job => job.id !== id)), [update]);
  return <Context.Provider value={{ jobs, enqueue, cancel, retry, dismiss }}>{children}{enabled ? <UploadCenter jobs={jobs} cancel={cancel} retry={retry} dismiss={dismiss} /> : null}</Context.Provider>;
}

function UploadCenter({ jobs, cancel, retry, dismiss }: Omit<UploadContextValue, "enqueue">) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const dialog = useRef<HTMLElement>(null);
  const router = useRouter();
  const visible = jobs.filter(job => job.status !== "cancelled");
  useHomeworkDialog(dialog, () => setOpen(false), open && visible.length > 0);
  if (!visible.length) return null;
  const running = visible.filter(active).length;
  const failed = visible.filter(job => job.status === "failed").length;
  const labels: Record<string, string> = { queue: "Ожидает загрузки", uploading: "Загружается", queued: "Ожидает обработки", checking: "Проверяем PDF", optimizing: "Обрабатываем PDF", saving: "Сохраняем", ready: "Готов к отправке", failed: "Не удалось загрузить" };
  const action = async (id: string, fn: () => Promise<void>) => { setBusy(id); setError(null); try { await fn(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось выполнить действие"); } finally { setBusy(null); } };
  const openWork = (job: QueuedUpload) => {
    setOpen(false);
    if (job.homework_id) router.push(`/cabinet/student/homework?work=${job.homework_id}`);
  };
  return <>
    <button type="button" className={styles.launcher} onClick={() => setOpen(true)} aria-label="Открыть загрузки"><CloudUpload size={20} /><span>{running ? `Загрузка · ${running}` : failed ? `Ошибка загрузки · ${failed}` : "PDF готов"}</span></button>
    {open ? <div className={styles.backdrop} onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}><section className={styles.center} ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Загрузки домашних работ">
      <header><div><h2>Загрузки</h2><p>Готовый PDF нужно отправить на проверку.</p></div><button type="button" className={styles.iconButton} onClick={() => setOpen(false)} aria-label="Закрыть загрузки"><X /></button></header>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <div className={styles.list}>{visible.map(job => <article className={styles.item} key={job.id} data-state={job.status}>
        <div className={styles.fileIcon}>{job.status === "ready" ? <CheckCircle2 /> : job.status === "failed" ? <AlertTriangle /> : <FileText />}</div>
        <div className={styles.itemMain}><strong>{job.filename || `Домашняя работа №${job.homework_id}`}</strong><span>{labels[job.stage] || "Обрабатываем"}{active(job) ? ` · ${job.progress}%` : ""}</span>{active(job) ? <progress max={100} value={job.progress} aria-label="Прогресс загрузки" /> : null}{job.status === "failed" ? <p role="alert">{homeworkErrorMessage(job.error_code)}</p> : null}</div>
        <div className={styles.actions}>{job.status === "ready" ? <><button type="button" onClick={() => openWork(job)}>Открыть работу<ChevronRight size={16} /></button><button className={styles.iconButton} type="button" onClick={() => dismiss(job.id)} aria-label="Скрыть завершённую загрузку"><X size={16} /></button></> : job.status === "failed" ? <>{(!job.transferFailed || job.file) ? <button type="button" disabled={busy === job.id} onClick={() => void action(job.id, () => retry(job.id))}><RotateCw size={16} />Повторить</button> : null}<button type="button" disabled={busy === job.id} onClick={() => void action(job.id, async () => { if (job.transferFailed && !job.id.startsWith("local-")) await cancel(job.id); else dismiss(job.id); openWork(job); })}>Выбрать другой</button></> : <button type="button" disabled={busy === job.id} onClick={() => void action(job.id, () => cancel(job.id))}>{busy === job.id ? <Spinner size="sm" /> : null}Отменить</button>}</div>
      </article>)}</div><footer>Окно работы можно закрыть. До завершения передачи файла оставьте вкладку открытой.</footer>
    </section></div> : null}
  </>;
}

export function useHomeworkUploads() { const value = useContext(Context); if (!value) throw new Error("HomeworkUploadProvider is missing"); return value; }
