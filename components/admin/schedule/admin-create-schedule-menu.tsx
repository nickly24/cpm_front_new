"use client";

import { EditOnly } from "@/components/admin/admin-section-access";

import styles from "@/components/schedule/schedule.module.css";
import { cn } from "@/lib/cn";
import { CalendarPlus, Plus, Table2 } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

interface AdminCreateScheduleMenuProps {
  onCreateLesson: () => void;
  onOpenTableEditor: () => void;
  disabled?: boolean;
}

export function AdminCreateScheduleMenu({
  onCreateLesson,
  onOpenTableEditor,
  disabled = false,
}: AdminCreateScheduleMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  const clearCloseTimer = () => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openMenu = () => {
    if (disabled) return;
    clearCloseTimer();
    setOpen(true);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(
    () => () => {
      clearCloseTimer();
    },
    [],
  );

  return (
    <div
      className={styles.createMenuWrap}
      ref={wrapRef}
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={cn(styles.createPlusBtn, open && styles.createPlusBtnOpen)}
        aria-label="Добавить"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Добавить"
        disabled={disabled}
        onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
          event.preventDefault();
          if (disabled) return;
          setOpen((v) => !v);
        }}
      >
        <Plus size={20} strokeWidth={2.4} aria-hidden />
      </button>

      {open ? (
        <div
          className={styles.createMicroMenu}
          role="menu"
          aria-label="Добавить"
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
        >
          <EditOnly><button
            type="button"
            role="menuitem"
            className={styles.createMicroItem}
            onClick={() => {
              setOpen(false);
              onCreateLesson();
            }}
          >
            <span
              className={cn(styles.createMicroIcon, styles.createMicroIconAccent)}
            >
              <CalendarPlus size={14} aria-hidden />
            </span>
            Добавить занятие
          </button></EditOnly>
          <button
            type="button"
            role="menuitem"
            className={styles.createMicroItem}
            onClick={() => {
              setOpen(false);
              onOpenTableEditor();
            }}
          >
            <span
              className={cn(styles.createMicroIcon, styles.createMicroIconExcel)}
            >
              <Table2 size={14} aria-hidden />
            </span>
            Табличная форма
          </button>
        </div>
      ) : null}
    </div>
  );
}
