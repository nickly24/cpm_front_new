"use client";

import reportStyles from "@/components/admin/attendance/report/report.module.css";
import { ReportMacClose } from "@/components/admin/attendance/report/report-mac-close";
import { RefreshCw, FileSpreadsheet } from "lucide-react";

interface RatingsReportToolbarProps {
  onBack: () => void;
  periodLabel: string;
  fileName: string;
  rowCountLabel: string;
  columnCountLabel: string;
  title?: string;
  onExport: () => void;
  onRefresh: () => void;
  exporting?: boolean;
  refreshing?: boolean;
}

export function RatingsReportToolbar({
  onBack,
  periodLabel,
  fileName,
  rowCountLabel,
  columnCountLabel,
  title = "Отчёт по рейтингу",
  onExport,
  onRefresh,
  exporting = false,
  refreshing = false,
}: RatingsReportToolbarProps) {
  return (
    <header className={reportStyles.excelRibbon} aria-label="Панель отчёта рейтинга">
      <div className={reportStyles.excelRow}>
        <section className={`${reportStyles.excelZone} ${reportStyles.excelZoneInfo}`}>
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
              <span className={reportStyles.excelStudentCount}>
                Колонки: <strong>{columnCountLabel}</strong>
              </span>
            </div>
          </div>
        </section>

        <section className={`${reportStyles.excelZone} ${reportStyles.excelZoneActions}`}>
          <span className={reportStyles.excelZoneLabel}>Действия</span>
          <div className={reportStyles.excelZoneBody}>
            <button
              type="button"
              className={reportStyles.exportBtn}
              onClick={onExport}
              disabled={exporting}
            >
              <FileSpreadsheet size={18} aria-hidden className={reportStyles.exportIcon} />
              <span>{exporting ? "Экспорт…" : "Excel"}</span>
            </button>
            <button
              type="button"
              className={reportStyles.refreshBtn}
              onClick={onRefresh}
              disabled={refreshing}
            >
              <RefreshCw size={17} aria-hidden />
              <span>{refreshing ? "Обновление…" : "Обновить"}</span>
            </button>
          </div>
        </section>
      </div>
    </header>
  );
}
