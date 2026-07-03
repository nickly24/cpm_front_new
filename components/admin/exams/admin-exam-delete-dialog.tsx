"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchExamDeletePreview } from "@/lib/exams/exams-api";
import type { Exam } from "@/lib/exams/exams-types";
import {
  formatExamDate,
  formatExamSessionsCountLabel,
} from "@/lib/exams/exams-utils";
import { AlertTriangle, GraduationCap, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

interface AdminExamDeleteDialogProps {
  exam: Exam;
  deleting?: boolean;
  deleteError?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function AdminExamDeleteDialog({
  exam,
  deleting = false,
  deleteError = null,
  onCancel,
  onConfirm,
}: AdminExamDeleteDialogProps) {
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sessionsCount, setSessionsCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setLoadingPreview(true);
      setPreviewError(null);
      setSessionsCount(null);

      try {
        const preview = await fetchExamDeletePreview(exam.id);
        if (cancelled) {
          return;
        }
        setSessionsCount(preview.sessionsCount);
      } catch (err) {
        if (!cancelled) {
          setPreviewError(
            err instanceof Error
              ? err.message
              : "Не удалось загрузить данные для удаления",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingPreview(false);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [exam.id]);

  const busy = loadingPreview || deleting;

  return (
    <div
      className={styles.deleteDialogOverlay}
      role="presentation"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className={styles.deleteDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-delete-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.deleteDialogIconWrap}>
          <AlertTriangle size={28} className={styles.deleteDialogIcon} />
        </div>

        <h2 id="exam-delete-title" className={styles.deleteDialogTitle}>
          Удалить экзамен?
        </h2>

        <div className={styles.deleteDialogMeta}>
          <span className={styles.deleteDialogMetaTag}>
            <GraduationCap size={14} />
            Экзамен
          </span>
          <p className={styles.deleteDialogTestName}>{exam.name}</p>
          <p className={styles.deleteDialogTestDate}>
            Дата проведения: {formatExamDate(exam.date)}
          </p>
        </div>

        {loadingPreview ? (
          <LoadingState
            label="Считаем сессии…"
            variant="inline"
            className={styles.deleteDialogLoading}
          />
        ) : previewError ? (
          <p className={styles.deleteDialogError}>{previewError}</p>
        ) : (
          <div className={styles.deleteDialogStats}>
            <p className={styles.deleteDialogStatsLabel}>Будет удалено</p>
            <p className={styles.deleteDialogStatsValue}>
              {formatExamSessionsCountLabel(sessionsCount ?? 0)}
            </p>
            <p className={styles.deleteDialogStatsHint}>
              Вместе с экзаменом исчезнут все сессии учеников. Действие
              необратимо: экзамен пропадёт из списков и перестанет учитываться в
              рейтинге.
            </p>
          </div>
        )}

        {deleteError ? (
          <p className={styles.deleteDialogError}>{deleteError}</p>
        ) : null}

        <div className={styles.deleteDialogActions}>
          <button
            type="button"
            className={styles.actionBtn}
            disabled={busy}
            onClick={onCancel}
          >
            Отмена
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            disabled={busy || Boolean(previewError) || sessionsCount === null}
            onClick={onConfirm}
          >
            <Trash2 size={16} />
            {deleting ? "Удаление…" : "Удалить"}
          </button>
        </div>
      </div>
    </div>
  );
}
