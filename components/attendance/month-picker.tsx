"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { MONTH_NAMES } from "@/lib/attendance/attendance-utils";
import styles from "./month-picker.module.css";

interface MonthPickerProps {
  value: string;
  onChange: (month: string) => void;
  monthsWithData?: string[];
  inline?: boolean;
}

export function MonthPicker({ value, onChange, monthsWithData, inline = false }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [visibleYear, setVisibleYear] = useState(Number(value.slice(0, 4)));
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const label = `${MONTH_NAMES[month - 1]} ${year}`;
  const close = () => { setOpen(false); trigger.current?.focus(); };

  useEffect(() => {
    if (!open || inline) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    root.current?.querySelector<HTMLButtonElement>('[data-selected="true"]')?.focus();
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, inline]);

  function stepMonth(delta: number) {
    const date = new Date(year, month - 1 + delta, 1);
    onChange(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    setOpen(false);
  }

  return <div className={styles.root} ref={root} onKeyDown={event => {
    if (event.key === "Escape" && open && !inline) { event.preventDefault(); event.stopPropagation(); close(); }
  }} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    {!inline && <div className={styles.control}>
      <button type="button" className={styles.step} aria-label="Предыдущий месяц" onClick={() => stepMonth(-1)}><ChevronLeft size={17} aria-hidden /></button>
      <button type="button" ref={trigger} className={styles.trigger} aria-label={`Выбрать месяц: ${label}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => { setVisibleYear(year); setOpen(current => !current); }}>
        <CalendarDays size={19} aria-hidden /><span>{label}</span><ChevronDown size={15} aria-hidden className={open ? styles.chevronOpen : undefined} />
      </button>
      <button type="button" className={styles.step} aria-label="Следующий месяц" onClick={() => stepMonth(1)}><ChevronRight size={17} aria-hidden /></button>
    </div>}
    {(open || inline) && <div id={panelId} className={`${styles.panel} ${inline ? styles.inlinePanel : ""}`} role={inline ? "group" : "dialog"} aria-label="Выбор месяца">
      <div className={styles.year}><button type="button" aria-label="Предыдущий год" onClick={() => setVisibleYear(current => current - 1)}><ChevronLeft size={18} aria-hidden /></button><strong aria-live="polite">{visibleYear}</strong><button type="button" aria-label="Следующий год" onClick={() => setVisibleYear(current => current + 1)}><ChevronRight size={18} aria-hidden /></button></div>
      <div className={styles.months}>
        {MONTH_NAMES.map((name, index) => {
          const key = `${visibleYear}-${String(index + 1).padStart(2, "0")}`;
          const selected = key === value;
          return <button key={key} type="button" data-selected={selected} aria-pressed={selected} aria-label={`${name} ${visibleYear}`} className={`${styles.month} ${selected ? styles.selected : ""}`} onClick={() => { onChange(key); close(); }} onKeyDown={event => {
            const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[event.key];
            if (delta == null) return;
            event.preventDefault();
            const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button");
            buttons?.[(index + delta + 12) % 12]?.focus();
          }}><span>{name}</span>{monthsWithData?.includes(key) && <i className={styles.dot} aria-label="Есть дни занятий" />}</button>;
        })}
      </div>
      {monthsWithData && <p className={styles.hint}><i className={styles.dot} aria-hidden />Есть дни занятий</p>}
    </div>}
  </div>;
}
