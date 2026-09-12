"use client";

import { useId } from "react";
import { parseHomeworkScore } from "@/components/homework/staff-homework-utils";
import { Minus, Plus } from "lucide-react";
import styles from "./proctor.module.css";

interface ProctorScoreInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function ProctorScoreInput({
  value,
  onChange,
  label = "Баллы",
  disabled = false,
}: ProctorScoreInputProps) {
  const numeric = parseHomeworkScore(value);
  const hintId = useId();
  const invalid = value.length > 0 && numeric === null;
  const canStep = !disabled && numeric !== null;
  const applyDelta = (delta: number) => {
    if (numeric === null) return;
    onChange(String(clampScore(numeric + delta)));
  };

  return (
    <div className={styles.scoreField}>
      <span className={styles.scoreLabel}>{label}</span>
      <div className={styles.scoreStepper}>
        <button
          type="button"
          className={styles.scoreStepBtn}
          disabled={!canStep || (numeric ?? 0) <= 0}
          aria-label="Уменьшить балл"
          onClick={() => applyDelta(-5)}
        >
          <Minus size={16} />
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className={styles.scoreStepValue}
          value={value}
          disabled={disabled}
          aria-label={label}
          aria-invalid={invalid}
          aria-describedby={hintId}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className={styles.scoreStepBtn}
          disabled={!canStep || (numeric ?? 100) >= 100}
          aria-label="Увеличить балл"
          onClick={() => applyDelta(5)}
        >
          <Plus size={16} />
        </button>
      </div>
      <small id={hintId} className={styles.scoreLabel}>{invalid ? "Введите целое число от 0 до 100" : "От 0 до 100 баллов"}</small>
    </div>
  );
}
