"use client";

import { HomeworkCard } from "./homework-card";
import { HomeworkPagination } from "./homework-pagination";
import styles from "./homework.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchStudentHomework, filterHomeworkByStatus, paginateHomework } from "@/lib/student/homework-api";
import { HOMEWORK_FETCH_LIMIT, HOMEWORK_PAGE_SIZE, type HomeworkStatusFilter, type HomeworkTypeFilter, type StudentHomeworkItem } from "@/lib/student/homework-types";
import type { HomeworkWorkspace } from "@/lib/homework-files/types";
import { BookOpen, RefreshCw, Search } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HomeworkWorkspaceModal } from "@/components/homework/homework-workspace";

const tabs: { value: HomeworkStatusFilter; label: string }[] = [{ value: "all", label: "Все задания" }, { value: "undone", label: "К сдаче" }, { value: "in_review", label: "На проверке" }, { value: "revision", label: "Доработка" }, { value: "done", label: "Проверено" }];
export function StudentHomeworkSection() {
  return <Suspense fallback={<LoadingState label="Открываем домашние задания…" variant="block" />}><StudentHomeworkContent /></Suspense>;
}
function StudentHomeworkContent() {
  const [items, setItems] = useState<StudentHomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<HomeworkTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<HomeworkStatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [refresh, setRefresh] = useState(0);
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const openHomeworkId = Number(params.get("work")) || null;
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const response = await fetchStudentHomework({ page: 1, limit: HOMEWORK_FETCH_LIMIT, type: typeFilter });
        if (!response.status) throw new Error("Не удалось загрузить домашние задания");
        const all = [...response.res];
        for (let page = 2; page <= (response.pagination?.total_pages || 1) && !cancelled; page++) {
          const next = await fetchStudentHomework({ page, limit: HOMEWORK_FETCH_LIMIT, type: typeFilter });
          if (!next.status) throw new Error("Часть заданий не загрузилась. Обновите список.");
          all.push(...next.res);
        }
        if (!cancelled) setItems(all);
      } catch (reason) { if (!cancelled) setError(reason instanceof Error ? reason.message : "Не удалось загрузить задания"); }
      finally { if (!cancelled) setLoading(false); }
    };
    void load(); return () => { cancelled = true; };
  }, [typeFilter, refresh]);
  useEffect(() => {
    const update = (event: Event) => {
      const { homeworkId, workspace } = (event as CustomEvent<{ homeworkId: number; workspace: HomeworkWorkspace }>).detail;
      setItems(previous => previous.map(item => item.homework_id === homeworkId ? { ...item, submission_id: workspace.submission.id, submission_state: workspace.submission.state, has_file: workspace.submission.has_file, has_draft: workspace.submission.has_draft, submitted_at_utc: workspace.submission.submitted_at_utc, revision_comment: workspace.submission.revision_comment, result: workspace.legacy_result?.status ? workspace.legacy_result.result : null } : item));
    };
    window.addEventListener("homework-workspace-updated", update);
    const focus = () => { if (!new URLSearchParams(window.location.search).has("work")) setRefresh(value => value + 1); };
    window.addEventListener("focus", focus);
    return () => { window.removeEventListener("homework-workspace-updated", update); window.removeEventListener("focus", focus); };
  }, []);
  const filtered = useMemo(() => filterHomeworkByStatus(items, statusFilter).filter(item => `${item.homework_name} ${item.homework_type}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => {
    const aDate = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    const bDate = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    return aDate - bDate;
  }), [items, search, statusFilter]);
  const pagination = paginateHomework(filtered, currentPage, HOMEWORK_PAGE_SIZE);
  const revisions = items.filter(item => item.submission_state === "revision_requested").length;
  const open = (id: number) => { const next = new URLSearchParams(params); next.set("work", String(id)); router.push(`${pathname}?${next}`, { scroll: false }); };
  const close = () => { const next = new URLSearchParams(params); next.delete("work"); router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }); };
  return <div className={styles.page}>
    <header className={styles.pageHeading}><div><span className={styles.eyebrow}>Учёба · Мои работы</span><h1>Домашние задания</h1><p>Подготовьте работу, отправьте PDF и следите за проверкой.</p></div><button type="button" className={styles.refresh} aria-label="Обновить задания" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={18} /></button></header>
    {revisions ? <button type="button" className={styles.revisionBanner} onClick={() => { setStatusFilter("revision"); setCurrentPage(1); }}>Есть работы на доработке: {revisions}<span>Посмотреть комментарии →</span></button> : null}
    <div className={styles.tabs} role="group" aria-label="Статус заданий">{tabs.map(tab => <button key={tab.value} type="button" aria-pressed={statusFilter === tab.value} onClick={() => { setStatusFilter(tab.value); setCurrentPage(1); }}>{tab.label}<span>{filterHomeworkByStatus(items, tab.value).length}</span></button>)}</div>
    <section className={styles.toolbar}><label className={styles.search}><Search size={18} /><input type="search" value={search} onChange={event => { setSearch(event.target.value); setCurrentPage(1); }} placeholder="Найти задание" aria-label="Найти задание" /></label><label className={styles.typeFilter}><span>Тип</span><select value={typeFilter} onChange={event => { setTypeFilter(event.target.value as HomeworkTypeFilter); setCurrentPage(1); }}><option value="all">Все типы</option><option value="ОВ">ОВ</option><option value="ДЗНВ">ДЗНВ</option></select></label></section>
    {error ? <div className={styles.alert} role="alert">{error}</div> : null}
    {loading && !items.length ? <LoadingState label="Загружаем задания…" variant="block" /> : pagination.items.length ? <section className={styles.grid} aria-label="Задания">{pagination.items.map(item => <HomeworkCard key={item.homework_id} item={item} onOpen={() => open(item.homework_id)} />)}</section> : !error ? <div className={styles.empty}><BookOpen size={32} /><h2>Здесь пока нет заданий</h2><p>Попробуйте другой статус или измените поиск.</p></div> : null}
    {pagination.totalPages > 1 ? <HomeworkPagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} onPageChange={setCurrentPage} /> : null}
    <p className={styles.resultMeta}>{pagination.totalItems ? `Показано ${pagination.items.length} из ${pagination.totalItems} · Ближайшие сроки сначала` : ""}</p>
    {openHomeworkId ? <HomeworkWorkspaceModal key={openHomeworkId} homeworkId={openHomeworkId} onClose={close} /> : null}
  </div>;
}
