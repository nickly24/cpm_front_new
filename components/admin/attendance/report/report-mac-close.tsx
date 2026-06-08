"use client";

import reportStyles from "@/components/admin/attendance/report/report.module.css";
import { X } from "lucide-react";

interface ReportMacCloseProps {
  onClose: () => void;
  label?: string;
}

export function ReportMacClose({
  onClose,
  label = "Назад",
}: ReportMacCloseProps) {
  return (
    <button
      type="button"
      className={reportStyles.reportCloseBtn}
      onClick={onClose}
      title={label}
      aria-label={label}
    >
      <X size={13} strokeWidth={2.5} aria-hidden />
    </button>
  );
}
