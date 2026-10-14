"use client";

import { useCallback, useEffect, useState } from "react";

/** Reads are tied to both the cabinet and the selection. Poll failures keep the publication. */
export function useRatingResource<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
  pollEvery = 0,
) {
  const [state, setState] = useState<{
    key: string | null;
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({ key, data: null, loading: Boolean(key), error: null });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      try {
        const data = await load(controller.signal);
        if (!controller.signal.aborted)
          setState({ key, data, loading: false, error: null });
      } catch (error) {
        if (!controller.signal.aborted)
          setState((previous) => ({
            key,
            data: previous.key === key ? previous.data : null,
            loading: false,
            error: error instanceof Error ? error : new Error("Не удалось загрузить рейтинг"),
          }));
      }
      if (pollEvery > 0 && !controller.signal.aborted)
        timer = setTimeout(() => void run(), pollEvery);
    };
    void run();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [key, load, pollEvery, reloadCount]);

  const reload = useCallback(() => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    setReloadCount((value) => value + 1);
  }, []);

  return {
    data: state.key === key ? state.data : null,
    loading: Boolean(key) && (state.key !== key || state.loading),
    error: state.key === key ? state.error : null,
    reload,
  };
}
