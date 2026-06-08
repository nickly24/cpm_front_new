"use client";

import reportStyles from "@/components/admin/attendance/report/report.module.css";
import { REPORT_PALETTE_CLASS } from "@/components/admin/attendance/report/report-palette-classes";
import { cn } from "@/lib/cn";
import {
  getAttendanceCellMark,
  getAttendancePalette,
} from "@/lib/attendance/attendance-palette";
import type { AttendanceType } from "@/lib/attendance/attendance-types";
import { CircleHelp } from "lucide-react";

interface ReportLegendProps {
  types: AttendanceType[];
  ribbon?: boolean;
}

const HELP_CONTENT = (
  <>
    <p>
      <strong>Зелёные</strong> — очное присутствие и отсутствие по уважительной
      причине (разные оттенки).
    </p>
    <p>
      <strong>Синие</strong> — все виды дистанционного присутствия;
      очно-дистанционное — <strong>ОД</strong>.
    </p>
    <p>
      <strong>Жёлтый</strong> — опоздание. <strong>Фиолетовый</strong> —
      присоединение после начала обучения в Сборной.
    </p>
  </>
);

export function ReportLegend({ types, ribbon = false }: ReportLegendProps) {
  const sorted = [...types].sort((a, b) => a.sort_order - b.sort_order);

  if (!ribbon) {
    return null;
  }

  return (
    <div className={reportStyles.legendBlock}>
      <div
        className={reportStyles.legendGrid}
        role="list"
        aria-label="Легенда типов"
      >
        {sorted.map((type) => {
          const palette = getAttendancePalette(type.code);
          const mark = getAttendanceCellMark(type.code);
          return (
            <div
              key={type.id}
              className={reportStyles.legendGridItem}
              role="listitem"
              title={type.name_ru}
            >
              <span
                className={cn(
                  reportStyles.legendMarkSwatch,
                  REPORT_PALETTE_CLASS[palette],
                )}
              >
                {mark ? (
                  <span
                    className={cn(
                      reportStyles.legendMarkLetter,
                      mark.length > 1 && reportStyles.cellMarkWide,
                    )}
                  >
                    {mark}
                  </span>
                ) : null}
              </span>
              <span className={reportStyles.legendGridLabel}>{type.name_ru}</span>
            </div>
          );
        })}
      </div>

      <div className={reportStyles.legendHelpWrap}>
        <button
          type="button"
          className={reportStyles.legendHelpBtn}
          aria-describedby="report-legend-help-popover"
        >
          <CircleHelp size={14} aria-hidden />
          <span>Справка</span>
        </button>
        <div
          id="report-legend-help-popover"
          className={reportStyles.legendHelpPopover}
          role="tooltip"
        >
          {HELP_CONTENT}
        </div>
      </div>
    </div>
  );
}
