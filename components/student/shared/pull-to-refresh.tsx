"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowDown, LoaderCircle } from "lucide-react";
import styles from "./pull-to-refresh.module.css";

export function usePullToRefresh(ref: RefObject<HTMLElement | null>, { disabled = false, loading, onRefresh }: { disabled?: boolean; loading: boolean; onRefresh: () => void }) {
  const [distance, setDistance] = useState(0);
  const locked = useRef(false);
  const options = useRef({ disabled, loading, onRefresh });
  useEffect(() => {
    options.current = { disabled, loading, onRefresh };
    if (!loading && locked.current) { locked.current = false; const frame = window.requestAnimationFrame(() => setDistance(0)); return () => window.cancelAnimationFrame(frame); }
  }, [disabled, loading, onRefresh]);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let start: { x: number; y: number } | null = null;
    let pulled = 0;
    const reset = () => { start = null; pulled = 0; setDistance(0); };
    const begin = (event: TouchEvent) => {
      if (event.touches.length !== 1 || element.scrollTop > 0 || options.current.disabled || options.current.loading || locked.current || (event.target as Element).closest("input,textarea,select,[contenteditable=true]")) return;
      start = { x: event.touches[0].clientX, y: event.touches[0].clientY }; pulled = 0;
    };
    const move = (event: TouchEvent) => {
      if (!start) return;
      if (event.touches.length !== 1 || options.current.disabled || element.scrollTop > 0) { reset(); return; }
      const dx = Math.abs(event.touches[0].clientX - start.x), dy = event.touches[0].clientY - start.y;
      if (dy < 0 || dx > Math.abs(dy)) { reset(); return; }
      if (dy < 8) return;
      if (!event.cancelable) { reset(); return; }
      event.preventDefault(); pulled = Math.min(84, dy * .5); setDistance(pulled);
    };
    const end = () => {
      const refresh = pulled >= 56 && !locked.current && !options.current.disabled && !options.current.loading;
      reset();
      if (refresh) { locked.current = true; setDistance(48); options.current.onRefresh(); }
    };
    element.addEventListener("touchstart", begin, { passive: true });
    element.addEventListener("touchmove", move, { passive: false });
    element.addEventListener("touchend", end);
    element.addEventListener("touchcancel", reset);
    return () => { element.removeEventListener("touchstart", begin); element.removeEventListener("touchmove", move); element.removeEventListener("touchend", end); element.removeEventListener("touchcancel", reset); };
  }, [ref]);
  return distance;
}

export function PullRefreshIndicator({ distance, loading }: { distance: number; loading: boolean }) {
  return <div className={styles.indicator} style={{ height: loading ? 48 : distance }} aria-hidden={!distance && !loading}>
    {loading ? <span role="status" aria-label="Обновление списка"><LoaderCircle size={23} className={styles.spinner}/></span> : distance > 0 ? <ArrowDown size={23} style={{ transform: distance >= 56 ? "rotate(180deg)" : "none" }}/> : null}
  </div>;
}
