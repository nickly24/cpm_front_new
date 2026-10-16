import { formatHomeworkDate } from "@/lib/student/homework-api";
import type { StudentHomeworkItem } from "@/lib/student/homework-types";
import { BookOpen, CalendarDays, Check, Clock3, FileText, LoaderCircle, MessageSquareText, RotateCcw, Upload } from "lucide-react";
import styles from "./homework.module.css";

export function HomeworkCard({ item, onOpen }: { item: StudentHomeworkItem; onOpen?: () => void }) {
  const state = item.submission_state && item.submission_state !== "none" ? item.submission_state : item.result !== null ? "graded" : "none";
  const labels: Record<string, string> = { none: "К сдаче", uploading: "Загружается", processing: "Обрабатывается", draft: "Черновик", submitted: "В очереди", in_review: "На проверке", revision_requested: "Доработка", graded: "Проверено" };
  const StatusIcon = state === "none" ? Upload : state === "graded" ? Check : state === "revision_requested" ? RotateCcw : state === "draft" ? FileText : state === "processing" || state === "uploading" ? LoaderCircle : Clock3;
  return <article className={styles.card}>
    <div className={styles.rowBody}>
    <span className={styles.subject}><BookOpen size={15}/>{item.homework_type}</span>
    <h2>{item.homework_name}</h2>
    {state === "revision_requested" && item.revision_comment ? <p className={styles.comment}><MessageSquareText size={15}/>{item.revision_comment}</p> : state === "draft" ? <p className={styles.cardHint}>PDF сохранён. Можно отправить на проверку.</p> : null}
    <div className={styles.cardMeta}><div><span><CalendarDays size={14}/>{formatHomeworkDate(item.deadline)}</span>{state === "graded" && item.result !== null ? <strong>{item.result}<small>/ 100</small></strong> : null}</div></div>
    </div>
    <span className={styles.statusBadge} data-state={state} role="img" aria-label={labels[state]}><StatusIcon size={18}/></span>
    <button type="button" className={styles.cardHitArea} onClick={onOpen} aria-label={`Открыть задание: ${item.homework_name}`}/>
  </article>;
}
