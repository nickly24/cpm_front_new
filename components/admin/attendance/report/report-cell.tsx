"use client";

import reportStyles from "@/components/admin/attendance/report/report.module.css";
import { paletteClassForCode } from "@/components/admin/attendance/report/report-palette-classes";
import { getAttendanceCellMark } from "@/lib/attendance/attendance-palette";
import type {
  AttendanceReportEntry,
  CellUiState,
  ReportTool,
} from "@/lib/attendance/attendance-report-types";
import { cn } from "@/lib/cn";
import { memo } from "react";

function paletteClassForEntry(entry: AttendanceReportEntry | null): string {
  if (!entry) return reportStyles.cellEmpty;
  return paletteClassForCode(entry.type_code);
}

interface ReportCellProps {
  entry: AttendanceReportEntry | null;
  tool: ReportTool;
  uiState?: CellUiState;
  interactive: boolean;
  onPointerDown: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onPointerEnter: () => void;
}

export const ReportCell = memo(function ReportCell({
  entry,
  tool,
  uiState,
  interactive,
  onPointerDown,
  onPointerEnter,
}: ReportCellProps) {
  const phase = uiState?.phase ?? "idle";
  const hasEntry = Boolean(entry);
  const paletteClass =
    phase === "pending" ? reportStyles.cellPending : paletteClassForEntry(entry);
  const mark =
    hasEntry && entry && phase !== "pending"
      ? getAttendanceCellMark(entry.type_code)
      : null;

  return (
    <button
      type="button"
      className={cn(
        reportStyles.cell,
        paletteClass,
        interactive && reportStyles.cellInteractive,
        phase === "success" && reportStyles.cellSuccess,
        phase === "error" && reportStyles.cellError,
        entry?.zap_id && reportStyles.cellWithZap,
      )}
      title={entry?.type_name ?? undefined}
      aria-label={entry?.type_name ?? "Пусто"}
      onMouseDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        onPointerDown(event);
      }}
      onMouseEnter={() => onPointerEnter()}
      onClick={(event) => {
        if (tool !== "cursor") {
          event.preventDefault();
        }
      }}
    >
      {mark ? (
        <span
          className={cn(
            reportStyles.cellMark,
            mark.length > 1 && reportStyles.cellMarkWide,
          )}
        >
          {mark}
        </span>
      ) : null}
    </button>
  );
});
