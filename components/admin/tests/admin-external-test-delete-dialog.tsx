"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import {
  fetchExternalTestDeletePreview,
  getAdminTestTitle,
} from "@/lib/admin/admin-tests-api";
import type { AdminTestListItem } from "@/lib/admin/admin-tests-types";
import {
  formatAdminTestDate,
  formatResultsCountLabel,
} from "@/lib/admin/admin-tests-utils";
import { AlertTriangle, Globe2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

interface AdminExternalTestDeleteDialogProps {
  test: AdminTestListItem;
  deleting?: boolean;
  deleteError?: string | null;
  onCancel: () => void;
  onConfirm: (resultsCount: number) => void;
}

export function AdminExternalTestDeleteDialog({
  test,
  deleting = false,
  deleteError = null,
  onCancel,
  onConfirm,
}: AdminExternalTestDeleteDialogProps) {
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [resultsCount, setResultsCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setLoadingPreview(true);
      setPreviewError(null);
      setResultsCount(null);

      try {
        const preview = await fetchExternalTestDeletePreview(String(test.id));
        if (cancelled) {
          return;
        }
        setResultsCount(preview.resultsCount);
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
  }, [test.id]);

  const title = getAdminTestTitle(test);
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
        aria-labelledby="external-test-delete-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.deleteDialogIconWrap}>
          <AlertTriangle size={28} className={styles.deleteDialogIcon} />
        </div>

        <h2 id="external-test-delete-title" className={styles.deleteDialogTitle}>
          Удалить внешний тест?
        </h2>

        <div className={styles.deleteDialogMeta}>
          <span className={styles.deleteDialogMetaTag}>
            <Globe2 size={14} />
            Вне CPM-LMS
          </span>
          <p className={styles.deleteDialogTestName}>{title}</p>
          <p className={styles.deleteDialogTestDate}>
            Дата проведения: {formatAdminTestDate(test.date)}
          </p>
        </div>

        {loadingPreview ? (
          <LoadingState
            label="Считаем результаты…"
            variant="inline"
            className={styles.deleteDialogLoading}
          />
        ) : previewError ? (
          <p className={styles.deleteDialogError}>{previewError}</p>
        ) : (
          <div className={styles.deleteDialogStats}>
            <p className={styles.deleteDialogStatsLabel}>Будет удалено</p>
            <p className={styles.deleteDialogStatsValue}>
              {formatResultsCountLabel(resultsCount ?? 0)}
            </p>
            <p className={styles.deleteDialogStatsHint}>
              Вместе с тестом исчезнут все привязанные результаты учеников.
              Действие необратимо: тест пропадёт из списков и перестанет
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
            disabled={busy || Boolean(previewError) || resultsCount === null}
            onClick={() => onConfirm(resultsCount ?? 0)}
          >
            <Trash2 size={16} />
            {deleting ? "Удаление…" : "Удалить"}
          </button>
        </div>
      </div>
    </div>
  );
}
