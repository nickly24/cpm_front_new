"use client";
import { useRef } from "react";
import { ArrowLeft, Check, ChevronRight, Clock3, Download, FileText, FileUp, LoaderCircle, RotateCcw, ScanLine, X } from "lucide-react";
import { useHomeworkDialog } from "@/lib/homework-files/use-dialog";
import type { SubmissionState } from "@/lib/homework-files/types";
import { HomeworkPdfViewer } from "./homework-pdf-viewer";
import styles from "./homework-workspace.module.css";

export const homeworkWorkspaceStates: Record<SubmissionState, { label: string; description: string }> = {
  none: { label: "К сдаче", description: "Добавьте PDF или отсканируйте страницы работы." },
  uploading: { label: "Загружается", description: "Файл передаётся с устройства. Дождитесь завершения загрузки." },
  processing: { label: "Обрабатывается", description: "Проверяем и готовим PDF. Задание можно закрыть — обработка продолжится." },
  draft: { label: "Черновик", description: "Файл готов. Просмотрите страницы и отправьте работу на проверку." },
  submitted: { label: "В очереди", description: "Работа отправлена и ожидает проверяющего." },
  in_review: { label: "На проверке", description: "Проверяющий изучает работу. Баллы появятся после проверки." },
  revision_requested: { label: "Доработка", description: "Прочитайте комментарий, замените файл и отправьте исправления." },
  graded: { label: "Проверено", description: "Проверка завершена. Баллы указаны рядом со статусом задания." },
};
export function HomeworkStatusSymbol({ state }: { state: SubmissionState }) {
  const Icon = state === "graded" ? Check : state === "none" ? FileUp : state === "revision_requested" ? RotateCcw : state === "draft" ? FileText : state === "uploading" || state === "processing" ? LoaderCircle : Clock3;
  return <span className={styles.stateSymbol} data-state={state} aria-hidden="true"><Icon size={18}/></span>;
}
export function HomeworkStatusLegend({ onClose }: { onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null); useHomeworkDialog(root, onClose);
  return <div className={styles.panelBackdrop}><section ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Статусы домашних заданий" className={styles.legend}>
    <header className={styles.panelHeader}><h2>Статусы работы</h2><button type="button" aria-label="Закрыть статусы" onClick={onClose}><X size={22}/></button></header>
    <div className={styles.legendList}>{Object.entries(homeworkWorkspaceStates).map(([state, info]) => <div key={state}><HomeworkStatusSymbol state={state as SubmissionState}/><span><strong>{info.label}</strong><small>{info.description}</small></span></div>)}</div>
  </section></div>;
}
export function HomeworkAttachmentPicker({ onClose, onScan, onFile }: { onClose: () => void; onScan: () => void; onFile: () => void }) {
  const root = useRef<HTMLDivElement>(null); useHomeworkDialog(root, onClose);
  return <div className={styles.panelBackdrop}><section ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Добавить работу" className={styles.attachPicker}>
    <header className={styles.panelHeader}><h2>Добавить работу</h2><button type="button" aria-label="Закрыть выбор файла" onClick={onClose}><X size={22}/></button></header>
    <button className={styles.attachOption} type="button" onClick={onScan}><span className={styles.scanGlyph}><ScanLine size={25}/></span><span><strong>Сканировать</strong><small>Снять страницы или выбрать фотографии</small></span><ChevronRight size={18}/></button>
    <button className={styles.attachOption} type="button" onClick={onFile}><span className={styles.pdfGlyph}><FileUp size={25}/></span><span><strong>Выбрать PDF</strong><small>Готовый файл с устройства</small></span><ChevronRight size={18}/></button>
  </section></div>;
}
export function HomeworkFileScreen({ url, onClose, onDownload, downloading, onRefresh }: { url: string; onClose: () => void; onDownload: () => void; downloading: boolean; onRefresh: () => void }) {
  const root = useRef<HTMLDivElement>(null); useHomeworkDialog(root, onClose);
  return <section ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Просмотр домашней работы" className={styles.fileScreen}>
    <header className={styles.fileScreenHeader}><button type="button" className={styles.roundBack} aria-label="Назад к заданию" onClick={onClose}><ArrowLeft size={23}/></button><h2>Домашняя работа</h2><button type="button" className={styles.roundBack} aria-label="Скачать PDF" onClick={onDownload} disabled={downloading}><Download size={22}/></button></header>
    <div className={styles.fileScreenBody}><HomeworkPdfViewer standalone url={url} filename="Домашняя работа.pdf" onRefresh={onRefresh}/></div>
  </section>;
}
