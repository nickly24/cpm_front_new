"use client";

import styles from "@/components/student/homework/homework.module.css";
import { Check, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type FilterOptionTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "info";

export interface HomeworkFilterOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  icon: LucideIcon;
  tone?: FilterOptionTone;
}

interface HomeworkFilterSelectProps<T extends string> {
  label: string;
  value: T;
  options: HomeworkFilterOption<T>[];
  onChange: (value: T) => void;
}

const TONE_CLASS: Record<FilterOptionTone, string> = {
  neutral: styles.filterIconNeutral,
  accent: styles.filterIconAccent,
  success: styles.filterIconSuccess,
  warning: styles.filterIconWarning,
  info: styles.filterIconInfo,
};

export function HomeworkFilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: HomeworkFilterSelectProps<T>) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selected =
    options.find((option) => option.value === value) ?? options[0];
  const SelectedIcon = selected.icon;
  const selectedTone = selected.tone ?? "neutral";

  useEffect(() => {
    const selectedIndex = options.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [options, value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectOption = (nextValue: T) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!isOpen) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, options.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectOption(options[activeIndex].value);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div className={styles.filterField} ref={containerRef}>
      <span className={styles.fieldLabel} id={`${listboxId}-label`}>
        {label}
      </span>

      <button
        type="button"
        className={`${styles.filterTrigger} ${isOpen ? styles.filterTriggerOpen : ""}`.trim()}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${listboxId}-label`}
        aria-controls={listboxId}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleKeyDown}
      >
        <span
          className={`${styles.filterTriggerIcon} ${TONE_CLASS[selectedTone]}`.trim()}
        >
          <SelectedIcon size={16} />
        </span>
        <span className={styles.filterTriggerText}>{selected.label}</span>
        <ChevronDown
          size={16}
          className={`${styles.filterChevron} ${isOpen ? styles.filterChevronOpen : ""}`.trim()}
        />
      </button>

      {isOpen ? (
        <div
          className={styles.filterDropdown}
          id={listboxId}
          role="listbox"
          aria-labelledby={`${listboxId}-label`}
        >
          {options.map((option, index) => {
            const Icon = option.icon;
            const tone = option.tone ?? "neutral";
            const isSelected = option.value === value;
            const isActive = index === activeIndex;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`${styles.filterOption} ${
                  isActive ? styles.filterOptionActive : ""
                } ${isSelected ? styles.filterOptionSelected : ""}`.trim()}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option.value)}
              >
                <span
                  className={`${styles.filterOptionIcon} ${TONE_CLASS[tone]}`.trim()}
                >
                  <Icon size={16} />
                </span>

                <span className={styles.filterOptionText}>
                  <span className={styles.filterOptionLabel}>{option.label}</span>
                  {option.hint ? (
                    <span className={styles.filterOptionHint}>{option.hint}</span>
                  ) : null}
                </span>

                {isSelected ? (
                  <Check size={16} className={styles.filterOptionCheck} />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
