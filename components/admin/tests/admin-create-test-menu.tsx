"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import { cn } from "@/lib/cn";
import { FilePlus2, Link2, Plus } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

interface AdminCreateTestMenuProps {
  onCreateTest: () => void;
  onCreateExternal: () => void;
}

export function AdminCreateTestMenu({
  onCreateTest,
  onCreateExternal,
}: AdminCreateTestMenuProps) {
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
        aria-label="Создать"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Создать"
        onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
          event.preventDefault();
          setOpen((v) => !v);
        }}
      >
        <Plus size={20} strokeWidth={2.4} aria-hidden />
      </button>

      {open ? (
        <div
          className={styles.createMicroMenu}
          role="menu"
          aria-label="Создать"
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
        >
          <button
            type="button"
            role="menuitem"
            className={styles.editMicroItem}
            onClick={() => {
              setOpen(false);
              onCreateTest();
            }}
          >
            <span className={cn(styles.editMicroIcon, styles.editMicroIconAccent)}>
              <FilePlus2 size={14} aria-hidden />
            </span>
            Тест в системе
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.editMicroItem}
            onClick={() => {
              setOpen(false);
              onCreateExternal();
            }}
          >
            <span className={styles.editMicroIcon}>
              <Link2 size={14} aria-hidden />
            </span>
            Вне системы
          </button>
        </div>
      ) : null}
    </div>
  );
}
