"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { examGet } from "./api";
import type { AttemptDigest } from "./types";

/** Only the visible active workspace polls; lists and protocols remain demand-loaded. */
export function useAttemptSync({ path, stateVersion, ovRevision, workspaceRevision, suspended, onChange }: {
  path: string | null;
  stateVersion: number;
  ovRevision: number;
  workspaceRevision?: string;
  suspended: boolean;
  onChange: () => void;
}) {
  const latest = useRef({ stateVersion, ovRevision, workspaceRevision, onChange });
  const observedWorkspace = useRef<{ path: string; revision: string } | null>(null);
  useEffect(() => { latest.current = { stateVersion, ovRevision, workspaceRevision, onChange }; });
  const [status, setStatus] = useState<{ path: string; error: Error | null; checkedAt: string | null } | null>(null);
  useEffect(() => {
    if (!path || suspended) return;
    let stopped = false;
    let request: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const schedule = () => {
      if (stopped || document.visibilityState === "hidden") return;
      timer = setTimeout(poll, Math.min(30000, 3000 * 2 ** failures) + Math.floor(Math.random() * 400));
    };
    const poll = async () => {
      if (stopped || request || document.visibilityState === "hidden") return;
      const controller = new AbortController();
      request = controller;
      try {
        const data = await examGet<AttemptDigest>(path, {}, controller.signal);
        if (stopped || controller.signal.aborted) return;
        failures = 0;
        setStatus({ path, error: null, checkedAt: data.serverNow });
        const priorWorkspace = latest.current.workspaceRevision ?? (observedWorkspace.current?.path === path ? observedWorkspace.current.revision : undefined);
        const workspaceChanged = data.workspaceRevision !== undefined && data.workspaceRevision !== priorWorkspace;
        // During a rolling update an old workspace may omit this token. Remember the
        // digest after the first refresh so an unchanged response cannot cause a loop.
        if (data.workspaceRevision !== undefined) observedWorkspace.current = { path, revision: data.workspaceRevision };
        if (data.stateVersion > latest.current.stateVersion || data.ovRevision > latest.current.ovRevision || workspaceChanged) latest.current.onChange();
      } catch (error) {
        if (stopped || controller.signal.aborted) return;
        failures = Math.min(failures + 1, 4);
        setStatus(previous => ({ path, checkedAt: previous?.path === path ? previous.checkedAt : null, error: error instanceof Error ? error : new Error("Не удалось проверить обновления") }));
        // A lost permission is not retried forever against the same inaccessible object.
        if (error instanceof ApiError && [401, 403, 404].includes(error.status ?? 0)) stopped = true;
      } finally {
        request = null;
        schedule();
      }
    };
    const visibility = () => {
      clearTimeout(timer);
      if (document.visibilityState === "hidden") request?.abort();
      else if (!request) void poll();
    };
    document.addEventListener("visibilitychange", visibility);
    schedule();
    return () => {
      stopped = true;
      clearTimeout(timer);
      request?.abort();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [path, suspended]);
  return {
    error: status?.path === path ? status.error : null,
    checkedAt: status?.path === path ? status.checkedAt : null,
  };
}
