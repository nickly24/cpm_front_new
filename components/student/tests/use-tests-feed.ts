"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TestsPagination, TestsWithSessionsResponse } from "@/lib/student/tests-types";

type Snapshot = { pages: Record<number, TestsWithSessionsResponse>; revision: number; pagination: TestsPagination | null };
type Entry = { snapshot?: Snapshot; loading: boolean; error: string | null };
interface Options {
  queryKey: string;
  mobile: boolean;
  page: number;
  enabled: boolean;
  revision: number;
  loadPage: (page: number, signal: AbortSignal) => Promise<TestsWithSessionsResponse>;
}

// Cache belongs to this mounted cabinet only. No student data is persisted or shared across accounts.
export function useTestsFeed({ queryKey, mobile, page, enabled, revision, loadPage }: Options) {
  const cache = useRef(new Map<string, Snapshot>());
  const retryMode = useRef<"ensure" | "next" | "checking">("ensure");
  const request = useRef<{ key: string; controller: AbortController } | null>(null);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const key = JSON.stringify([queryKey, mobile ? "feed" : page]);

  const load = useCallback(async (mode: "ensure" | "next" | "retry" | "checking") => {
    if (!enabled) return;
    const action = mode === "retry" ? retryMode.current : mode;
    const cached = cache.current.get(key);
    const publish = (entry: Entry) => setEntries(current => {
      const next = { ...current, [key]: entry };
      // Bound inactive filter caches; never discard pages from the active feed.
      for (const old of Object.keys(next)) {
        if (Object.keys(next).length <= 8) break;
        if (old !== key) delete next[old];
      }
      return next;
    });
    if (mode === "ensure" && cached?.revision === revision) {
      publish({ snapshot: cached, loading: false, error: null });
      return;
    }
    if (request.current?.key === key && !request.current.controller.signal.aborted) return;
    const append = mobile && action === "next";
    const numbers = cached ? Object.keys(cached.pages).map(Number) : [];
    const last = Math.max(1, ...numbers);
    const lastPage = cached?.pages[last];
    const checkingPages = action === "checking" ? numbers.filter(number => cached?.pages[number].tests.some(test => test.status === "checking")) : [];
    if (action === "checking" && !checkingPages.length) return;
    if (append && (!lastPage || !lastPage.tests.length || (cached?.pagination && last >= cached.pagination.total_pages))) return;
    request.current?.controller.abort();
    const controller = new AbortController();
    request.current = { key, controller };
    publish({ snapshot: cached, loading: true, error: null });
    try {
      const pages: Snapshot["pages"] = (append || action === "checking") && cached ? { ...cached.pages } : {};
      let pagination = (append || action === "checking") ? cached?.pagination ?? null : null;
      const first = append ? last + 1 : mobile ? 1 : page;
      const end = append ? first : mobile ? last : page;
      const requestedPages = action === "checking" ? checkingPages : Array.from({ length: end - first + 1 }, (_, index) => first + index);
      for (const number of requestedPages) {
        const response = await loadPage(number, controller.signal);
        controller.signal.throwIfAborted();
        pages[number] = response;
        pagination = response.pagination ?? null;
        if (response.pagination) for (const saved of Object.keys(pages).map(Number)) { if (saved > Math.max(1, response.pagination.total_pages)) delete pages[saved]; }
        if (!response.tests.length || (response.pagination && number >= response.pagination.total_pages)) break;
      }
      const snapshot = { pages, revision, pagination };
      cache.current.set(key, snapshot);
      for (const old of cache.current.keys()) {
        if (cache.current.size <= 8) break;
        if (old !== key) cache.current.delete(old);
      }
      publish({ snapshot, loading: false, error: null });
    } catch (cause) {
      if (!controller.signal.aborted) {
        retryMode.current = action;
        publish({ snapshot: cached, loading: false, error: cause instanceof Error ? cause.message : "Не удалось загрузить тесты" });
      }
    } finally {
      if (request.current?.controller === controller) request.current = null;
    }
  }, [enabled, key, loadPage, mobile, page, revision]);

  useEffect(() => {
    void load("ensure");
    return () => request.current?.controller.abort();
  }, [load]);

  const entry = entries[key];
  const result = useMemo(() => {
    const pages = Object.entries(entry?.snapshot?.pages ?? {}).sort(([a], [b]) => Number(a) - Number(b)).map(([, value]) => value);
    const tests = new Map(pages.flatMap(value => value.tests).map(test => [String(test.id), test]));
    const sessions = new Map(pages.flatMap(value => value.sessions).map(session => [session.id, session]));
    const last = pages.at(-1);
    const pagination = entry?.snapshot?.pagination ?? null;
    return { tests: [...tests.values()], sessions: [...sessions.values()], pagination,
      hasNext: Boolean(last?.tests.length && (!pagination || pages.length < pagination.total_pages)) };
  }, [entry?.snapshot]);
  return { ...result, loading: enabled && (entry?.loading ?? true), error: entry?.error ?? null,
    loadNext: useCallback(() => { void load("next"); }, [load]),
    retry: useCallback(() => { void load("retry"); }, [load]),
    refreshChecking: useCallback(() => { void load("checking"); }, [load]) };
}
