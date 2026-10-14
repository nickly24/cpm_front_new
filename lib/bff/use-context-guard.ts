"use client";
import { useEffect } from "react";
import { BFF_DEV } from "@/lib/config";
/** Keep context fixed while an editor or local file transfer is open, across tabs. */
export function useContextGuard(active: boolean) {
  useEffect(() => {
    if (!BFF_DEV || !active) return;
    let disposed = false;
    let release = () => {};
    const controller = new AbortController();
    void navigator.locks?.request("cpm-bff-context", { mode: "shared", signal: controller.signal }, () => {
      // Aborting cannot revoke a lock already granted before React's cleanup.
      if (disposed) return;
      return new Promise<void>(resolve => { release = resolve; });
    }).catch(() => {});
    const before = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", before);
    return () => { disposed = true; controller.abort(); release(); window.removeEventListener("beforeunload", before); };
  }, [active]);
}
