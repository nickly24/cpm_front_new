"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import styles from "./tests.module.css";

export function TestsFeedEnd({ hasNext, loading, error, paused, count, onLoad, onRetry }: {
  hasNext: boolean; loading: boolean; error: string | null; paused: boolean; count: number;
  onLoad: () => void; onRetry: () => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasNext || loading || error || paused || !sentinel.current || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) onLoad();
    }, { rootMargin: "0px 0px 180px 0px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasNext, loading, error, paused, onLoad]);
  return <div ref={sentinel} className={styles.feedEnd} aria-live="polite">
    {loading ? <span role="status" aria-label="Загрузка тестов"><LoaderCircle size={24} className={styles.feedSpinner} aria-hidden="true"/></span> : error ? <button type="button" onClick={onRetry}>Повторить загрузку</button> : hasNext ? <button type="button" onClick={onLoad}>Загрузить ещё</button> : count > 0 ? <span>Все тесты загружены</span> : null}
  </div>;
}
