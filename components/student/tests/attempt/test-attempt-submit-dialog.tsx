"use client";

import styles from "@/components/student/tests/attempt/test-attempt.module.css";
import { AlertCircle, Send } from "lucide-react";

export type SubmitDialogMode = "confirm" | "error";

interface TestAttemptSubmitDialogProps {
  mode: SubmitDialogMode;
  isPractice: boolean;
  timeExpired: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onRetry: () => void;
}

export function TestAttemptSubmitDialog({
  mode,
  isPractice,
  timeExpired,
  loading = false,
  onCancel,
  onConfirm,
  onRetry,
}: TestAttemptSubmitDialogProps) {
  const isConfirm = mode === "confirm";

  const title = isConfirm
    ? isPractice
      ? "Завершить тренировку?"
      : timeExpired
        ? "Отправить сохранённые ответы?"
        : "Завершить тест?"
    : "Не удалось отправить";

  const description = isConfirm
    ? isPractice
      ? "Результат тренировки не засчитается в официальный балл."
      : timeExpired
        ? "Новые ответы добавить уже нельзя. На проверку уйдут ответы, сохранённые на устройстве и на сервере."
        : "После отправки изменить ответы будет нельзя. Сначала все ответы синхронизируются с сервером."
    : "Попытка сохранена на устройстве — не переживайте. Когда сеть будет доступна, нажмите «Повторить отправку». Отвечать заново не нужно.";

  return (
    <div
      className={styles.submitDialogOverlay}
      role="presentation"
      onClick={loading ? undefined : onCancel}
    >
      <div
        className={styles.submitDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        {isConfirm ? null : (
          <div className={styles.submitDialogIconWrap}>
            <AlertCircle size={28} className={styles.submitDialogIconError} />
          </div>
        )}

        <h2 id="submit-dialog-title" className={styles.submitDialogTitle}>
          {title}
        </h2>
        <p className={styles.submitDialogText}>{description}</p>

        <div className={styles.submitDialogActions}>
          <button
            type="button"
            className={styles.submitDialogBtnSecondary}
            disabled={loading}
            onClick={onCancel}
          >
            {isConfirm ? "Отмена" : "Закрыть"}
          </button>

          {isConfirm ? (
            <button
              type="button"
              className={styles.submitDialogBtnPrimary}
              disabled={loading}
              onClick={onConfirm}
            >
              <Send size={16} />
              {loading ? "Отправка…" : isPractice ? "Завершить" : "Отправить"}
            </button>
          ) : (
            <button
              type="button"
              className={styles.submitDialogBtnPrimary}
              disabled={loading}
              onClick={onRetry}
            >
              <Send size={16} />
              {loading ? "Отправка…" : "Повторить отправку"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
