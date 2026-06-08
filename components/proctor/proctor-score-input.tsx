"use client";

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
  const numeric = Number(value);
  const canStep = !disabled && !Number.isNaN(numeric);

  const applyDelta = (delta: number) => {
    const base = Number.isNaN(numeric) ? 100 : numeric;
    onChange(String(clampScore(base + delta)));
  };

  const handleInputChange = (next: string) => {
    if (next === "") {
      onChange("");
      return;
    }
    if (!/^\d{0,3}$/.test(next)) {
      return;
    }
    const parsed = Number(next);
    if (parsed > 100) {
      onChange("100");
      return;
    }
    onChange(next);
  };

  const handleBlur = () => {
    if (value === "") {
      onChange("0");
      return;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      onChange("0");
      return;
    }
    onChange(String(clampScore(parsed)));
  };

  return (
    <div className={styles.scoreField}>
      <span className={styles.scoreLabel}>{label}</span>
      <div className={styles.scoreStepper}>
        <button
          type="button"
          className={styles.scoreStepBtn}
          disabled={!canStep || numeric <= 0}
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
          onChange={(event) => handleInputChange(event.target.value)}
          onBlur={handleBlur}
        />
        <button
          type="button"
          className={styles.scoreStepBtn}
          disabled={!canStep || numeric >= 100}
          aria-label="Увеличить балл"
          onClick={() => applyDelta(5)}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
