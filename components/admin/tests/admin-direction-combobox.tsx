"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import type { Direction } from "@/lib/admin/admin-tests-types";
import { cn } from "@/lib/cn";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

interface AdminDirectionComboboxProps {
  directions: Direction[];
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
  loading?: boolean;
}

export function AdminDirectionCombobox({
  directions,
  value,
  onChange,
  disabled = false,
  loading = false,
}: AdminDirectionComboboxProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return directions;
    return directions.filter((d) => d.name.toLowerCase().includes(q));
  }, [directions, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const idx = filtered.findIndex((d) => d.name === value);
    setActiveIndex(idx >= 0 ? idx : 0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, filtered, value]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery("");
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      setOpen(true);
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = filtered[activeIndex];
      if (item) select(item.name);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  const displayLabel = value || (loading ? "Загрузка…" : "Выберите направление");

  return (
    <div className={styles.comboRoot} ref={rootRef}>
      <span className={styles.toolbarLabel} id={`${listboxId}-label`}>
        Направление
      </span>
      <button
        type="button"
        className={cn(styles.comboTrigger, open && styles.comboTriggerOpen)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${listboxId}-label`}
        aria-controls={listboxId}
        disabled={disabled || loading || directions.length === 0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={styles.comboTriggerText}>{displayLabel}</span>
        <ChevronDown
          size={16}
          className={cn(styles.comboChevron, open && styles.comboChevronOpen)}
          aria-hidden
        />
      </button>

      {open ? (
        <div className={styles.comboDropdown} role="presentation">
          <label className={styles.comboSearch}>
            <Search size={14} aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Найти направление…"
              aria-autocomplete="list"
              aria-controls={listboxId}
            />
          </label>
          <div
            id={listboxId}
            role="listbox"
            aria-labelledby={`${listboxId}-label`}
            className={styles.comboList}
          >
            {filtered.length === 0 ? (
              <p className={styles.comboEmpty}>Ничего не найдено</p>
            ) : (
              filtered.map((d, index) => {
                const selected = d.name === value;
                const active = index === activeIndex;
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={cn(
                      styles.comboOption,
                      active && styles.comboOptionActive,
                      selected && styles.comboOptionSelected,
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(d.name)}
                  >
                    <span className={styles.comboOptionLabel}>{d.name}</span>
                    {selected ? (
                      <Check size={15} className={styles.comboOptionCheck} />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
