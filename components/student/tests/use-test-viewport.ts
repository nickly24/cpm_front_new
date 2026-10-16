"use client";

import { useCallback, useEffect, useRef } from "react";

/** Keep the test inside the visible viewport when a phone opens its keyboard. */
export function useTestViewport() {
  const root = useRef<HTMLDivElement | null>(null);
  const frame = useRef<number | null>(null);
  const update = useCallback(() => {
    const element = root.current;
    if (!element) return;
    const viewport = window.visualViewport;
    const mobile = window.matchMedia("(max-width: 768px), (max-height: 500px) and (pointer: coarse)").matches;
    element.style.height = mobile && viewport ? `${viewport.height}px` : "100dvh";
    element.style.top = mobile && viewport ? `${viewport.offsetTop}px` : "0px";
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    frame.current = window.requestAnimationFrame(() => {
      const input = document.activeElement;
      const editing = (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) && element.contains(input);
      element.dataset.compactInput = String(mobile && editing && (viewport?.height ?? window.innerHeight) < 360);
      if (!mobile || !editing) return;
      const scroller = input.closest<HTMLElement>("[data-test-scroll]");
      if (!scroller) return;
      const field = input.getBoundingClientRect();
      const area = scroller.getBoundingClientRect();
      const available = area.height - 24;
      if (field.top < area.top + 12 || field.height > available) scroller.scrollTop += field.top - area.top - 12;
      else if (field.bottom > area.bottom - 12) scroller.scrollTop += field.bottom - area.bottom + 12;
    });
  }, []);
  const overlayRef = useCallback((element: HTMLDivElement | null) => {
    root.current = element;
    if (element) {
      update();
      if (!element.contains(document.activeElement)) element.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    }
  }, [update]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const viewport = window.visualViewport;
    const trapFocus = (event: KeyboardEvent) => {
      const element = root.current;
      if (event.key !== "Tab" || !element || element.querySelector("dialog[open]")) return;
      const scope = element.querySelector<HTMLElement>("[data-test-modal]") ?? element;
      const controls = [...scope.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), input:not(:disabled), summary, [tabindex="0"]')].filter(control => control.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) return;
      if (!scope.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    document.addEventListener("keydown", trapFocus);
    update();
    return () => {
      document.body.style.overflow = previous;
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      document.removeEventListener("keydown", trapFocus);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, [update]);
  return overlayRef;
}
