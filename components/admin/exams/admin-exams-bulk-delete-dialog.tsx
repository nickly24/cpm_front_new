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
import { useEffect, useMemo, useState } from "react";

interface AdminExamsBulkDeleteDialogProps {
  exams: Exam[];
  deleting?: boolean;
  deleteError?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

function formatExamsCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod100 >= 11 && mod100 <= 14) {
    return `${count} экзаменов`;
  }
  if (mod10 === 1) {
    return `${count} экзамен`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${count} экзамена`;
  }
  return `${count} экзаменов`;
}

export function AdminExamsBulkDeleteDialog({
  exams,
  deleting = false,
  deleteError = null,
  onCancel,
  onConfirm,
}: AdminExamsBulkDeleteDialogProps) {
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sessionsCount, setSessionsCount] = useState<number | null>(null);

  const examIdsKey = useMemo(
    () => exams.map((exam) => exam.id).sort((a, b) => a - b).join(","),
    [exams],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setLoadingPreview(true);
      setPreviewError(null);
      setSessionsCount(null);

      try {
        const previews = await Promise.all(
          exams.map((exam) => fetchExamDeletePreview(exam.id)),
        );
        if (cancelled) {
          return;
        }
        const totalSessions = previews.reduce(
          (sum, preview) => sum + (preview.sessionsCount ?? 0),
          0,
        );
        setSessionsCount(totalSessions);
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
  }, [examIdsKey, exams]);

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
        aria-labelledby="exams-bulk-delete-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.deleteDialogIconWrap}>
          <AlertTriangle size={28} className={styles.deleteDialogIcon} />
        </div>

        <h2 id="exams-bulk-delete-title" className={styles.deleteDialogTitle}>
          Удалить выбранные экзамены?
        </h2>

        <div className={styles.deleteDialogMeta}>
          <span className={styles.deleteDialogMetaTag}>
            <GraduationCap size={14} />
            Массовое удаление
          </span>
          <p className={styles.deleteDialogTestName}>
            {formatExamsCountLabel(exams.length)}
          </p>
        </div>

        <ul className={styles.deleteDialogList}>
          {exams.map((exam) => (
            <li key={exam.id}>
              <strong>{exam.name}</strong>
              <span>{formatExamDate(exam.date)}</span>
            </li>
          ))}
        </ul>

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
              Вместе с экзаменами исчезнут все связанные сессии учеников.
              Действие необратимо: записи пропадут из списков и перестанут
              учитываться в рейтинге.
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
            disabled={
              busy || Boolean(previewError) || sessionsCount === null || exams.length === 0
            }
            onClick={onConfirm}
          >
            <Trash2 size={16} />
            {deleting ? "Удаление…" : "Удалить выбранные"}
          </button>
        </div>
      </div>
    </div>
  );
}
