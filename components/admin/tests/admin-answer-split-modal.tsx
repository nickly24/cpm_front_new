"use client";

import trainingStyles from "@/components/admin/training/admin-training.module.css";
import testStyles from "@/components/admin/tests/admin-tests.module.css";
import uploadStyles from "@/components/admin/upload/admin-upload.module.css";
import { Button } from "@/components/ui/button";
import {
  ANSWER_SPLIT_DELIMITER_OPTIONS,
  detectDelimiter,
  splitAnswerWithMode,
  type AnswerSplitDelimiter,
} from "@/lib/admin/admin-answer-split";
import type { AdminTestQuestionType } from "@/lib/admin/admin-tests-types";
import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface AdminAnswerSplitModalProps {
  sourceText: string;
  currentQuestionType: AdminTestQuestionType;
  onClose: () => void;
  onApply: (parts: string[], targetType: AdminTestQuestionType) => void;
}

function defaultTargetType(type: AdminTestQuestionType): AdminTestQuestionType {
  if (type === "single" || type === "multiple") {
    return type;
  }
  return "text";
}

export function AdminAnswerSplitModal({
  sourceText,
  currentQuestionType,
  onClose,
  onApply,
}: AdminAnswerSplitModalProps) {
  const [mode, setMode] = useState<AnswerSplitDelimiter>("auto");
  const [customDelimiter, setCustomDelimiter] = useState("");
  const [targetType, setTargetType] = useState<AdminTestQuestionType>(() =>
    defaultTargetType(currentQuestionType),
  );
  const [parts, setParts] = useState<string[]>(() =>
    splitAnswerWithMode(sourceText, "auto").parts,
  );
  const [detected, setDetected] = useState(() => detectDelimiter(sourceText));

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const effectiveDelimiter = useMemo(() => {
    if (mode === "auto") {
      return detected;
    }
    if (mode === "custom") {
      return customDelimiter;
    }
    return mode;
  }, [mode, customDelimiter, detected]);

  const rerunSplit = (
    nextMode: AnswerSplitDelimiter = mode,
    nextCustom = customDelimiter,
  ) => {
    const result = splitAnswerWithMode(sourceText, nextMode, nextCustom);
    setDetected(nextMode === "auto" ? result.delimiter : detectDelimiter(sourceText));
    setParts(
      result.parts.length > 0
        ? result.parts
        : [sourceText.trim()].filter(Boolean),
    );
  };

  const updatePart = (index: number, value: string) => {
    setParts((prev) => prev.map((part, i) => (i === index ? value : part)));
  };

  const removePart = (index: number) => {
    setParts((prev) => prev.filter((_, i) => i !== index));
  };

  const addPart = () => {
    setParts((prev) => [...prev, ""]);
  };

  const canApply = parts.some((part) => part.trim().length > 0);

  return (
    <div className={trainingStyles.overlay} onClick={onClose}>
      <div
        className={trainingStyles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Разобрать ответ"
        style={{ maxWidth: 640, width: "min(640px, 96vw)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className={trainingStyles.modalTitle}>Разобрать ответ</h2>
        <p className={trainingStyles.modalHint}>
          Исходная строка будет заменена кусками. Тип вопроса можно выбрать ниже.
        </p>

        <label className={testStyles.field}>
          <span>Исходный текст</span>
          <textarea
            className={testStyles.textarea}
            value={sourceText}
            readOnly
            rows={3}
          />
        </label>

        <div className={testStyles.fieldRow} style={{ marginTop: 12 }}>
          <label className={testStyles.field}>
            <span>Разделитель</span>
            <select
              className={testStyles.select}
              value={mode}
              onChange={(event) => {
                const next = event.target.value as AnswerSplitDelimiter;
                setMode(next);
                rerunSplit(next, customDelimiter);
              }}
            >
              {ANSWER_SPLIT_DELIMITER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {mode === "custom" ? (
            <label className={testStyles.field}>
              <span>Свой знак</span>
              <input
                className={testStyles.input}
                value={customDelimiter}
                placeholder="например: —"
                onChange={(event) => {
                  setCustomDelimiter(event.target.value);
                  rerunSplit("custom", event.target.value);
                }}
              />
            </label>
          ) : null}

          <label className={testStyles.field}>
            <span>Тип вопроса</span>
            <select
              className={testStyles.select}
              value={targetType}
              onChange={(event) =>
                setTargetType(event.target.value as AdminTestQuestionType)
              }
            >
              <option value="text">Текстовый</option>
              <option value="multiple">Множественный выбор</option>
              <option value="single">Один вариант</option>
            </select>
          </label>
        </div>

        <div className={uploadStyles.actions} style={{ margin: "12px 0" }}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setMode("auto");
              rerunSplit("auto");
            }}
          >
            <Sparkles size={16} aria-hidden />
            Угадать разделитель
          </Button>
          <span className={trainingStyles.modalHint} style={{ margin: 0 }}>
            Сейчас:{" "}
            {effectiveDelimiter === "\n"
              ? "новая строка"
              : effectiveDelimiter || "не задан"}
          </span>
        </div>

        <div className={testStyles.field}>
          <span>Куски ({parts.length})</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {parts.map((part, index) => (
              <div
                key={`part-${index}`}
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <input
                  className={testStyles.input}
                  value={part}
                  onChange={(event) => updatePart(index, event.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removePart(index)}
                  disabled={parts.length <= 1}
                >
                  Удалить
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={addPart}>
            + Добавить кусок
          </Button>
        </div>

        <div className={uploadStyles.actions} style={{ marginTop: 16 }}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="button"
            disabled={!canApply}
            onClick={() =>
              onApply(
                parts.map((part) => part.trim()).filter(Boolean),
                targetType,
              )
            }
          >
            Применить
          </Button>
        </div>
      </div>
    </div>
  );
}
