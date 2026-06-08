"use client";

import styles from "@/components/ui/option-select.module.css";
import { cn } from "@/lib/cn";
import { Check, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type OptionTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "info";

export interface OptionSelectItem<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
  icon: LucideIcon;
  tone?: OptionTone;
}

interface OptionSelectProps<T extends string | number> {
  label: string;
  value: T;
  options: OptionSelectItem<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  dropdownClassName?: string;
}

const TONE_CLASS: Record<OptionTone, string> = {
  neutral: styles.iconNeutral,
  accent: styles.iconAccent,
  success: styles.iconSuccess,
  warning: styles.iconWarning,
  info: styles.iconInfo,
};

export function OptionSelect<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className,
  dropdownClassName,
}: OptionSelectProps<T>) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selected =
    options.find((option) => option.value === value) ?? options[0];
  const SelectedIcon = selected?.icon;
  const selectedTone = selected?.tone ?? "neutral";

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

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  const selectOption = (nextValue: T) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

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

  if (!selected || !SelectedIcon) {
    return null;
  }

  return (
    <div className={cn(styles.field, className)} ref={containerRef}>
      <span className={styles.label} id={`${listboxId}-label`}>
        {label}
      </span>

      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ""} ${
          disabled ? styles.triggerDisabled : ""
        }`.trim()}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${listboxId}-label`}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleKeyDown}
      >
        <span
          className={`${styles.triggerIcon} ${TONE_CLASS[selectedTone]}`.trim()}
        >
          <SelectedIcon size={16} />
        </span>
        <span className={styles.triggerText}>{selected.label}</span>
        <ChevronDown
          size={16}
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`.trim()}
        />
      </button>

      {isOpen ? (
        <div
          className={cn(styles.dropdown, dropdownClassName)}
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
                key={String(option.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`${styles.option} ${
                  isActive ? styles.optionActive : ""
                } ${isSelected ? styles.optionSelected : ""}`.trim()}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option.value)}
              >
                <span
                  className={`${styles.optionIcon} ${TONE_CLASS[tone]}`.trim()}
                >
                  <Icon size={16} />
                </span>

                <span className={styles.optionText}>
                  <span className={styles.optionLabel}>{option.label}</span>
                  {option.hint ? (
                    <span className={styles.optionHint}>{option.hint}</span>
                  ) : null}
                </span>

                {isSelected ? (
                  <Check size={16} className={styles.optionCheck} />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
