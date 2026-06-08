"use client";

import reportStyles from "@/components/admin/attendance/report/report.module.css";
import { ReportLegend } from "@/components/admin/attendance/report/report-legend";
import { ReportMacClose } from "@/components/admin/attendance/report/report-mac-close";
import { ReportTypePicker } from "@/components/admin/attendance/report/report-type-picker";
import type { AttendanceType } from "@/lib/attendance/attendance-types";
import type { ReportTool } from "@/lib/attendance/attendance-report-types";
import {
  Brush,
  Eraser,
  MousePointer2,
  Pencil,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";
import { type ReactNode } from "react";

interface ReportToolbarProps {
  onBack: () => void;
  periodLabel: string;
  fileName: string;
  rowCountLabel: string;
  title?: string;
  tool: ReportTool;
  onToolChange: (tool: ReportTool) => void;
  typeId: number;
  onTypeIdChange: (id: number) => void;
  types: AttendanceType[];
  onExport: () => void;
  onRefresh: () => void;
  exporting?: boolean;
  refreshing?: boolean;
  readOnly?: boolean;
}

const TOOLS: { id: ReportTool; label: string; icon: typeof Pencil }[] = [
  { id: "cursor", label: "Просмотр", icon: MousePointer2 },
  { id: "pencil", label: "Карандаш", icon: Pencil },
  { id: "brush", label: "Кисть", icon: Brush },
  { id: "eraser", label: "Ластик", icon: Eraser },
];

function ExcelZone({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${reportStyles.excelZone} ${className ?? ""}`}>
      <span className={reportStyles.excelZoneLabel}>{label}</span>
      <div className={reportStyles.excelZoneBody}>{children}</div>
    </section>
  );
}

export function ReportToolbar({
  onBack,
  periodLabel,
  fileName,
  rowCountLabel,
  title = "Журнал посещаемости",
  tool,
  onToolChange,
  typeId,
  onTypeIdChange,
  types,
  onExport,
  onRefresh,
  exporting = false,
  refreshing = false,
  readOnly = false,
}: ReportToolbarProps) {
  const showTypePicker = !readOnly && (tool === "pencil" || tool === "brush");

  return (
    <header className={reportStyles.excelRibbon} aria-label="Панель журнала">
      <div className={reportStyles.excelRow}>
        <section
          className={`${reportStyles.excelZone} ${reportStyles.excelZoneInfo}`}
        >
          <span className={reportStyles.excelZoneLabel}>Информация</span>
          <div className={reportStyles.excelZoneInfoRow}>
            <ReportMacClose onClose={onBack} />
            <div className={reportStyles.excelZoneBody}>
              <div className={reportStyles.excelDocBlock}>
                <p className={reportStyles.excelDocTitle}>{title}</p>
                <p className={reportStyles.excelDocPeriod} title={periodLabel}>
                  {periodLabel}
                </p>
                <p className={reportStyles.excelDocFile} title={fileName}>
                  {fileName}
                </p>
              </div>
              <span className={reportStyles.excelStudentCount}>
                Ученики: <strong>{rowCountLabel}</strong>
              </span>
            </div>
          </div>
        </section>

        <ExcelZone label="Действия" className={reportStyles.excelZoneActions}>
          <button
            type="button"
            className={reportStyles.exportBtn}
            title="Экспорт в Excel"
            disabled={exporting}
            onClick={onExport}
          >
            <FileSpreadsheet
              size={18}
              aria-hidden
              className={reportStyles.exportIcon}
            />
            <span>{exporting ? "Экспорт…" : "Экспорт"}</span>
          </button>
          <button
            type="button"
            className={reportStyles.refreshBtn}
            title={refreshing ? "Обновление…" : "Обновить данные"}
            disabled={refreshing}
            onClick={onRefresh}
          >
            <RefreshCw size={17} aria-hidden />
            <span>{refreshing ? "Обновление…" : "Обновить"}</span>
          </button>
        </ExcelZone>
      </div>

      {readOnly ? null : (
        <>
      <div className={reportStyles.excelRowDivider} aria-hidden />

      <div className={reportStyles.excelRow}>
        <ExcelZone label="Инструменты" className={reportStyles.excelZoneTools}>
          <div className={reportStyles.toolsRow}>
            <div className={reportStyles.toolbarGroup}>
              {TOOLS.map((item) => {
                const Icon = item.icon;
                const active = tool === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`${reportStyles.toolBtn} ${active ? reportStyles.toolBtnActive : ""}`}
                    title={item.label}
                    aria-pressed={active}
                    onClick={() => onToolChange(item.id)}
                  >
                    <Icon size={18} aria-hidden />
                    <span className={reportStyles.toolBtnCaption}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <ReportTypePicker
              types={types}
              value={typeId}
              onChange={onTypeIdChange}
              inactive={!showTypePicker}
            />
          </div>
        </ExcelZone>

        <ExcelZone label="Легенда" className={reportStyles.excelZoneLegend}>
          <ReportLegend types={types} ribbon />
        </ExcelZone>
      </div>
        </>
      )}
    </header>
  );
}
