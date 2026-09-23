"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import styles from "./filter-popover.module.css";

interface FilterPopoverProps {
  children: ReactNode;
  activeCount?: number;
  onReset?: () => void;
  title?: string;
  className?: string;
}

/** A shared filter sheet. Values apply immediately through the existing fields. */
export function FilterPopover({
  children,
  activeCount = 0,
  onReset,
  title = "Фильтры",
  className,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const backdropStart = useRef(false);

  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    const triggerElement = trigger.current;
    const position = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      if (!anchor) return;
      const width = Math.min(460, window.innerWidth - 32);
      element.style.setProperty("--filter-left", `${Math.max(16, Math.min(anchor.right - width, window.innerWidth - width - 16))}px`);
      element.style.setProperty("--filter-top", `${Math.max(16, Math.min(anchor.bottom + 10, window.innerHeight - element.getBoundingClientRect().height - 16))}px`);
    };
    element.showModal();
    position();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", position);
    const observer = new ResizeObserver(position);
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      document.body.style.overflow = previousOverflow;
      element.close();
      triggerElement?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <div className={cn(styles.root, className)}>
      <button
        ref={trigger}
        type="button"
        className={cn(styles.trigger, activeCount > 0 && styles.active)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal size={17} aria-hidden="true" />
        <span>{title}</span>
        {activeCount > 0 && <span className={styles.count}>{activeCount}</span>}
      </button>
      {open && createPortal(
        <dialog
          ref={dialog}
          id={id}
          className={styles.dialog}
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-hint`}
          onCancel={(event) => { event.preventDefault(); setOpen(false); }}
          onClose={() => setOpen(false)}
          onPointerDown={(event) => { backdropStart.current = event.target === event.currentTarget; }}
          onPointerUp={(event) => {
            if (backdropStart.current && event.target === event.currentTarget && event.button === 0) {
              const rect = event.currentTarget.getBoundingClientRect();
              if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOpen(false);
            }
            backdropStart.current = false;
          }}
        >
          <header className={styles.header}>
            <div>
              <h2 id={`${id}-title`}>{title}</h2>
              <p id={`${id}-hint`}>Список обновляется при выборе параметров</p>
            </div>
            <button type="button" className={styles.close} aria-label="Закрыть фильтры" onClick={() => setOpen(false)}>
              <X size={19} aria-hidden="true" />
            </button>
          </header>
          <div className={styles.fields}>{children}</div>
          <footer className={styles.footer}>
            {onReset && <button type="button" className={styles.reset} disabled={activeCount === 0} onClick={onReset}>Сбросить</button>}
            <button type="button" className={styles.done} onClick={() => setOpen(false)}>Готово</button>
          </footer>
        </dialog>,
        document.body,
      )}
    </div>
  );
}
