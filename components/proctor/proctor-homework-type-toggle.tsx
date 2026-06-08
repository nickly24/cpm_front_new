"use client";

import type { ProctorHomeworkTypeFilter } from "@/lib/proctor/proctor-types";
import { BookOpen, ClipboardList, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import styles from "./proctor.module.css";

const TYPE_OPTIONS: {
  value: ProctorHomeworkTypeFilter;
  label: string;
  icon: LucideIcon;
  activeClass?: string;
}[] = [
  { value: "all", label: "Все", icon: Layers },
  { value: "ДЗНВ", label: "ДЗНВ", icon: ClipboardList, activeClass: styles.typeToggleBtnDznv },
  { value: "ОВ", label: "ОВ", icon: BookOpen, activeClass: styles.typeToggleBtnOv },
];

interface ProctorHomeworkTypeToggleProps {
  value: ProctorHomeworkTypeFilter;
  onChange: (value: ProctorHomeworkTypeFilter) => void;
}

export function ProctorHomeworkTypeToggle({
  value,
  onChange,
}: ProctorHomeworkTypeToggleProps) {
  return (
    <div className={styles.typeToggleField}>
      <span className={styles.filterLabel} id="proctor-hw-type-label">
        Тип задания
      </span>
      <div
        className={styles.typeToggle}
        role="tablist"
        aria-labelledby="proctor-hw-type-label"
      >
        {TYPE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              className={`${styles.typeToggleBtn} ${
                active ? styles.typeToggleBtnActive : ""
              } ${active && option.activeClass ? option.activeClass : ""}`.trim()}
              onClick={() => onChange(option.value)}
            >
              <Icon size={15} aria-hidden />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
