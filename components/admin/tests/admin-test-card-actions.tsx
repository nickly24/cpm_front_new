"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import { cn } from "@/lib/cn";
import {
  ExternalLink,
  FilePenLine,
  Pencil,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

interface AdminTestCardActionsProps {
  external?: boolean;
  onOpen?: () => void;
  onEditClassic?: () => void;
  onEditNew?: () => void;
  onDelete: () => void;
}

export function AdminTestCardActions({
  external = false,
  onOpen,
  onEditClassic,
  onEditNew,
  onDelete,
}: AdminTestCardActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
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
    setMenuOpen(true);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setMenuOpen(false), 140);
  };

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(
    () => () => {
      clearCloseTimer();
    },
    [],
  );

  if (external) {
    return (
      <div className={styles.listCardActions}>
        <button
          type="button"
          className={cn(styles.iconAction, styles.iconActionDanger)}
          aria-label="Удалить"
          title="Удалить"
          onClick={onDelete}
        >
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className={styles.listCardActions}>
      <button
        type="button"
        className={styles.openBtn}
        onClick={onOpen}
      >
        <ExternalLink size={14} aria-hidden />
        Открыть
      </button>

      <div
        className={styles.editMenuWrap}
        ref={wrapRef}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
      >
        <button
          type="button"
          className={cn(styles.iconAction, menuOpen && styles.iconActionActive)}
          aria-label="Редактировать"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          title="Редактировать"
          onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            setMenuOpen((v) => !v);
          }}
        >
          <Pencil size={16} aria-hidden />
        </button>

        {menuOpen ? (
          <div
            className={styles.editMicroMenu}
            role="menu"
            aria-label="Вариант редактирования"
            onMouseEnter={openMenu}
            onMouseLeave={scheduleClose}
          >
            <button
              type="button"
              role="menuitem"
              className={styles.editMicroItem}
              onClick={() => {
                setMenuOpen(false);
                onEditClassic?.();
              }}
            >
              <span className={styles.editMicroIcon}>
                <FilePenLine size={14} aria-hidden />
              </span>
              Старый редактор
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.editMicroItem}
              onClick={() => {
                setMenuOpen(false);
                onEditNew?.();
              }}
            >
              <span className={cn(styles.editMicroIcon, styles.editMicroIconAccent)}>
                <Wand2 size={14} aria-hidden />
              </span>
              Новый интерфейс
            </button>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className={cn(styles.iconAction, styles.iconActionDanger)}
        aria-label="Удалить"
        title="Удалить"
        onClick={onDelete}
      >
        <Trash2 size={16} aria-hidden />
      </button>
    </div>
  );
}
