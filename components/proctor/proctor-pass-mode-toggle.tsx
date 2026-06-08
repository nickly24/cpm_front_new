"use client";

import { Calculator, PenLine } from "lucide-react";
import styles from "./proctor.module.css";

export type ProctorPassMode = "auto" | "manual";

interface ProctorPassModeToggleProps {
  value: ProctorPassMode;
  onChange: (value: ProctorPassMode) => void;
  label?: string;
}

const MODE_OPTIONS: {
  value: ProctorPassMode;
  label: string;
  icon: typeof Calculator;
}[] = [
  { value: "auto", label: "Авто-балл", icon: Calculator },
  { value: "manual", label: "Свой балл", icon: PenLine },
];

export function ProctorPassModeToggle({
  value,
  onChange,
  label = "Способ выставления",
}: ProctorPassModeToggleProps) {
  return (
    <div className={styles.passModeField}>
      <span className={styles.filterLabel}>{label}</span>
      <div className={styles.passModeToggle} role="tablist" aria-label={label}>
        {MODE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              className={`${styles.passModeBtn} ${
                active ? styles.passModeBtnActive : ""
              }`.trim()}
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
