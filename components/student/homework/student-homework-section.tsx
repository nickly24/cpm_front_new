"use client";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { HomeworkDesktopList, HomeworkDesktopToolbar } from "./homework-desktop";
import { useHomeworkTypes } from "@/lib/bff/use-homework-types";
import { HomeworkCard } from "./homework-card";
import { HomeworkPagination } from "./homework-pagination";
import styles from "./homework.module.css";
import { HomeworkSearchScreen, homeworkStatuses } from "./homework-search-screen";
import { usePullToRefresh, PullRefreshIndicator } from "../shared/pull-to-refresh";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchStudentHomework } from "@/lib/student/homework-api";
import { HOMEWORK_PAGE_SIZE, type StudentHomeworkResponse } from "@/lib/student/homework-types";
import { BookOpen, Search } from "lucide-react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HomeworkWorkspaceModal } from "@/components/homework/homework-workspace";

export function StudentHomeworkSection() {
  return <Suspense fallback={<LoadingState label="Открываем домашние задания…" variant="block" />}><StudentHomeworkContent /></Suspense>;
}
function StudentHomeworkContent() {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const listPosition = useRef<{ id: number; y: number } | null>(null);
  const previousWork = useRef<number | null>(null);
  const pendingRestore = useRef<{y:number;refresh:number}|null>(null);
  const { names: typeNames, error: typeError, reload: reloadTypes } = useHomeworkTypes();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const queryString = params.toString();
  const typeFilter = params.get("type") || "all";
  const statusFilter = homeworkStatuses.find(tab => tab.value === params.get("status"))?.value || "all";
  const requestedPage = Number(params.get("page") || 1);
  const currentPage = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 1000000 ? requestedPage : 1;
  const searchQuery = params.get("search") || "";
  const scroller = useRef<HTMLDivElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
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
  const hrefFor = (id: number) => { const next = new URLSearchParams(queryString); next.set("work", String(id)); return `${pathname}?${next}`; };
  const open = (id: number) => { if (desktop) listPosition.current = { id, y: window.scrollY }; router.push(hrefFor(id), { scroll: false }); };
  const close = () => {
    if (desktop && listPosition.current?.id === openHomeworkId) router.back();
    else { updateQuery({ work: null }); if (!desktop) setRefresh(value => value + 1); }
  };
  useEffect(() => {
    const wasOpen = previousWork.current;
    previousWork.current = openHomeworkId;
    if (!desktop) return;
    if (openHomeworkId) { window.scrollTo({ top: 0, behavior: "instant" }); return; }
    if (!wasOpen) return;
    const y = listPosition.current?.y ?? 0;
    listPosition.current = null;
    pendingRestore.current = { y, refresh: refresh + 1 };
    const frame = requestAnimationFrame(() => { setRefresh(value => value + 1); });
    return () => cancelAnimationFrame(frame);
  }, [desktop, openHomeworkId, refresh]);
  useEffect(() => {
    const restore = pendingRestore.current;
    if (!desktop || openHomeworkId || !response || !restore || refresh < restore.refresh) return;
    const frame = requestAnimationFrame(() => { window.scrollTo({ top: restore.y, behavior: "instant" }); pendingRestore.current = null; });
    return () => cancelAnimationFrame(frame);
  }, [desktop, openHomeworkId, response, refresh]);
  const reload = useCallback(() => setRefresh(value => value + 1), [setRefresh]);
  const pullDistance = usePullToRefresh(scroller, { loading, disabled: desktop || Boolean(searchOpen || openHomeworkId), onRefresh: reload });
  const applyFilters = (values: { search: string; status: string; type: string }) => {
    pendingRestore.current = null;
    updateQuery({ search: values.search.trim(), status: values.status, type: values.type, page: null });
    if (scroller.current) scroller.current.scrollTop = 0;
  };
  if (desktop && openHomeworkId) return <HomeworkWorkspaceModal key={openHomeworkId} homeworkId={openHomeworkId} onClose={close} presentation="page"/>;
  return <div className={styles.page}>
    {desktop ? <HomeworkDesktopToolbar key={searchQuery} initial={{ search: searchQuery, status: statusFilter, type: typeFilter }} types={typeNames} counts={counts} onApply={applyFilters}/> : <button type="button" className={styles.searchSummary} aria-label="Изменить поиск заданий" onClick={() => setSearchOpen(true)}><Search size={20}/><span><strong>{searchQuery || "Все домашние задания"}</strong><small>{homeworkStatuses.find(item => item.value === statusFilter)?.label} · {typeFilter === "all" ? "Все типы" : typeFilter}</small></span></button>}
    {typeError ? <p role="alert" className={styles.typeError}>{typeError}{reloadTypes ? <button type="button" onClick={reloadTypes}>Повторить</button> : null}</p> : null}
    <div ref={scroller} className={styles.feedScroll} role="region" aria-label="Лента домашних заданий" tabIndex={0}>
      <PullRefreshIndicator distance={pullDistance} loading={loading}/>
      {error ? <div className={styles.alert} role="alert">{error}<button type="button" onClick={reload}>Повторить</button></div> : null}
      {loading ? null : response?.res.length ? (desktop ? <HomeworkDesktopList items={response.res} hrefFor={hrefFor} onOpen={open}/> : <section className={styles.grid} aria-label="Задания">{response.res.map(item => <HomeworkCard key={item.homework_id} item={item} onOpen={() => open(item.homework_id)} />)}</section>) : !error ? <div className={styles.empty}><BookOpen size={32} /><h2>Здесь пока нет заданий</h2><p>Попробуйте другой статус или измените поиск.</p></div> : null}
      {pagination && pagination.total_pages > 1 ? <HomeworkPagination currentPage={pagination.current_page} totalPages={pagination.total_pages} onPageChange={page => { updateQuery({ page: String(page) }); if (desktop) window.scrollTo({ top: 0, behavior: "instant" }); if (scroller.current) scroller.current.scrollTop = 0; }} /> : null}
      <p className={styles.resultMeta}>{pagination?.total_items ? `Показано ${response?.res.length} из ${pagination.total_items}` : ""}</p>
    </div>
    {searchOpen ? <HomeworkSearchScreen initial={{ search: searchQuery, status: statusFilter, type: typeFilter }} types={typeNames} counts={counts} onClose={() => setSearchOpen(false)} onApply={values => { updateQuery({ search: values.search.trim(), status: values.status, type: values.type, page: null }); setSearchOpen(false); if (scroller.current) scroller.current.scrollTop = 0; }}/> : null}
    {openHomeworkId ? <HomeworkWorkspaceModal key={openHomeworkId} homeworkId={openHomeworkId} onClose={close} /> : null}
  </div>;
}
