"use client";
import { useHomeworkTypes } from "@/lib/bff/use-homework-types";
import { BFF_DEV } from "@/lib/config";

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
  const {names,error} = useHomeworkTypes();
  const options = BFF_DEV ? [{value:"all",label:"Все",icon:Layers},...names.map(name=>({value:name,label:name,icon:BookOpen}))] : TYPE_OPTIONS;
  return (
    <div className={styles.typeToggleField}>
      {error ? <p role="alert">{error}</p> : null}
      <span className={styles.filterLabel} id="proctor-hw-type-label">
        Тип задания
      </span>
      <div
        className={styles.typeToggle}
        role="tablist"
        aria-labelledby="proctor-hw-type-label"
      >
        {options.map((option) => {
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
              } ${active && "activeClass" in option && option.activeClass ? option.activeClass : ""}`.trim()}
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
