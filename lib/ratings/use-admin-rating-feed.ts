"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAdminRatingPage, fetchAdminRatingFreshness, type AdminRatingPage } from "@/lib/admin/admin-ratings-api";
import type { RatingFreshness } from "./freshness";

const PAGE_SIZE = 50;
interface Feed {
 key: string; rows: AdminRatingPage["ratings"]; total: number; publication: AdminRatingPage["publication"];
 loading: boolean; loadingMore: boolean; error: string | null; moreError: string | null;
 freshness: RatingFreshness | null; checking: boolean;
}
const empty = (key: string): Feed => ({ key, rows: [], total: 0, publication: null, loading: true, loadingMore: false, error: null, moreError: null, freshness: null, checking: false });

export function useAdminRatingFeed(scope: string, version: string, query: string) {
 const [revision, setRevision] = useState(0);
 const key = JSON.stringify([scope, version, query, revision]);
 const [state, setState] = useState<Feed>(() => empty(key));
 const request = useRef<{ key: string; controller: AbortController; busy: boolean } | null>(null);
 useEffect(() => {
  const controller = new AbortController(); const context = { key, controller, busy: true }; request.current = context;
  void (async () => {
   try {
    const page = await fetchAdminRatingPage({ version: version || undefined, q: query || undefined, limit: PAGE_SIZE, offset: 0 }, controller.signal);
    if (controller.signal.aborted || request.current !== context) return;
    setState({ ...empty(key), rows: page.ratings, total: page.total, publication: page.publication, loading: false, checking: true });
    context.busy = false;
    try {
     const freshness = await fetchAdminRatingFreshness(page.publication?.version_id, controller.signal);
     if (!controller.signal.aborted && request.current === context) setState(previous => ({ ...previous, freshness, checking: false }));
    } catch {
     if (!controller.signal.aborted && request.current === context) setState(previous => ({ ...previous, checking: false, freshness: { scope: "ratings", isStale: true, reason: "source_unavailable", activeJobId: null, versionId: page.publication?.version_id } }));
    }
   } catch (e) {
    context.busy = false;
    if (!controller.signal.aborted && request.current === context) setState({ ...empty(key), loading: false, error: e instanceof Error ? e.message : "Не удалось загрузить рейтинг" });
   }
  })();
  return () => { controller.abort(); if (request.current === context) request.current = null; };
 }, [key, version, query]);
 const loadMore = useCallback(async () => {
  const context = request.current; const current = state;
  if (!context || context.key !== key || current.key !== key || context.busy || current.loading || current.rows.length >= current.total) return;
  context.busy = true; setState(previous => ({ ...previous, loadingMore: true, moreError: null }));
  try {
   if (!current.publication) throw new Error("Отсутствует ID опубликованной версии рейтинга");
   const page = await fetchAdminRatingPage({ version: current.publication.version_id, q: query || undefined, limit: PAGE_SIZE, offset: current.rows.length }, context.controller.signal);
   if (context.controller.signal.aborted || request.current !== context) return;
   const seen = new Set(current.rows.map(row => row.student_id));
   if (page.total !== current.total || !page.ratings.length || page.publication?.version_id !== current.publication.version_id || page.ratings.some(row => seen.has(row.student_id)) || page.ratings.some((row, i) => (row.place ?? 0) <= (i ? page.ratings[i - 1].place ?? 0 : current.rows.at(-1)?.place ?? 0)))
    throw new Error("Не удалось загрузить следующую страницу рейтинга");
   setState(previous => ({ ...previous, rows: [...previous.rows, ...page.ratings], loadingMore: false }));
  } catch (e) {
   if (!context.controller.signal.aborted && request.current === context) setState(previous => ({ ...previous, loadingMore: false, moreError: e instanceof Error ? e.message : "Не удалось загрузить следующую страницу" }));
  } finally { context.busy = false; }
 }, [key, query, state]);
 const reload = useCallback(() => setRevision(value => value + 1), []);
 return { ...(state.key === key ? state : empty(key)), reload, loadMore };
}
