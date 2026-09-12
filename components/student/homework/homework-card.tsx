import { formatHomeworkDate } from "@/lib/student/homework-api";
import type { StudentHomeworkItem } from "@/lib/student/homework-types";
import { ArrowUpRight, BookOpen, CalendarDays, FileCheck2, MessageSquareText } from "lucide-react";
import styles from "./homework.module.css";

export function HomeworkCard({ item, onOpen }: { item: StudentHomeworkItem; onOpen?: () => void }) {
  const state = item.submission_state && item.submission_state !== "none" ? item.submission_state : item.result !== null ? "graded" : "none";
  const labels: Record<string, string> = { none: "К сдаче", uploading: "Загружается", processing: "Обрабатывается", draft: "Черновик", submitted: "В очереди", in_review: "На проверке", revision_requested: "Доработка", graded: "Проверено" };
  const action = state === "revision_requested" ? "Исправить работу" : state === "draft" ? "Проверить и отправить" : state === "none" ? "Подготовить работу" : "Открыть работу";
  return <article className={styles.card}>
    <div className={styles.cardTop}><span className={styles.subject}><BookOpen size={17} />{item.homework_type}</span><span className={styles.state} data-state={state}>{labels[state]}</span></div>
    <h2>{item.homework_name}</h2>
    {state === "revision_requested" && item.revision_comment ? <p className={styles.comment}><MessageSquareText size={16} />{item.revision_comment}</p> : <p className={styles.cardHint}>{state === "draft" ? "PDF сохранён. Осталось отправить на проверку." : state === "submitted" || state === "in_review" ? "PDF отправлен. Ожидайте результат проверки." : state === "graded" ? "Проверка завершена. Файл и результат внутри." : "Прикрепите PDF или отсканируйте страницы."}</p>}
    <div className={styles.cardMeta}><span><CalendarDays size={15} />{formatHomeworkDate(item.deadline)}</span>{state === "graded" && item.result !== null ? <strong><FileCheck2 size={16} />{item.result}<small>/ 100</small></strong> : null}</div>
    <button type="button" className={styles.workspaceButton} onClick={onOpen}>{action}<ArrowUpRight size={18} /></button>
  </article>;
}
