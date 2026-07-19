"use client";

import { Spinner } from "@/components/ui/spinner";
import { homeworkFilesApi, uploadHomeworkFile } from "@/lib/homework-files/api";
import { getHomeworkRealtimeSocket } from "@/lib/homework-files/realtime";
import type { UploadJob } from "@/lib/homework-files/types";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, CheckCircle2, ChevronRight, CloudUpload, FileText, RotateCw, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "@/components/homework/upload-center.module.css";

interface QueuedUpload extends UploadJob { file?: File; clientId?: string }
interface UploadContextValue { jobs: QueuedUpload[]; enqueue: (homeworkId: number, file: File) => void; cancel: (id: string) => Promise<void>; retry: (id: string) => Promise<void> }
const Context = createContext<UploadContextValue | null>(null);

export function HomeworkUploadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<QueuedUpload[]>([]);
  const running = useRef(false);
  const uploadControllers = useRef(new Map<string, AbortController>());
  const upsertJob = useCallback((incoming: UploadJob) => setJobs((items) => {
    const index=items.findIndex((item)=>item.id===incoming.id);
    if(index<0)return[...items,incoming];
    return items.map((item)=>item.id===incoming.id?{...item,...incoming}:item);
  }),[]);
  const pump = useCallback(async () => {
    if(user?.role!=="student")return;
    if (running.current) return;
    const next = jobs.find((item) => item.status === "local" && item.file && item.clientId);
    if (!next) return;
    running.current = true;
    try {
      setJobs((items) => items.map((item) => item.id === next.id ? { ...item, status: "uploading", stage: "upload", progress: 1 } : item));
      try {
        const controller = new AbortController();
        uploadControllers.current.set(next.id, controller);
        const server = await uploadHomeworkFile(next.homework_id!, next.file!, next.clientId!, (progress) => setJobs((items) => items.map((item) => item.id === next.id ? { ...item, progress } : item)), controller.signal);
        uploadControllers.current.delete(next.id);
        setJobs((items) => {
          const replaced=items.map((item) => item.id === next.id ? { ...item, ...server, homework_id:server.homework_id??next.homework_id, file: undefined } : item);
          const byId=new Map<string,QueuedUpload>();replaced.forEach((item)=>byId.set(item.id,{...byId.get(item.id),...item}));return[...byId.values()];
        });
      } catch (error) {
        uploadControllers.current.delete(next.id);
        setJobs((items) => items.map((item) => item.id === next.id ? { ...item, status: "failed", stage: "error", error_code: error instanceof Error ? error.message : "upload_failed" } : item));
      }
    } finally {
      running.current = false;
      setJobs((items) => [...items]);
    }
  }, [jobs,user?.role]);
  useEffect(() => { void pump(); }, [jobs, pump]);
  useEffect(() => {
    if(user?.role!=="student")return;
    let stopped=false;let connectedOnce=false;const socket=getHomeworkRealtimeSocket();
    const load=()=>homeworkFilesApi.jobs().then(({items})=>{if(!stopped)setJobs(items)}).catch(()=>undefined);
    const connected=()=>{if(connectedOnce)void load();connectedOnce=true;};
    const progress=(payload:{job?:UploadJob})=>{if(payload.job)upsertJob(payload.job);};
    void load();
    if(socket){connectedOnce=socket.connected;socket.on("connect",connected);socket.on("job.progress",progress);if(!socket.connected)socket.connect();}
    return()=>{stopped=true;socket?.off("connect",connected);socket?.off("job.progress",progress);};
  },[upsertJob,user?.role]);
  const enqueue = useCallback((homeworkId: number, file: File) => {
    const id = crypto.randomUUID();
    setJobs((items) => [...items, { id: `local-${id}`, clientId: id, homework_id: homeworkId, file, status: "local", stage: "queue", progress: 0 }]);
  }, []);
  const cancel = useCallback(async (id: string) => {
    if (id.startsWith("local-")) {
      uploadControllers.current.get(id)?.abort();
      uploadControllers.current.delete(id);
      setJobs((items) => items.filter((job) => job.id !== id));
      return;
    }
    await homeworkFilesApi.cancel(id);
    setJobs((items) => items.map((job) => job.id === id ? { ...job, status: "cancelled" } : job));
  }, []);
  const retry = useCallback(async (id: string) => {
    await homeworkFilesApi.retry(id);
    setJobs((items)=>items.map((job)=>job.id===id?{...job,status:"queued",stage:"checking",progress:5,error_code:null}:job));
  }, []);
  return <Context.Provider value={{ jobs, enqueue, cancel, retry }}>{children}{user?.role==="student"?<UploadCenter jobs={jobs} cancel={cancel} retry={retry} />:null}</Context.Provider>;
}

function UploadCenter({ jobs, cancel, retry }: { jobs: QueuedUpload[]; cancel: (id: string) => Promise<void>; retry: (id: string) => Promise<void> }) {
  const storageKey = "cpm-homework-upload-seen-ready";
  const [seenReady, setSeenReady] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[]); } catch { return new Set(); }
  });
  const visible = jobs.filter((job) => job.status !== "cancelled" && !(job.status === "ready" && seenReady.has(job.id))).slice(-8);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const hadJobs = useRef(false);
  useEffect(() => {
    if (visible.length && !hadJobs.current) setOpen(true);
    hadJobs.current = Boolean(visible.length);
  }, [visible.length]);
  if (!visible.length) return null;
  const labels: Record<string, string> = { queue: "В очереди", upload: "Загружается", checking: "Проверка", optimization: "Оптимизация", s3: "Сохранение", ready: "Готово", error: "Ошибка" };
  const active = visible.filter((job) => !["ready", "failed"].includes(job.status));
  const complete = visible.filter((job) => job.status === "ready");
  const failed = visible.filter((job) => job.status === "failed");
  const dismissReady = (ids: string[]) => {
    if (!ids.length) return;
    setSeenReady((current) => {
      const next = new Set([...current, ...ids]);
      const compact = [...next].slice(-200);
      try { localStorage.setItem(storageKey, JSON.stringify(compact)); } catch { /* storage unavailable */ }
      return new Set(compact);
    });
  };
  const closeCenter = () => {
    setOpen(false);
    dismissReady(complete.map((job) => job.id));
  };
  const run = async (id: string, action: () => Promise<void>) => { setBusyId(id); try { await action(); } finally { setBusyId(null); } };
  const openHomework = (job: QueuedUpload) => {
    if (!job.homework_id) return;
    if (job.status === "ready") dismissReady([job.id]);
    window.dispatchEvent(new CustomEvent("homework-upload-open", { detail: { homeworkId: job.homework_id } }));
    setOpen(false);
  };
  const renderJob = (job: QueuedUpload) => {
    const isFailed = job.status === "failed";
    const isReady = job.status === "ready";
    const busy = busyId === job.id;
    return <div className={styles.item} data-state={isFailed ? "failed" : isReady ? "ready" : "active"} key={job.id}>
      <div className={styles.fileIcon}>{isFailed ? <AlertTriangle /> : isReady ? <CheckCircle2 /> : <FileText />}</div>
      <button type="button" className={styles.itemMain} onClick={() => openHomework(job)}>
        <strong>{job.file?.name ?? `Домашняя работа №${job.homework_id ?? ""}`}</strong>
        <span>{labels[job.stage] ?? job.stage}{!isReady && !isFailed ? ` · ${job.progress}%` : ""}</span>
        {!isReady && !isFailed ? <i><em style={{ width: `${Math.max(2, job.progress)}%` }} /></i> : null}
      </button>
      {isFailed ? <button type="button" className={styles.action} disabled={busy} onClick={() => void run(job.id, () => retry(job.id))}>{busy ? <Spinner size="sm" /> : <RotateCw />}Повторить</button> : !isReady ? <button type="button" className={styles.action} disabled={busy} onClick={() => void run(job.id, () => cancel(job.id))}>{busy ? <Spinner size="sm" /> : null}{busy ? "Отменяем…" : "Отменить"}</button> : <button type="button" className={styles.arrow} onClick={() => openHomework(job)} aria-label="Открыть"><ChevronRight /></button>}
    </div>;
  };
  return <>
    <button type="button" className={styles.launcher} onClick={() => setOpen(true)} aria-label="Открыть центр загрузок"><CloudUpload /><span>{active.length || visible.length}</span></button>
    {open ? <div className={styles.backdrop} role="dialog" aria-modal="true"><section className={styles.center}>
      <header><div><CloudUpload /><div><h2>Центр загрузок</h2><p>{active.length ? `Идёт загрузка ${active.length} файла` : "Последние загрузки"}</p></div></div><button type="button" onClick={closeCenter} aria-label="Закрыть"><X /></button></header>
      <div className={styles.list}>
        {active.length ? <><h3>Сейчас загружается и очередь</h3>{active.map(renderJob)}</> : null}
        {complete.length ? <><h3>Завершено</h3>{complete.map(renderJob)}</> : null}
        {failed.length ? <><h3>Ошибка</h3>{failed.map(renderJob)}</> : null}
      </div>
      <footer><span>Одновременно загружается только один файл</span></footer>
    </section></div> : null}
  </>;
}

export function useHomeworkUploads() { const value = useContext(Context); if (!value) throw new Error("HomeworkUploadProvider is missing"); return value; }
