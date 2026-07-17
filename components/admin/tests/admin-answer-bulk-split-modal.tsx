"use client";

import trainingStyles from "@/components/admin/training/admin-training.module.css";
import testStyles from "@/components/admin/tests/admin-tests.module.css";
import uploadStyles from "@/components/admin/upload/admin-upload.module.css";
import { Button } from "@/components/ui/button";
import {
  ANSWER_SPLIT_DELIMITER_OPTIONS,
  buildBulkSplitPreview,
  type AnswerSplitDelimiter,
  type BulkSplitCandidate,
  type BulkSplitPreviewRow,
} from "@/lib/admin/admin-answer-split";
import type { AdminTestQuestionType } from "@/lib/admin/admin-tests-types";
import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface AdminAnswerBulkSplitModalProps {
  candidates: BulkSplitCandidate[];
  onClose: () => void;
  onApply: (rows: BulkSplitPreviewRow[], targetType: AdminTestQuestionType) => void;
}

function snippet(text: string, max = 80): string {
  const value = text.replace(/\s+/g, " ").trim();
  if (value.length <= max) {
    return value || "Без текста";
  }
  return `${value.slice(0, max)}…`;
}

function delimiterLabel(value: string): string {
  if (value === "\n") {
    return "новая строка";
  }
  return value || "не задан";
}

export function AdminAnswerBulkSplitModal({
  candidates,
  onClose,
  onApply,
}: AdminAnswerBulkSplitModalProps) {
  const [mode, setMode] = useState<AnswerSplitDelimiter>("auto");
  const [customDelimiter, setCustomDelimiter] = useState("");
  const [targetType, setTargetType] = useState<AdminTestQuestionType>("text");
  const [rows, setRows] = useState<BulkSplitPreviewRow[]>(() =>
    buildBulkSplitPreview(candidates, "auto"),
  );

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const rebuild = (
    nextMode: AnswerSplitDelimiter = mode,
    nextCustom = customDelimiter,
  ) => {
    setRows(buildBulkSplitPreview(candidates, nextMode, nextCustom));
  };

  const splitOkCount = useMemo(
    () => rows.filter((row) => row.splitOk).length,
    [rows],
  );

  const sampleDelimiter = rows.find((row) => row.splitOk)?.delimiter
    ?? rows[0]?.delimiter
    ?? "";

  const updateRowParts = (questionId: string, parts: string[]) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.questionId !== questionId) {
          return row;
        }
        const cleaned = parts.map((part) => part);
        return {
          ...row,
          parts: cleaned,
          splitOk: cleaned.filter((part) => part.trim()).length > 1,
        };
      }),
    );
  };

  const updatePart = (questionId: string, index: number, value: string) => {
    const row = rows.find((item) => item.questionId === questionId);
    if (!row) {
      return;
    }
    updateRowParts(
      questionId,
      row.parts.map((part, i) => (i === index ? value : part)),
    );
  };

  const removePart = (questionId: string, index: number) => {
    const row = rows.find((item) => item.questionId === questionId);
    if (!row || row.parts.length <= 1) {
      return;
    }
    updateRowParts(
      questionId,
      row.parts.filter((_, i) => i !== index),
    );
  };

  const addPart = (questionId: string) => {
    const row = rows.find((item) => item.questionId === questionId);
    if (!row) {
      return;
    }
    updateRowParts(questionId, [...row.parts, ""]);
  };

  const canApply = splitOkCount > 0;

  return (
    <div className={trainingStyles.overlay} onClick={onClose}>
      <div
        className={trainingStyles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Расшифровать ответы"
        style={{ maxWidth: 820, width: "min(820px, 96vw)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className={trainingStyles.modalTitle}>Расшифровать ответы</h2>
        <p className={trainingStyles.modalHint}>
          Найдено кандидатов: {candidates.length}. Будет применено: {splitOkCount}.
          Настройки разделителя и типа — общие для всего списка.
        </p>

        <div className={testStyles.fieldRow}>
          <label className={testStyles.field}>
            <span>Разделитель</span>
            <select
              className={testStyles.select}
              value={mode}
              onChange={(event) => {
                const next = event.target.value as AnswerSplitDelimiter;
                setMode(next);
                rebuild(next, customDelimiter);
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
                  rebuild("custom", event.target.value);
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
              rebuild("auto");
            }}
          >
            <Sparkles size={16} aria-hidden />
            Угадать разделитель
          </Button>
          <span className={trainingStyles.modalHint} style={{ margin: 0 }}>
            Пример разделителя: {delimiterLabel(sampleDelimiter)}
          </span>
        </div>

        <div
          style={{
            maxHeight: "min(48vh, 420px)",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginBottom: 16,
          }}
        >
          {rows.map((row, index) => (
            <div
              key={row.questionId}
              style={{
                padding: 12,
                border: "1px solid var(--ds-border)",
                borderRadius: "var(--ds-radius-md)",
                background: "var(--ds-surface-muted)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div>
                  <strong style={{ fontSize: 13 }}>
                    #{index + 1}. {snippet(row.questionText)}
                  </strong>
                  <p
                    className={trainingStyles.modalHint}
                    style={{ margin: "4px 0 0" }}
                  >
                    Исходный ответ: {snippet(row.sourceText, 120)}
                  </p>
                </div>
                {!row.splitOk ? (
                  <span
                    style={{
                      flexShrink: 0,
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: "rgba(245, 158, 11, 0.18)",
                      color: "#b45309",
                    }}
                  >
                    не разбилось
                  </span>
                ) : (
                  <span
                    style={{
                      flexShrink: 0,
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: "rgba(34, 197, 94, 0.15)",
                      color: "#15803d",
                    }}
                  >
                    {row.parts.length} куска
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {row.parts.map((part, partIndex) => (
                  <div
                    key={`${row.questionId}-part-${partIndex}`}
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <input
                      className={testStyles.input}
                      value={part}
                      onChange={(event) =>
                        updatePart(row.questionId, partIndex, event.target.value)
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={row.parts.length <= 1}
                      onClick={() => removePart(row.questionId, partIndex)}
                    >
                      Удалить
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addPart(row.questionId)}
              >
                + Кусок
              </Button>
            </div>
          ))}
        </div>

        <div className={uploadStyles.actions}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="button"
            disabled={!canApply}
            onClick={() => onApply(rows, targetType)}
          >
            Применить всё ({splitOkCount})
          </Button>
        </div>
      </div>
    </div>
  );
}
