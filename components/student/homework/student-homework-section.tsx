"use client";
import { useHomeworkTypes } from "@/lib/bff/use-homework-types";
import { HomeworkCard } from "./homework-card";
import { HomeworkPagination } from "./homework-pagination";
import styles from "./homework.module.css";
import { FilterPopover } from "@/components/ui/filter-popover";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchStudentHomework } from "@/lib/student/homework-api";
import { HOMEWORK_PAGE_SIZE, type HomeworkStatusFilter, type StudentHomeworkResponse } from "@/lib/student/homework-types";
import { BookOpen, RefreshCw, Search } from "lucide-react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HomeworkWorkspaceModal } from "@/components/homework/homework-workspace";

const tabs: { value: HomeworkStatusFilter; label: string }[] = [{ value: "all", label: "Все задания" }, { value: "undone", label: "К сдаче" }, { value: "in_review", label: "На проверке" }, { value: "revision", label: "Доработка" }, { value: "done", label: "Проверено" }];
export function StudentHomeworkSection() {
  return <Suspense fallback={<LoadingState label="Открываем домашние задания…" variant="block" />}><StudentHomeworkContent /></Suspense>;
}
function HomeworkSearch({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onCommit(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text, value, onCommit]);
  return <label className={styles.search}><Search size={18} /><input type="search" maxLength={200} value={text} onChange={event => setText(event.target.value)} placeholder="Найти задание" aria-label="Найти задание" /></label>;
}
function StudentHomeworkContent() {
  const { names: typeNames, error: typeError } = useHomeworkTypes();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const queryString = params.toString();
  const typeFilter = params.get("type") || "all";
  const statusFilter = tabs.find(tab => tab.value === params.get("status"))?.value || "all";
  const requestedPage = Number(params.get("page") || 1);
  const currentPage = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 1000000 ? requestedPage : 1;
  const searchQuery = params.get("search") || "";
  const [refresh, setRefresh] = useState(0);
  const requestKey = JSON.stringify([currentPage, typeFilter, statusFilter, searchQuery, refresh]);
  const [resource, setResource] = useState<{ key: string; data?: StudentHomeworkResponse; error?: string } | null>(null);
  const active = resource?.key === requestKey ? resource : null;
  const response = active?.data;
  const error = active?.error;
  const loading = !response && !error;
  const pagination = response?.pagination;
  const counts = response?.counts;
  const openHomeworkId = Number(params.get("work")) || null;
  const updateQuery = useCallback((changes: Record<string, string | null>) => {
    const next = new URLSearchParams(queryString);
    for (const [key, value] of Object.entries(changes)) {
      if (!value || value === "all" || key === "page" && value === "1") next.delete(key);
      else next.set(key, value);
    }
    const suffix = next.toString();
    router.replace(`${pathname}${suffix ? `?${suffix}` : ""}`, { scroll: false });
  }, [queryString, pathname, router]);
  useEffect(() => {
    const controller = new AbortController();
    void fetchStudentHomework({ page: currentPage, limit: HOMEWORK_PAGE_SIZE, type: typeFilter, status: statusFilter, search: searchQuery, signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return;
        if (!data.status || !data.pagination || !data.counts) throw new Error("Не удалось получить страницу заданий");
        setResource({ key: requestKey, data });
      })
      .catch(reason => {
        if (!controller.signal.aborted) setResource({ key: requestKey, error: reason instanceof Error ? reason.message : "Не удалось загрузить задания" });
      });
    return () => controller.abort();
  }, [currentPage, typeFilter, statusFilter, searchQuery, requestKey]);
  useEffect(() => {
    if (pagination && pagination.current_page !== currentPage) updateQuery({ page: String(pagination.current_page) });
  }, [pagination, currentPage, updateQuery]);
  useEffect(() => {
    const update = () => { if (!new URLSearchParams(window.location.search).has("work")) setRefresh(value => value + 1); };
    const focus = () => { if (!new URLSearchParams(window.location.search).has("work")) update(); };
    window.addEventListener("homework-workspace-updated", update);
    window.addEventListener("focus", focus);
    return () => { window.removeEventListener("homework-workspace-updated", update); window.removeEventListener("focus", focus); };
  }, []);
  const open = (id: number) => { const next = new URLSearchParams(queryString); next.set("work", String(id)); router.push(`${pathname}?${next}`, { scroll: false }); };
  const close = () => { updateQuery({ work: null }); setRefresh(value => value + 1); };
  return <div className={styles.page}>
    <header className={styles.pageHeading}><div><span className={styles.eyebrow}>Учёба · Мои работы</span><h1>Домашние задания</h1><p>Подготовьте работу, отправьте PDF и следите за проверкой.</p></div><button type="button" className={styles.refresh} aria-label="Обновить задания" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={18} /></button></header>
    {counts?.revision ? <button type="button" className={styles.revisionBanner} onClick={() => updateQuery({ status: "revision", page: null })}>Есть работы на доработке: {counts.revision}<span>Посмотреть комментарии →</span></button> : null}
    <div className={styles.tabs} role="group" aria-label="Статус заданий">{tabs.map(tab => <button key={tab.value} type="button" aria-pressed={statusFilter === tab.value} onClick={() => updateQuery({ status: tab.value, page: null })}>{tab.label}<span>{counts?.[tab.value] ?? "—"}</span></button>)}</div>
    <section className={styles.toolbar}><HomeworkSearch key={searchQuery} value={searchQuery} onCommit={search => updateQuery({ search, page: null })} /><FilterPopover activeCount={Number(typeFilter !== "all")} onReset={() => updateQuery({ type: null, page: null })}><label className={styles.typeFilter}><span>Тип задания</span><select aria-label="Тип задания" value={typeFilter} onChange={event => updateQuery({ type: event.target.value, page: null })}><option value="all">Все типы</option>{typeNames.map(name => <option key={name} value={name}>{name}</option>)}</select></label></FilterPopover></section>
    {typeError ? <p role="alert">{typeError}</p> : null}
    {error ? <div className={styles.alert} role="alert">{error}</div> : null}
    {loading ? <LoadingState label="Загружаем задания…" variant="block" /> : response?.res.length ? <section className={styles.grid} aria-label="Задания">{response.res.map(item => <HomeworkCard key={item.homework_id} item={item} onOpen={() => open(item.homework_id)} />)}</section> : !error ? <div className={styles.empty}><BookOpen size={32} /><h2>Здесь пока нет заданий</h2><p>Попробуйте другой статус или измените поиск.</p></div> : null}
    {pagination && pagination.total_pages > 1 ? <HomeworkPagination currentPage={pagination.current_page} totalPages={pagination.total_pages} onPageChange={page => updateQuery({ page: String(page) })} /> : null}
    <p className={styles.resultMeta}>{pagination?.total_items ? `Показано ${response?.res.length} из ${pagination.total_items} · Ближайшие сроки сначала` : ""}</p>
    {openHomeworkId ? <HomeworkWorkspaceModal key={openHomeworkId} homeworkId={openHomeworkId} onClose={close} /> : null}
  </div>;
}
