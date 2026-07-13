"use client";

import styles from "@/components/admin/upload/admin-upload.module.css";
import testStyles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import type {
  CardImportPreview,
  CardImportPreviewCard,
} from "@/lib/admin/admin-upload-types";
import { useMemo, useState } from "react";

type PreviewFilter = "all" | "import" | "warnings" | "errors" | "skip";

interface AdminCardsUploadPreviewProps {
  preview: CardImportPreview;
  sourceFilename?: string | null;
  saving?: boolean;
  committing?: boolean;
  onCardChange: (
    row: number,
    patch: Partial<Pick<CardImportPreviewCard, "question" | "answer" | "action">>,
  ) => void;
  onCommit: () => void;
  onReset: () => void;
}

function actionLabel(card: CardImportPreviewCard): string {
  if (card.action === "create") {
    return "К импорту";
  }
  if (card.action === "warning") {
    return "С предупреждением";
  }
  if (card.action === "skip") {
    return "Исключена";
  }
  return "Ошибка";
}

export function AdminCardsUploadPreview({
  preview,
  sourceFilename,
  saving,
  committing,
  onCardChange,
  onCommit,
  onReset,
}: AdminCardsUploadPreviewProps) {
  const [filter, setFilter] = useState<PreviewFilter>("all");
  const summary = preview.summary;

  const filteredCards = useMemo(() => {
    const cards = preview.cards ?? [];
    if (filter === "import") {
      return cards.filter((card) => card.action === "create" || card.action === "warning");
    }
    if (filter === "warnings") {
      return cards.filter((card) => card.action === "warning");
    }
    if (filter === "errors") {
      return cards.filter((card) => card.action === "error");
    }
    if (filter === "skip") {
      return cards.filter((card) => card.action === "skip");
    }
    return cards;
  }, [filter, preview.cards]);

  const canCommit =
    summary.row_errors === 0 &&
    summary.cards_to_import > 0 &&
    !saving &&
    !committing;

  return (
    <div className={styles.previewWrap}>
      <div className={styles.previewHeader}>
        <div>
          <h2 className={styles.mainTitle}>Предпросмотр карточек</h2>
          <p className={styles.mainDesc}>
            {sourceFilename ? `Файл: ${sourceFilename}` : "Проверьте карточки перед загрузкой"}
          </p>
          <p className={styles.hint}>
            {preview.direction_name} · {preview.theme_name}
          </p>
        </div>
        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onReset}>
            Другой файл
          </Button>
          <Button type="button" disabled={!canCommit} onClick={onCommit}>
            {committing ? "Запуск…" : "Загрузить карточки"}
          </Button>
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <span className={styles.statPill}>
          Строк: <strong>{summary.total_rows}</strong>
        </span>
        <span className={styles.statPill}>
          К импорту: <strong>{summary.cards_to_import}</strong>
        </span>
        <span className={styles.statPill}>
          Без предупреждений: <strong>{summary.cards_create}</strong>
        </span>
        <span className={styles.statPill}>
          С предупреждением: <strong>{summary.cards_warning}</strong>
        </span>
        <span className={styles.statPill}>
          Исключено: <strong>{summary.cards_skip}</strong>
        </span>
        {summary.row_errors > 0 ? (
          <span className={`${styles.statPill} ${styles.statPillDanger}`}>
            Ошибок: <strong>{summary.row_errors}</strong>
          </span>
        ) : null}
      </div>

      {summary.row_errors > 0 ? (
        <div className={styles.notice}>
          Исправьте строки с пустым вопросом или ответом — загрузка недоступна.
        </div>
      ) : null}

      {summary.cards_warning > 0 ? (
        <div className={styles.notice}>
          Строки с предупреждениями можно импортировать или исключить кнопкой «Исключить».
        </div>
      ) : null}

      <div className={styles.previewFilters}>
        {(
          [
            ["all", "Все"],
            ["import", "К импорту"],
            ["warnings", "Предупреждения"],
            ["skip", "Исключённые"],
            ["errors", "Ошибки"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`${testStyles.directionTab} ${filter === id ? testStyles.directionTabActive : ""}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.previewTableWrap}>
        <table className={styles.previewTable}>
          <thead>
            <tr>
              <th>#</th>
              <th>Вопрос</th>
              <th>Ответ</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filteredCards.map((card) => (
              <tr
                key={card.row}
                className={
                  card.action === "error"
                    ? styles.previewRowError
                    : card.action === "skip"
                      ? styles.previewRowSkip
                      : card.action === "warning"
                        ? styles.previewRowWarning
                        : undefined
                }
              >
                <td>{card.row}</td>
                <td>
                  <input
                    className={styles.previewInput}
                    value={card.question}
                    disabled={card.action === "skip"}
                    onChange={(event) =>
                      onCardChange(card.row, { question: event.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    className={styles.previewInput}
                    value={card.answer}
                    disabled={card.action === "skip"}
                    onChange={(event) =>
                      onCardChange(card.row, { answer: event.target.value })
                    }
                  />
                </td>
                <td>
                  <div className={styles.previewActionCell}>
                    <span>{actionLabel(card)}</span>
                    {card.errors.length > 0 ? (
                      <span className={styles.previewErrorText}>{card.errors.join("; ")}</span>
                    ) : null}
                    {card.message ? (
                      <span
                        className={
                          card.action === "warning"
                            ? styles.previewWarningText
                            : styles.previewErrorText
                        }
                      >
                        {card.message}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td>
                  {card.action === "skip" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onCardChange(card.row, { action: "create" })}
                    >
                      Вернуть
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onCardChange(card.row, { action: "skip" })}
                    >
                      Исключить
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {saving ? <p className={styles.hint}>Сохранение изменений…</p> : null}
    </div>
  );
}
