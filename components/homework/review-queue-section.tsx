"use client";

import { useAuth } from "@/contexts/AuthContext";
import { canAccessSection } from "@/lib/auth/admin-access";
import { homeworkFilesApi } from "@/lib/homework-files/api";
import type { ReviewQueueItem } from "@/lib/homework-files/types";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { Spinner } from "@/components/ui/spinner";
import { Archive, ArrowUpRight, FileText, RefreshCw, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReviewWorkspace } from "./review-workspace";
import { homeworkDate, homeworkFileSize, staffError, submissionLabels } from "./staff-homework-utils";
import styles from "./review-queue.module.css";

const tabs = [{ id: "", label: "Все активные" }, { id: "submitted", label: "В очереди" }, { id: "in_review", label: "На проверке" }, { id: "revision_requested", label: "На доработке" }];

export function ReviewQueueSection() {
  const { user } = useAuth();
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [state, setState] = useState("");
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search, 300);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [selected, setSelected] = useState<ReviewQueueItem | null>(null);
  const request = useRef(0);

  const load = useCallback(async (after?: number) => {
    const id = ++request.current;
    if (after) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const response = await homeworkFilesApi.queue({ state: state || undefined, search: query.trim() || undefined, after, limit: 24 });
      if (id !== request.current) return;
      setItems((current) => after ? [...new Map([...current, ...response.items].map((item) => [item.id, item])).values()] : response.items);
      setNextCursor(response.has_more === false ? null : response.next_cursor);
      setTotal(response.total ?? null);
    } catch (reason) { if (id === request.current) setError(staffError(reason, "Не удалось загрузить очередь.")); }
    finally { if (id === request.current) { setLoading(false); setLoadingMore(false); } }
  }, [query, state]);

  const invalidate = useCallback(() => { request.current++; }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => { window.clearTimeout(timer); invalidate(); }; }, [invalidate, load]);

  return <div className={styles.page}>
    <header className={styles.pageHeader}><div><span className={styles.eyebrow}>Домашние работы</span><h1>Проверка работ</h1><p>Открывайте файлы, оставляйте замечания и сохраняйте оценки.</p></div><div className={styles.headerActions}>{user?.role !== "staff_admin" || canAccessSection(user, "homework-archive") ? <Link className={styles.button} href={`/cabinet/${user?.role ?? "proctor"}/homework-archive`}><Archive size={17} />Архив</Link> : null}<button disabled={loading || loadingMore} onClick={() => void load()} aria-label="Обновить очередь"><RefreshCw size={17} /></button></div></header>
    <div className={styles.toolbar}><label className={styles.search}><Search size={18} /><input type="search" value={search} placeholder="Ученик, задание или группа" aria-label="Поиск работ" onChange={(event) => setSearch(event.target.value)} /></label><span className={styles.count}>{total === null ? `${items.length} работ` : `${total} работ`}</span></div>
    <nav className={styles.tabs} aria-label="Статус работ">{tabs.map((tab) => <button key={tab.id} aria-pressed={state === tab.id} onClick={() => setState(tab.id)}>{tab.label}</button>)}</nav>
    {notice ? <div className={styles.success} role="status">{notice}</div> : null}
    {error ? <div className={styles.error} role="alert"><span>{error}</span><button onClick={() => void load()}>Повторить</button></div> : null}
    {loading ? <div className={styles.loading}><Spinner /><span>Загружаем работы…</span></div> : !items.length ? <div className={styles.empty}><FileText size={34} /><h2>{query ? "Работы не найдены" : "Здесь пока нет работ"}</h2><p>{query ? "Попробуйте изменить имя, задание или группу." : state === "revision_requested" ? "Работы, отправленные ученикам на доработку, появятся здесь." : "Отправленные учениками работы появятся в очереди."}</p></div> : <>
      <div className={styles.cards}>{items.map((item) => {
        const mine = item.reviewer_id === user?.id && item.reviewer_role === user?.role;
        return <article className={styles.workCard} key={item.id}>
          <div className={styles.cardTop}><span className={styles.badge} data-state={item.state}>{submissionLabels[item.state]}</span><span className={styles.group}>{item.group_name ?? "Без группы"}</span></div>
          <div className={styles.cardTitle}><h2>{item.student_name}</h2><p>{item.homework_name}</p></div>
          <div className={styles.cardMeta}><span><FileText size={15} />{item.page_count != null ? `${item.page_count} стр. · ` : ""}{homeworkFileSize(item.size_bytes)}</span><span>Отправлено {homeworkDate(item.submitted_at_utc)}</span></div>
          {item.revision_comment ? <p className={styles.commentPreview}>{item.revision_comment}</p> : null}
          <div className={styles.cardBottom}><span className={styles.reviewer}><UserRound size={15} />{mine ? "Проверяете вы" : item.reviewer_name || (item.reviewer_id ? "Другой проверяющий" : "Свободна для проверки")}</span><button className={styles.openButton} onClick={() => setSelected(item)}>{item.state === "in_review" && mine ? "Продолжить" : "Открыть"}<ArrowUpRight size={17} /></button></div>
        </article>;
      })}</div>
      <footer className={styles.listFooter}><span>Показано {items.length}{total != null ? ` из ${total}` : ""}</span>{nextCursor !== null ? <button disabled={loadingMore} onClick={() => void load(nextCursor)}>{loadingMore ? <Spinner size="sm" /> : null}{loadingMore ? "Загружаем…" : "Показать ещё"}</button> : null}</footer>
    </>}
    {selected ? <ReviewWorkspace key={selected.id} work={selected} onClose={() => setSelected(null)} onChanged={async (message) => { await load(); setNotice(message ?? null); }} /> : null}
  </div>;
}
