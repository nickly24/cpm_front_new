"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import { DismissibleOverlay } from "@/components/ui/dismissible-overlay";
import {
  describeAdminTestRecalc,
  type AdminTestUpdateRecalc,
} from "@/lib/admin/admin-tests-api";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

export type AdminTestSaveRecalcDialogMode = "confirm" | "result";

interface AdminTestSaveRecalcDialogProps {
  mode: AdminTestSaveRecalcDialogMode;
  saving?: boolean;
  saveError?: string | null;
  recalc?: AdminTestUpdateRecalc | null;
  onCancel: () => void;
  onConfirm: () => void;
  onCloseResult: () => void;
}

export function AdminTestSaveRecalcDialog({
  mode,
  saving = false,
  saveError = null,
  recalc = null,
  onCancel,
  onConfirm,
  onCloseResult,
}: AdminTestSaveRecalcDialogProps) {
  const outcome = describeAdminTestRecalc(recalc);
  const busy = saving;

  if (mode === "confirm") {
    return (
      <DismissibleOverlay
        className={styles.deleteDialogOverlay}
        role="presentation"
        onDismiss={onCancel}
        disabled={busy}
      >
        <div
          className={styles.deleteDialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="test-save-recalc-confirm-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className={`${styles.deleteDialogIconWrap} ${styles.deleteDialogIconWrapWarn}`}
          >
            <AlertTriangle size={28} className={styles.deleteDialogIconWarn} />
          </div>

          <h2
            id="test-save-recalc-confirm-title"
            className={styles.deleteDialogTitle}
          >
            Сохранить изменения?
          </h2>

          <div className={styles.deleteDialogStats}>
            <p className={styles.deleteDialogStatsHint}>
              Правки запишутся в историю изменений. Старые сдачи будут
              пересчитаны только если изменились эталон, вес, варианты ответа
              или состав вопросов.
            </p>
            <p className={styles.deleteDialogStatsHint}>
              Вопросы, помеченные к удалению, исчезнут из теста после
              сохранения. До сохранения их можно вернуть.
            </p>
            <p className={styles.deleteDialogStatsHint}>
              Добавление новых вопросов или косметические правки текста сами по
              себе результат прошлых сдач не меняют.
            </p>
          </div>

          {saveError ? (
            <p className={styles.deleteDialogError}>{saveError}</p>
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
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              disabled={busy}
              onClick={onConfirm}
            >
              {busy ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </div>
      </DismissibleOverlay>
    );
  }

  const Icon =
    outcome.kind === "error"
      ? AlertTriangle
      : outcome.kind === "skipped"
        ? Info
        : CheckCircle2;
  const iconWrapClass =
    outcome.kind === "error"
      ? styles.deleteDialogIconWrap
      : outcome.kind === "skipped"
        ? `${styles.deleteDialogIconWrap} ${styles.deleteDialogIconWrapInfo}`
        : `${styles.deleteDialogIconWrap} ${styles.deleteDialogIconWrapOk}`;
  const iconClass =
    outcome.kind === "error"
      ? styles.deleteDialogIcon
      : outcome.kind === "skipped"
        ? styles.deleteDialogIconInfo
        : styles.deleteDialogIconOk;

  return (
    <DismissibleOverlay
      className={styles.deleteDialogOverlay}
      role="presentation"
      onDismiss={onCloseResult}
    >
      <div
        className={styles.deleteDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="test-save-recalc-result-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={iconWrapClass}>
          <Icon size={28} className={iconClass} />
        </div>

        <h2
          id="test-save-recalc-result-title"
          className={styles.deleteDialogTitle}
        >
          {outcome.title}
        </h2>

        <div className={styles.deleteDialogStats}>
          <p className={styles.deleteDialogStatsLabel}>Решение по пересчёту</p>
          {outcome.kind === "recalculated" ? (
            <>
              <p className={styles.deleteDialogStatsValue}>
                {outcome.updated} из {outcome.sessions}
              </p>
              <p className={styles.deleteDialogStatsHint}>
                Обновлено сессий по результатам пересчёта.
              </p>
            </>
          ) : (
            <p className={styles.deleteDialogStatsHint}>{outcome.summary}</p>
          )}

          {outcome.reasons.length > 0 ? (
            <ul className={styles.deleteDialogList}>
              {outcome.reasons.map((reason) => (
                <li key={reason}>
                  <strong>Причина</strong>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className={styles.deleteDialogActions}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            onClick={onCloseResult}
          >
            Понятно
          </button>
        </div>
      </div>
    </DismissibleOverlay>
  );
}
