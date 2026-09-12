"use client";

import { useEffect, useRef, type RefObject } from "react";

const dialogs: symbol[] = [];
let savedOverflow = "";

/** Nested homework screens share one scroll lock and only the top screen handles keys. */
export function useHomeworkDialog(ref: RefObject<HTMLElement | null>, close: () => void, enabled = true) {
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; }, [close]);
  useEffect(() => {
    if (!enabled) return;
    const id = Symbol("homework-dialog");
    const previousFocus = document.activeElement as HTMLElement | null;
    if (!dialogs.length) { savedOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
    dialogs.push(id);
    const element = ref.current;
    const focus = window.setTimeout(() => element?.focus(), 0);
    const keydown = (event: KeyboardEvent) => {
      if (dialogs.at(-1) !== id) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key !== "Tab" || !element) return;
      const focusable = Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(node => node.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (!first) { event.preventDefault(); element.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      window.clearTimeout(focus);
      document.removeEventListener("keydown", keydown);
      const index = dialogs.indexOf(id); if (index >= 0) dialogs.splice(index, 1);
      if (!dialogs.length) document.body.style.overflow = savedOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [enabled, ref]);
}
