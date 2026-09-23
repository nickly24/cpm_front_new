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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selected =
    options.find((option) => option.value === value) ?? options[0];
  const SelectedIcon = selected?.icon;
  const selectedTone = selected?.tone ?? "neutral";

  // The browser's top layer keeps options visible inside scrollable filter sheets.
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;
    const dropdown = dropdownRef.current;
    const position = () => {
      const anchor = triggerRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const width = Math.min(Math.max(anchor.width, 240), window.innerWidth - 32);
      const below = window.innerHeight - anchor.bottom - 16;
      const above = anchor.top - 16;
      const openAbove = below < 240 && above > below;
      dropdown.style.width = `${width}px`;
      dropdown.style.left = `${Math.max(16, Math.min(anchor.left, window.innerWidth - width - 16))}px`;
      dropdown.style.maxHeight = `${Math.max(100, Math.min(320, openAbove ? above : below))}px`;
      dropdown.style.top = openAbove ? "auto" : `${anchor.bottom + 6}px`;
      dropdown.style.bottom = openAbove ? `${window.innerHeight - anchor.top + 6}px` : "auto";
    };
    dropdown.showPopover();
    position();
    window.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      document.removeEventListener("scroll", position, true);
      if (dropdown.matches(":popover-open")) dropdown.hidePopover();
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) dropdownRef.current?.querySelectorAll<HTMLElement>("[role=option]")[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

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

  if (disabled && isOpen) setIsOpen(false);

  const openOptions = () => {
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
    setIsOpen(true);
  };

  const selectOption = (nextValue: T) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === "Tab") {
      setIsOpen(false);
      return;
    }

    if (!isOpen) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        openOptions();
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
      if (options[activeIndex]) selectOption(options[activeIndex].value);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
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
        ref={triggerRef}
        type="button"
        role="combobox"
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ""} ${
          disabled ? styles.triggerDisabled : ""
        }`.trim()}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${listboxId}-label`}
        aria-controls={listboxId}
        aria-activedescendant={isOpen ? `${listboxId}-option-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => isOpen ? setIsOpen(false) : openOptions()}
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
          ref={dropdownRef}
          popover="manual"
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
                id={`${listboxId}-option-${index}`}
                tabIndex={-1}
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
