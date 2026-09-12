"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { examGet, examMutate, updateExamQuery, type ExamCommand } from "./api";

/** No timer, focus refresh, or background transport. A new URL or explicit reload only. */
export function useExamResource<T>(path: string | null) {
  const [state, setState] = useState<{
    path: string | null;
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({ path, data: null, loading: Boolean(path), error: null });
  const [revision, setRevision] = useState(0);
  const serial = useRef(0);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const request = ++serial.current;
    examGet<T>(path, {}, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted && request === serial.current)
          setState({ path, data, loading: false, error: null });
      },
      (error: unknown) => {
        if (!controller.signal.aborted && request === serial.current)
          setState((prev) => ({
            path,
            data: prev.path === path ? prev.data : null,
            loading: false,
            error:
              error instanceof Error ? error : new Error("Ошибка загрузки"),
          }));
      },
    );
    return () => {
      controller.abort();
    };
  }, [path, revision]);
  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    setRevision((r) => r + 1);
  }, []);
  // A navigation must never render the previous student's payload for even one frame.
  return {
    data: state.path === path ? state.data : null,
    error: state.path === path ? state.error : null,
    loading: Boolean(path) && (state.path !== path || state.loading),
    reload,
  };
}

export type NewCommand = Omit<ExamCommand, "key" | "createdAt">;
export function isUncertain(error: unknown): boolean {
  return error instanceof ApiError && (!error.status || error.status >= 500);
}

function journalGet(scope: string): ExamCommand | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.sessionStorage.getItem(`exam-command:${scope}`);
    if (!saved) return null;
    const value = JSON.parse(saved) as ExamCommand;
    return value.key &&
      value.path?.startsWith("/api/") &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(value.method)
      ? value
      : null;
  } catch {
    return null;
  }
}
function journalSet(scope: string, command: ExamCommand | null) {
  try {
    if (command)
      window.sessionStorage.setItem(
        `exam-command:${scope}`,
        JSON.stringify(command),
      );
    else window.sessionStorage.removeItem(`exam-command:${scope}`);
  } catch {
    /* Retry still works in memory if storage is unavailable. */
  }
}

/** Parent must key by the authenticated role/id. No automatic replay is performed. */
export function useExamMutation<T>(scope: string, onDone: (result: T) => void) {
  const [pending, setPending] = useState<ExamCommand | null>(() =>
    journalGet(scope),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [uncertain, setUncertain] = useState(() => Boolean(journalGet(scope)));
  const mounted = useRef(false);
  const running = useRef(false);
  const callback = useRef(onDone);
  useEffect(() => {
    callback.current = onDone;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const perform = async (command: ExamCommand) => {
    if (running.current) return;
    if (
      !command.createdAt ||
      Date.now() - command.createdAt >= 72 * 60 * 60 * 1000
    ) {
      setError(
        new Error(
          "Срок безопасного повтора команды истёк. Проверьте сохранённое состояние и закройте это уведомление; старый запрос не отправлен.",
        ),
      );
      setUncertain(true);
      return;
    }
    const editor = document.activeElement?.closest<HTMLFormElement>(
      "form[data-exam-editor]",
    );
    running.current = true;
    setBusy(true);
    setError(null);
    setPending(command);
    journalSet(scope, command);
    try {
      const result = await examMutate<T>(command);
      journalSet(scope, null);
      if (editor) delete editor.dataset.examDirty;
      if (
        command.method === "DELETE" &&
        /^\/api\/exams\/\d+$/.test(command.path)
      )
        document
          .querySelectorAll<HTMLElement>("[data-exam-dirty]")
          .forEach((form) => {
            delete form.dataset.examDirty;
          });
      if (mounted.current) {
        setPending(null);
        setUncertain(false);
        callback.current(result);
      }
    } catch (err) {
      if (mounted.current) {
        const unknownOutcome = isUncertain(err);
        setError(err instanceof Error ? err : new Error("Ошибка запроса"));
        setUncertain(unknownOutcome);
        if (!unknownOutcome) {
          setPending(null);
          journalSet(scope, null);
        }
      }
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return {
    busy,
    error,
    uncertain,
    pending,
    execute: (command: NewCommand) => {
      if (uncertain || running.current) return Promise.resolve();
      return perform({
        ...command,
        key: crypto.randomUUID(),
        createdAt: Date.now(),
      });
    },
    retry: () => (pending ? perform(pending) : Promise.resolve()),
    dismiss: () => {
      if (!busy) {
        journalSet(scope, null);
        setPending(null);
        setUncertain(false);
        setError(null);
      }
    },
  };
}

export function useExamNavigation() {
  const [params, setParams] = useState<URLSearchParams | null>(null);
  useEffect(() => {
    const read = () => setParams(new URLSearchParams(window.location.search));
    const bootstrap = window.requestAnimationFrame(read);
    window.addEventListener("popstate", read);
    return () => {
      window.cancelAnimationFrame(bootstrap);
      window.removeEventListener("popstate", read);
    };
  }, []);
  const navigate = (changes: Record<string, string | number | null>) => {
    if (
      document.querySelector("[data-exam-dirty='true']") &&
      !window.confirm("Есть несохранённые изменения. Перейти без сохранения?")
    )
      return;
    const query = updateExamQuery(
      new URLSearchParams(window.location.search),
      changes,
    );
    window.history.pushState(
      null,
      "",
      `${window.location.pathname}${query.size ? `?${query}` : ""}`,
    );
    setParams(query);
  };
  const id = (key: string) => {
    const raw = params?.get(key);
    return raw && /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw))
      ? Number(raw)
      : null;
  };
  return { params, navigate, id, initialized: params !== null };
}
