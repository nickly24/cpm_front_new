"use client";

import reportStyles from "@/components/admin/attendance/report/report.module.css";
import { REPORT_PALETTE_CLASS } from "@/components/admin/attendance/report/report-palette-classes";
import type { StudentAttendanceSummary } from "@/lib/attendance/attendance-report-summary";
import type { AttendancePalette } from "@/lib/attendance/attendance-palette";

const SUMMARY_ORDER: AttendancePalette[] = [
  "present",
  "excused",
  "remoteA",
  "remoteB",
  "remoteC",
  "late",
  "joined",
  "hybrid",
];

const SUMMARY_SHORT: Record<AttendancePalette, string> = {
  present: "оч",
  excused: "ув",
  remoteA: "д1",
  remoteB: "д2",
  remoteC: "ду",
  late: "оп",
  joined: "пс",
  hybrid: "од",
};

interface ReportSummaryCellsProps {
  summary: StudentAttendanceSummary;
}

export function ReportSummaryCells({ summary }: ReportSummaryCellsProps) {
  const chips = SUMMARY_ORDER.flatMap((palette) => {
    const count = summary.byPalette[palette];
    if (!count) return [];
    return [{ palette, count, label: SUMMARY_SHORT[palette] }];
  });

  const title = [
    `Отмечено: ${summary.marked} из ${summary.total}`,
    summary.empty > 0 ? `Пусто: ${summary.empty}` : null,
    ...chips.map((chip) => `${chip.label}: ${chip.count}`),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <td className={reportStyles.colSummaryStat} title={title}>
        <div className={reportStyles.summaryStatBox}>
          <span className={reportStyles.summaryRatioLine}>
            <strong className={reportStyles.summaryMarked}>
              {summary.marked}
            </strong>
            <span className={reportStyles.summaryRatioSep}>/</span>
            <span className={reportStyles.summaryTotal}>{summary.total}</span>
          </span>
        </div>
      </td>
      <td className={reportStyles.colSummaryChips} title={title}>
        <div className={reportStyles.summaryChipsRow}>
          {chips.length > 0 ? (
            chips.map((chip) => (
              <span
                key={chip.palette}
                className={`${reportStyles.summaryChip} ${REPORT_PALETTE_CLASS[chip.palette]}`}
              >
                <span className={reportStyles.summaryChipCount}>{chip.count}</span>
                <span className={reportStyles.summaryChipLabel}>{chip.label}</span>
              </span>
            ))
          ) : (
            <span className={reportStyles.summaryEmpty}>—</span>
          )}
        </div>
      </td>
    </>
  );
}
