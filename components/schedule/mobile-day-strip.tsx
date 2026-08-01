"use client";

import styles from "@/components/schedule/schedule.module.css";
import { addDaysISO, todayISO } from "@/lib/schedule/utils";
import { useEffect, useRef } from "react";

interface MobileDayStripProps {
  selectedDate: string;
  onSelectDate: (dateISO: string) => void;
}

export function MobileDayStrip({
  selectedDate,
  onSelectDate,
}: MobileDayStripProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const today = todayISO();
  const start = addDaysISO(selectedDate, -14);
  const days = Array.from({ length: 29 }, (_, index) =>
    addDaysISO(start, index),
  );

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const active = root.querySelector<HTMLElement>(
      `[data-date="${selectedDate}"]`,
    );
    active?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [selectedDate]);

  return (
    <div className={styles.dayStrip} ref={scrollerRef}>
      {days.map((dateISO) => {
        const date = new Date(
          Number(dateISO.slice(0, 4)),
          Number(dateISO.slice(5, 7)) - 1,
          Number(dateISO.slice(8, 10)),
        );
        const weekday = new Intl.DateTimeFormat("ru-RU", {
          weekday: "short",
        }).format(date);
        const dayNum = date.getDate();
        const isSelected = dateISO === selectedDate;
        const isToday = dateISO === today;

        return (
          <button
            key={dateISO}
            type="button"
            data-date={dateISO}
            className={`${styles.dayStripItem} ${isSelected ? styles.dayStripItemActive : ""} ${isToday && !isSelected ? styles.dayStripItemToday : ""}`}
            onClick={() => onSelectDate(dateISO)}
          >
            <span className={styles.dayStripWeekday}>{weekday}</span>
            <span className={styles.dayStripDay}>{dayNum}</span>
          </button>
        );
      })}
    </div>
  );
}
