"use client";

import { useHomeworkUploads } from "@/contexts/homework-upload-context";
import { deleteScannerProject } from "@/lib/homework-scanner/project-store";
import { homeworkFilesApi } from "@/lib/homework-files/api";
import type { HomeworkWorkspace, SubmissionState } from "@/lib/homework-files/types";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, File, FilePenLine, FileUp, RotateCcw, ScanLine, Search, Send, Settings2, Star, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScannerModal } from "./scanner-modal";
import styles from "./homework-workspace.module.css";

const stateLabel: Record<SubmissionState, string> = {
  none: "Нет файла", uploading: "Загрузка", processing: "Обработка", draft: "Черновик",
  submitted: "Отправлено", in_review: "На проверке", revision_requested: "На доработке", graded: "Оценено",
};

const steps: Array<{ state: SubmissionState; label: string; icon: typeof File }> = [
  { state: "none", label: "Нет файла", icon: File },
  { state: "uploading", label: "Загрузка", icon: Upload },
  { state: "processing", label: "Обработка", icon: Settings2 },
  { state: "draft", label: "Черновик", icon: FilePenLine },
  { state: "submitted", label: "Отправлено", icon: Send },
  { state: "in_review", label: "На проверке", icon: Search },
  { state: "revision_requested", label: "На доработке", icon: RotateCcw },
  { state: "graded", label: "Оценено", icon: Star },
];

export function HomeworkWorkspaceModal({ homeworkId, onClose }: { homeworkId: number; onClose: () => void }) {
  const [workspace, setWorkspace] = useState<HomeworkWorkspace | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [scanner, setScanner] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const refreshedTerminalJob = useRef<string | null>(null);
  const { enqueue, jobs } = useHomeworkUploads();

  const load = useCallback(async (silent = false) => {
    if (!silent) setInitialLoading(true);
    try {
      const data = await homeworkFilesApi.workspace(homeworkId);
      setWorkspace(data);
      if (data.submission.id && (data.submission.has_draft || data.submission.has_file)) {
        const result = await homeworkFilesApi.fileUrl(data.submission.id, data.submission.has_draft);
        setPdfUrl(result.url);
      } else {
        setPdfUrl(null);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ошибка загрузки");
    } finally {
      if (!silent) setInitialLoading(false);
    }
  }, [homeworkId]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialTimer);
  }, [load]);

  const choose = (file?: File) => {
    setChoosing(false);
    if (!file) return;
    if (file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) {
      setError("Нужен PDF не больше 10 МБ"); return;
    }
    enqueue(homeworkId, file);
    setError(null);
    if (input.current) input.current.value = "";
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true); setError(null);
    try {
      await homeworkFilesApi.submit(homeworkId);
      await deleteScannerProject(homeworkId).catch(() => undefined);
      await load(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить");
    } finally { setSubmitting(false); }
  };

  const activeJob = [...jobs].reverse().find((job) => job.homework_id === homeworkId && job.status !== "cancelled");
  useEffect(() => {
    if (!activeJob || !["ready", "failed"].includes(activeJob.status)) return;
    const marker = `${activeJob.id}:${activeJob.status}`;
    if (refreshedTerminalJob.current === marker) return;
    refreshedTerminalJob.current = marker;
    void load(true);
  }, [activeJob, load]);
  const processing = Boolean(activeJob && !["ready", "failed", "cancelled"].includes(activeJob.status));
  const currentState: SubmissionState = processing
    ? activeJob?.stage === "uploading" || activeJob?.stage === "queued" || activeJob?.stage === "queue" ? "uploading" : "processing"
    : workspace?.submission.state ?? "none";
  const currentIndex = steps.findIndex((item) => item.state === currentState);
  const localFile = activeJob && "file" in activeJob ? activeJob.file : undefined;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Домашняя работа">
      <div className={styles.modal} data-tab="file" aria-busy={initialLoading || submitting || processing}>
        <header className={styles.modalHeader}>
          <div><h2>{workspace?.homework.name ?? "Домашняя работа"}</h2><span className={styles.mobileState}><i />{currentState === "graded" ? "Проверено" : "В работе"}</span></div>
          <button className={styles.backButton} onClick={onClose} aria-label="Вернуться к домашним заданиям"><ArrowLeft /><span>Назад</span></button>
        </header>

        <nav className={styles.tabs}>
          <button data-active><FilePenLine />Работа</button>
        </nav>

        {initialLoading ? <div className={styles.initialLoading}><Spinner /><span>Открываем домашнюю работу…</span></div> : (
          <div className={styles.workspaceBody}>
            <section className={styles.filePane} data-active>
              <div className={styles.timeline} aria-label={`Статус: ${stateLabel[currentState]}`}>
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  return <div key={step.state} className={styles.timelineStep} data-active={index === currentIndex} data-complete={index < currentIndex}>
                    <span><Icon /></span><small>{step.label}</small>
                  </div>;
                })}
              </div>

              <div className={styles.fileActions}>
                <input ref={input} hidden type="file" accept="application/pdf" onChange={(event) => choose(event.target.files?.[0])} />
                {workspace?.permissions.upload ? <button disabled={choosing || processing} onClick={() => { setChoosing(true); input.current?.click(); window.setTimeout(() => setChoosing(false), 600); }}>
                  {choosing ? <Spinner size="sm" /> : <FileUp />}<span>{choosing ? "Открываем…" : pdfUrl ? "Заменить PDF" : "Прикрепить PDF"}</span>
                </button> : null}
                {workspace?.permissions.upload ? <button disabled={processing} onClick={() => setScanner(true)}><ScanLine />Сканировать</button> : null}
                {workspace?.permissions.submit ? <button className={styles.primary} disabled={submitting || processing} onClick={() => void submit()}>
                  {submitting ? <Spinner size="sm" /> : <Send />}<span>{submitting ? "Отправляем…" : "Отправить"}</span>
                </button> : null}
              </div>

              <div className={styles.fileWorkspace}>
                <div className={styles.previewPane}>
                  {pdfUrl ? <iframe src={pdfUrl} title="Домашняя работа" /> : <div className={styles.emptyPreview}><FileUp /><h3>Прикрепите готовую работу</h3><p>PDF до 10 МБ и 35 страниц</p></div>}
                </div>
                <aside className={styles.detailsPane}>
                  {processing ? <div className={styles.processingCard}><Spinner size="sm" /><div><b>Обработка на сервере</b><span>{activeJob?.progress ?? 0}% · окно можно закрыть</span></div></div> : null}
                  <div className={styles.detailCard}><b>Файл</b><div className={styles.fileRow}><File /><div><strong>{localFile?.name ?? (pdfUrl ? `Домашняя работа №${homeworkId}.pdf` : "Файл не выбран")}</strong><span>{localFile ? `${(localFile.size / 1024 / 1024).toFixed(1)} МБ` : pdfUrl ? "Обработанный PDF" : "PDF до 10 МБ"}</span></div>{pdfUrl ? <a href={pdfUrl} target="_blank" rel="noreferrer" aria-label="Открыть PDF"><Eye /></a> : null}</div></div>
                  <div className={styles.detailCard}><b>Статус</b><div className={styles.statusRow}><CheckCircle2 /><div><strong>{stateLabel[currentState]}</strong><span>{currentState === "draft" ? "Файл сохранён, но ещё не отправлен." : currentState === "graded" ? "Проверка завершена." : "Статус обновляется автоматически."}</span></div></div></div>
                  {workspace?.submission.revision_comment ? <div className={styles.errorCard}><AlertCircle /><div><b>Что нужно исправить</b><span>{workspace.submission.revision_comment}</span></div></div> : null}
                  {error ? <div className={styles.errorCard}><AlertCircle /><div><b>Проблема с файлом</b><span>{error}</span></div></div> : null}
                </aside>
              </div>
            </section>
          </div>
        )}
        {scanner ? <ScannerModal homeworkId={homeworkId} onClose={() => setScanner(false)} /> : null}
      </div>
    </div>
  );
}
