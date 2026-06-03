"use client";

import { cn } from "@/lib/cn";
import { useId } from "react";
import styles from "./toggle.module.css";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
  /** accent — оранжевый (по умолчанию), success — зелёный */
  variant?: "accent" | "success";
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  id,
  variant = "accent",
}: ToggleProps) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <label
      className={cn(
        styles.root,
        variant === "success" && styles.rootSuccess,
        disabled && styles.rootDisabled,
      )}
      htmlFor={inputId}
    >
      <input
        id={inputId}
        type="checkbox"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.track} aria-hidden />
      {label ? <span className={styles.label}>{label}</span> : null}
    </label>
  );
}
