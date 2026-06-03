"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import { X } from "lucide-react";

interface AdminFullscreenBackProps {
  onBack: () => void;
  label?: string;
}

export function AdminFullscreenBack({
  onBack,
  label = "Назад к списку",
}: AdminFullscreenBackProps) {
  return (
    <button type="button" className={styles.backBtn} onClick={onBack}>
      <span className={styles.backBtnIcon} aria-hidden>
        <X size={18} strokeWidth={2.5} />
      </span>
      <span className={styles.backBtnText}>{label}</span>
    </button>
  );
}
