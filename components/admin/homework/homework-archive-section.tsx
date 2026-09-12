"use client";

import { useAuth } from "@/contexts/AuthContext";
import { canAccessSection } from "@/lib/auth/admin-access";
import { homeworkFilesApi, type ArchiveItem } from "@/lib/homework-files/api";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { ReviewWorkspace } from "@/components/homework/review-workspace";
import { homeworkDate, homeworkFileSize, staffError } from "@/components/homework/staff-homework-utils";
import { Spinner } from "@/components/ui/spinner";
import { Archive, ArrowUpRight, FileText, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "@/components/homework/review-queue.module.css";

export function HomeworkArchiveSection() {
  const { user } = useAuth();
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search, 300);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [selected, setSelected] = useState<ArchiveItem | null>(null);
  const request = useRef(0);
  const invalidDates = Boolean(from && to && from > to);

  const load = useCallback(async (after?: number) => {
    const id = ++request.current;
    if (invalidDates) { setLoading(false); setLoadingMore(false); return; }
    if (after) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const response = await homeworkFilesApi.archive({ search: query.trim() || undefined, date_from: from || undefined, date_to: to || undefined, after, limit: 24 });
      if (id !== request.current) return;
      setItems((current) => after ? [...new Map([...current, ...response.items].map((item) => [item.id, item])).values()] : response.items);
      setNextCursor(response.has_more === false ? null : response.next_cursor);
      setTotal(response.total ?? null);
    } catch (reason) { if (id === request.current) setError(staffError(reason, "Не удалось загрузить архив.")); }
    finally { if (id === request.current) { setLoading(false); setLoadingMore(false); } }
  }, [from, invalidDates, query, to]);

  const invalidate = useCallback(() => { request.current++; }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => { window.clearTimeout(timer); invalidate(); }; }, [invalidate, load]);

  return <div className={styles.page}>
    <header className={styles.pageHeader}><div><span className={styles.eyebrow}>Домашние работы</span><h1>Архив работ</h1><p>{user?.role === "proctor" ? "Проверенные работы учеников вашей группы. Файлы и оценки всегда под рукой." : "Итоговые файлы, оценки и управление пересдачами."}</p></div><div className={styles.headerActions}>{user?.role !== "staff_admin" || canAccessSection(user, "review-queue") ? <Link className={styles.button} href={`/cabinet/${user?.role ?? "proctor"}/review-queue`}><FileText size={17} />К проверке</Link> : null}<button disabled={loading || loadingMore || invalidDates} onClick={() => void load()} aria-label="Обновить архив"><RefreshCw size={17} /></button></div></header>
    <div className={styles.toolbar}><label className={styles.search}><Search size={18} /><input type="search" value={search} placeholder="Ученик, задание или группа" aria-label="Поиск в архиве" onChange={(event) => setSearch(event.target.value)} /></label><span className={styles.count}>{total === null ? `${items.length} работ` : `${total} работ`}</span></div>
    <div className={styles.dateFilters}><span>Дата отправки</span><label>С<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label><label>По<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>{from || to ? <button className={styles.quietButton} onClick={() => { setFrom(""); setTo(""); }}>Сбросить</button> : null}</div>
    {invalidDates ? <div className={styles.error} role="alert">Начало периода должно быть не позже его окончания.</div> : null}
    {notice ? <div className={styles.success} role="status">{notice}</div> : null}
    {error ? <div className={styles.error} role="alert"><span>{error}</span><button onClick={() => void load()}>Повторить</button></div> : null}
    {loading ? <div className={styles.loading}><Spinner /><span>Загружаем архив…</span></div> : !items.length ? <div className={styles.empty}><Archive size={34} /><h2>Работы не найдены</h2><p>{query || from || to ? "Измените поиск или период отправки." : "Проверенные работы будут сохраняться здесь."}</p></div> : <><div className={styles.cards}>{items.map((item) => <article className={styles.workCard} key={item.id}><div className={styles.cardTop}><span className={styles.badge} data-state="graded">Проверено</span><span className={styles.group}>{item.group_name ?? "Без группы"}</span></div><div className={styles.cardTitle}><h2>{item.student_name}</h2><p>{item.homework_name}</p></div><div className={styles.cardMeta}><span><FileText size={15} />{item.page_count} стр. · {homeworkFileSize(item.size_bytes)}</span><span>Отправлено {homeworkDate(item.submitted_at_utc)}</span></div><div className={styles.cardBottom}><span className={styles.cardScore}>{item.result ?? "—"}<small> / 100</small></span><button className={styles.openButton} onClick={() => setSelected(item)}>Файл и оценка<ArrowUpRight size={17} /></button></div></article>)}</div><footer className={styles.listFooter}><span>Показано {items.length}{total !== null ? ` из ${total}` : ""}</span>{nextCursor !== null ? <button disabled={loadingMore || invalidDates} onClick={() => void load(nextCursor)}>{loadingMore ? <Spinner size="sm" /> : null}{loadingMore ? "Загружаем…" : "Показать ещё"}</button> : null}</footer></>}
    {selected ? <ReviewWorkspace key={selected.id} work={selected} onClose={() => setSelected(null)} onChanged={async (message) => { await load(); setNotice(message ?? null); }} /> : null}
  </div>;
}
