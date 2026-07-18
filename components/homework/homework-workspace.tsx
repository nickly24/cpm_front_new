"use client";

import { useHomeworkUploads } from "@/contexts/homework-upload-context";
import { deleteScannerProject } from "@/lib/homework-scanner/project-store";
import { homeworkFilesApi } from "@/lib/homework-files/api";
import type { HomeworkWorkspace } from "@/lib/homework-files/types";
import { FileUp, ScanLine, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { HomeworkChat } from "./homework-chat";
import { ScannerModal } from "./scanner-modal";
import styles from "./homework-workspace.module.css";
import layout from "./homework-workspace-layout.module.css";

const stateLabel: Record<string, string> = {
  none: "Нет файла", uploading: "Загрузка", processing: "Обработка", draft: "Черновик",
  submitted: "Отправлено", in_review: "На проверке", revision_requested: "На доработке", graded: "Оценено",
};

export function HomeworkWorkspaceModal({ homeworkId, onClose }: { homeworkId: number; onClose: () => void }) {
  const [workspace, setWorkspace] = useState<HomeworkWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"file" | "chat">("file");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [scanner, setScanner] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const displayedFileVersion = useRef<number | null>(null);
  const { enqueue, jobs } = useHomeworkUploads();

  const load = useCallback(async () => {
    try {
      const data = await homeworkFilesApi.workspace(homeworkId);
      setWorkspace(data);
      if (!data.permissions.chat) {
        try { localStorage.removeItem(`homework-chat-draft-${homeworkId}-self`); } catch { /* ignore */ }
      }
      if (data.submission.id && (data.submission.has_draft || data.submission.has_file)) {
        if (displayedFileVersion.current !== data.submission.file_version) {
          const result = await homeworkFilesApi.fileUrl(data.submission.id, data.submission.has_draft);
          displayedFileVersion.current = data.submission.file_version ?? null;
          setPdfUrl(result.url);
        }
      } else {
        displayedFileVersion.current = null;
        setPdfUrl(null);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ошибка загрузки");
    }
  }, [homeworkId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(timer);
  }, [load]);

  const choose = (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) {
      setError("Нужен PDF не больше 10 МБ"); return;
    }
    enqueue(homeworkId, file); setError(null);
  };

  const submit = async () => {
    try {
      await homeworkFilesApi.submit(homeworkId);
      await deleteScannerProject(homeworkId).catch(() => undefined);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить");
    }
  };

  const processing = jobs.some((job) => job.homework_id === homeworkId && !["ready", "failed", "cancelled"].includes(job.status));

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <header><div><h2>{workspace?.homework.name ?? "Домашняя работа"}</h2><span className={styles.state}>{stateLabel[workspace?.submission.state ?? "none"]}</span></div><button className={styles.iconButton} onClick={onClose} aria-label="Закрыть"><X /></button></header>
        <nav className={styles.tabs}><button data-active={tab === "file"} onClick={() => setTab("file")}>Работа</button><button data-active={tab === "chat"} onClick={() => setTab("chat")} disabled={workspace?.permissions.chat === false}>Чат</button></nav>
        <div className={layout.workspaceBody}>
          <div className={styles.filePane} data-mobile-active={tab === "file"}>
            {pdfUrl ? <iframe src={pdfUrl} title="Домашняя работа" /> : <div className={styles.emptyPreview}><FileUp size={40} /><p>Прикрепите готовую работу в PDF</p><small>До 10 МБ и 35 страниц</small></div>}
            <div className={styles.actions}>
              <input ref={input} hidden type="file" accept="application/pdf" onChange={(event) => choose(event.target.files?.[0])} />
              {workspace?.permissions.upload ? <button onClick={() => input.current?.click()}><FileUp size={18} />Прикрепить PDF</button> : null}
              {workspace?.permissions.upload ? <button className={styles.secondary} onClick={() => setScanner(true)}><ScanLine size={18} />Сканировать</button> : null}
              {workspace?.permissions.submit ? <button className={styles.primary} onClick={() => void submit()}><Send size={18} />Отправить</button> : null}
            </div>
            {processing ? <p className={styles.muted}>Можно закрыть окно — обработка продолжится.</p> : null}
          </div>
          <div className={layout.chatPane} data-mobile-active={tab === "chat"}>
            {workspace?.permissions.chat !== false ? <HomeworkChat homeworkId={homeworkId} /> : <p className={styles.muted}>Чат закрыт.</p>}
          </div>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
        {scanner ? <ScannerModal homeworkId={homeworkId} onClose={() => setScanner(false)} /> : null}
      </div>
    </div>
  );
}
