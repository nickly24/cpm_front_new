"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, Users } from "lucide-react";
import styles from "./proctor.module.css";

export type ProctorConfirmDialogState =
  | {
      kind: "delete";
      title: string;
      description: string;
    }
  | {
      kind: "bulk";
      title: string;
      description: string;
      pending: number;
    };

interface ProctorConfirmDialogProps {
  state: ProctorConfirmDialogState;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ProctorConfirmDialog({
  state,
  loading = false,
  onCancel,
  onConfirm,
}: ProctorConfirmDialogProps) {
  const isDanger = state.kind === "delete";
  const Icon = state.kind === "bulk" ? Users : AlertTriangle;

  return (
    <div
      className={styles.confirmOverlay}
      role="presentation"
      onClick={loading ? undefined : onCancel}
    >
      <div
        className={styles.confirmDialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="proctor-confirm-title"
        aria-describedby="proctor-confirm-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`${styles.confirmIconWrap} ${
            isDanger ? styles.confirmIconWrapDanger : styles.confirmIconWrapInfo
          }`.trim()}
        >
          <Icon size={22} aria-hidden />
        </div>

        <h2 id="proctor-confirm-title" className={styles.confirmTitle}>
          {state.title}
        </h2>
        <p id="proctor-confirm-desc" className={styles.confirmText}>
          {state.description}
        </p>

        <div className={styles.confirmActions}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={onCancel}
          >
            Отмена
          </Button>
          <Button
            type="button"
            size="sm"
            className={
              isDanger ? styles.confirmBtnDanger : styles.confirmBtnPrimary
            }
            disabled={loading}
            onClick={onConfirm}
          >
            {loading
              ? "Выполнение…"
              : state.kind === "bulk"
                ? `Занести (${state.pending})`
                : "Удалить сдачу"}
          </Button>
        </div>
      </div>
    </div>
  );
}
