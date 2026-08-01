"use client";

import styles from "@/components/schedule/schedule.module.css";
import { Clock3 } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parseTime(value: string): { hour: number; minute: number } {
  const [hRaw, mRaw] = (value || "09:00").split(":");
  const hour = Math.min(23, Math.max(0, Number(hRaw) || 0));
  const minute = Math.min(59, Math.max(0, Number(mRaw) || 0));
  return { hour, minute };
}

function snapMinute(minute: number): number {
  const snapped = Math.round(minute / 5) * 5;
  return snapped === 60 ? 55 : snapped;
}

function formatTime(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`;
}

interface TimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export function TimeField({ label, value, onChange, required }: TimeFieldProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const parsed = parseTime(value);
  const activeMinute = snapMinute(parsed.minute);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const width = Math.min(220, Math.max(rect.width, 180));
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < 280 && rect.top > spaceBelow;
      const left = Math.min(
        Math.max(8, rect.left),
        window.innerWidth - width - 8,
      );

      setPopoverStyle({
        position: "fixed",
        left,
        width,
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
        zIndex: 120,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const itemHeight = 36;
    const scrollTo = (el: HTMLDivElement | null, index: number) => {
      if (!el) return;
      el.scrollTop = Math.max(0, index * itemHeight - itemHeight);
    };
    const hourIndex = HOURS.indexOf(parsed.hour);
    const minuteIndex = MINUTES.indexOf(activeMinute);
    requestAnimationFrame(() => {
      scrollTo(hourListRef.current, hourIndex);
      scrollTo(minuteListRef.current, minuteIndex >= 0 ? minuteIndex : 0);
    });
  }, [open, parsed.hour, activeMinute]);

  const setHour = (hour: number) => {
    onChange(formatTime(hour, activeMinute));
  };

  const setMinute = (minute: number) => {
    onChange(formatTime(parsed.hour, minute));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (
      !open &&
      (event.key === "ArrowDown" ||
        event.key === "Enter" ||
        event.key === " ")
    ) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  const popover =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popoverRef}
            className={styles.timePopover}
            style={popoverStyle}
            role="dialog"
            aria-label={label}
          >
            <div className={styles.timeColumns}>
              <div className={styles.timeCol}>
                <div className={styles.timeColLabel}>Часы</div>
                <div className={styles.timeWheel} ref={hourListRef}>
                  {HOURS.map((hour) => (
                    <button
                      key={hour}
                      type="button"
                      className={`${styles.timeWheelItem} ${
                        hour === parsed.hour ? styles.timeWheelItemActive : ""
                      }`}
                      onClick={() => setHour(hour)}
                    >
                      {pad(hour)}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.timeColon} aria-hidden>
                :
              </div>
              <div className={styles.timeCol}>
                <div className={styles.timeColLabel}>Минуты</div>
                <div className={styles.timeWheel} ref={minuteListRef}>
                  {MINUTES.map((minute) => (
                    <button
                      key={minute}
                      type="button"
                      className={`${styles.timeWheelItem} ${
                        minute === activeMinute ? styles.timeWheelItemActive : ""
                      }`}
                      onClick={() => setMinute(minute)}
                    >
                      {pad(minute)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              className={styles.timeDoneBtn}
              onClick={() => setOpen(false)}
            >
              Готово
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={styles.timeField} ref={rootRef}>
      <span className={styles.fieldLabel} id={`${listboxId}-label`}>
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.timeTrigger} ${open ? styles.timeTriggerOpen : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={`${listboxId}-label`}
        aria-required={required}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
      >
        <span className={styles.timeTriggerIcon}>
          <Clock3 size={15} strokeWidth={2.25} />
        </span>
        <span className={styles.timeTriggerValue}>
          {formatTime(parsed.hour, parsed.minute)}
        </span>
      </button>
      {popover}
    </div>
  );
}
