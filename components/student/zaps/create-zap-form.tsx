"use client";

import styles from "@/components/student/zaps/student-zaps.module.css";
import { Button } from "@/components/ui/button";
import { createZap } from "@/lib/zaps/zaps-api";
import {
  expandDateRange,
  formatZapDateShort,
  mergeUniqueDates,
  validateZapAttachment,
  ZAP_ATTACHMENT_ACCEPT,
} from "@/lib/zaps/zap-date-utils";
import { cn } from "@/lib/cn";
import { useCallback, useState } from "react";

type DatePickMode = "range" | "list";

interface AttachmentPreview {
  id: string;
  name: string;
  base64: string;
  previewUrl: string | null;
  isPdf: boolean;
}

interface CreateZapFormProps {
  studentId: number;
  onBack: () => void;
  onCreated: () => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Не удалось прочитать файл"));
      }
    };
    reader.onerror = () => reject(new Error("Ошибка чтения файла"));
    reader.readAsDataURL(file);
  });
}

export function CreateZapForm({
  studentId,
  onBack,
  onCreated,
}: CreateZapFormProps) {
  const [text, setText] = useState("");
  const [dateMode, setDateMode] = useState<DatePickMode>("range");
  const [singleDate, setSingleDate] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const addSingleDate = useCallback(() => {
    if (!singleDate) {
      setError("Выберите дату");
      return;
    }
    setSelectedDates((prev) => mergeUniqueDates(prev, [singleDate]));
    setSingleDate("");
    setError(null);
  }, [singleDate]);

  const addRangeDates = useCallback(() => {
    if (!rangeFrom || !rangeTo) {
      setError("Укажите даты «с» и «по»");
      return;
    }
    const expanded = expandDateRange(rangeFrom, rangeTo, { excludeSundays: true });
    if (expanded.length === 0) {
      setError("В выбранном диапазоне нет дат (воскресенья исключены)");
      return;
    }
    setSelectedDates((prev) => mergeUniqueDates(prev, expanded));
    setRangeFrom("");
    setRangeTo("");
    setError(null);
  }, [rangeFrom, rangeTo]);

  const removeDate = useCallback((iso: string) => {
    setSelectedDates((prev) => prev.filter((date) => date !== iso));
  }, []);

  const handleFilesChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (files.length === 0) return;

      for (const file of files) {
        const validationError = validateZapAttachment(file);
        if (validationError) {
          setError(validationError);
          return;
        }
      }

      try {
        const next: AttachmentPreview[] = [];
        for (const file of files) {
          const base64 = await readFileAsDataUrl(file);
          const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
          next.push({
            id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
            name: file.name,
            base64,
            previewUrl: isPdf ? null : URL.createObjectURL(file),
            isPdf,
          });
        }
        setAttachments((prev) => [...prev, ...next]);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки файла");
      }
    },
    [],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const item = prev.find((entry) => entry.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((entry) => entry.id !== id);
    });
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Пожалуйста, введите текст запроса");
      return;
    }
    if (selectedDates.length === 0) {
      setError("Добавьте хотя бы одну дату пропуска");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await createZap({
        student_id: studentId,
        text: trimmed,
        images: attachments.map((item) => item.base64),
        dates: selectedDates,
      });

      if (response.status) {
        setSuccess(true);
        setTimeout(() => {
          onCreated();
        }, 1500);
      } else {
        setError(response.error ?? "Ошибка при создании запроса");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при отправке запроса");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.panel}>
        <p className={styles.success}>
          Информация о пропуске успешно отправлена.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <p className={styles.formDescription}>
        Сообщите о пропуске занятия по болезни или иной уважительной причине.
        Обязательно прикрепите подтверждающий документ. При отсутствии документа
        пропуск может быть засчитан как прогул.
      </p>

      {error ? <div className={styles.alert}>{error}</div> : null}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="zap-text">
            Коротко опишите обстоятельства пропуска
          </label>
          <textarea
            id="zap-text"
            className={styles.textarea}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Опишите обстоятельства пропуска…"
            disabled={loading}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Даты пропуска</span>
          <nav className={styles.dateBreadcrumbs} aria-label="Способ выбора дат">
            <button
              type="button"
              className={cn(
                styles.dateCrumb,
                dateMode === "range" && styles.dateCrumbActive,
              )}
              onClick={() => setDateMode("range")}
              disabled={loading}
              aria-current={dateMode === "range" ? "page" : undefined}
            >
              Диапазон
            </button>
            <span className={styles.dateCrumbSep} aria-hidden>
              /
            </span>
            <button
              type="button"
              className={cn(
                styles.dateCrumb,
                dateMode === "list" && styles.dateCrumbActive,
              )}
              onClick={() => setDateMode("list")}
              disabled={loading}
              aria-current={dateMode === "list" ? "page" : undefined}
            >
              Список дат
            </button>
          </nav>

          {dateMode === "range" ? (
            <>
              <p className={styles.helpText}>
                Укажите период с и по. Воскресенья в диапазон не включаются.
              </p>
              <div className={styles.rangeRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="zap-range-from">
                    С
                  </label>
                  <input
                    id="zap-range-from"
                    type="date"
                    className={styles.input}
                    value={rangeFrom}
                    onChange={(event) => setRangeFrom(event.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="zap-range-to">
                    По
                  </label>
                  <input
                    id="zap-range-to"
                    type="date"
                    className={styles.input}
                    value={rangeTo}
                    onChange={(event) => setRangeTo(event.target.value)}
                    disabled={loading}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addRangeDates}
                >
                  Добавить в запрос
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className={styles.helpText}>
                Выберите дни по одному и добавляйте в список запроса.
              </p>
              <div className={styles.datePickerRow}>
                <input
                  id="zap-single-date"
                  type="date"
                  className={styles.input}
                  value={singleDate}
                  onChange={(event) => setSingleDate(event.target.value)}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addSingleDate}
                >
                  Добавить в запрос
                </Button>
              </div>
            </>
          )}

          {selectedDates.length > 0 ? (
            <div className={styles.selectedDatesBlock}>
              <span className={styles.selectedDatesLabel}>
                В запросе ({selectedDates.length})
              </span>
              <div className={styles.selectedDates}>
                {selectedDates.map((iso) => (
                  <span key={iso} className={styles.dateTag}>
                    {formatZapDateShort(iso)}
                    <button
                      type="button"
                      className={styles.dateTagRemove}
                      onClick={() => removeDate(iso)}
                      aria-label={`Удалить ${iso}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className={styles.helpText}>Пока нет выбранных дат.</p>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="zap-files">
            Подтверждающий документ (фото/скан)
          </label>
          <input
            id="zap-files"
            type="file"
            className={styles.fileInput}
            accept={ZAP_ATTACHMENT_ACCEPT}
            multiple
            onChange={(event) => void handleFilesChange(event)}
            disabled={loading}
          />
          <p className={styles.helpText}>
            Форматы: JPG, HEIC, PDF. Максимальный размер: 5 МБ на файл.
          </p>
        </div>

        {attachments.length > 0 ? (
          <div className={styles.previewGrid}>
            {attachments.map((item) => (
              <div key={item.id} className={styles.previewItem}>
                {item.isPdf ? (
                  <div className={styles.pdfPreview}>
                    <span>PDF</span>
                    <span>{item.name}</span>
                  </div>
                ) : (
                  <img
                    src={item.previewUrl ?? ""}
                    alt={item.name}
                    className={styles.previewImage}
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttachment(item.id)}
                  disabled={loading}
                >
                  Удалить
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        <p className={styles.formNote}>
          <strong>Напоминаем:</strong> при трёх пропусках без уважительной причины
          вы будете отчислены.
        </p>

        <div className={styles.formActions}>
          <Button type="button" variant="ghost" onClick={onBack} disabled={loading}>
            Отмена
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Отправка…" : "Отправить информацию"}
          </Button>
        </div>
      </form>
    </div>
  );
}
