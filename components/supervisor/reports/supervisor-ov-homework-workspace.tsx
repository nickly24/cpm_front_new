"use client";

import reportStyles from "@/components/admin/attendance/report/report.module.css";
import ratingReportStyles from "@/components/admin/ratings/report/ratings-report.module.css";
import styles from "@/components/admin/tests/admin-tests.module.css";
import type { ReportPeriodSelection } from "@/components/admin/attendance/report/period-modal";
import { ReportMacClose } from "@/components/admin/attendance/report/report-mac-close";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchSupervisorOvHomeworkReport } from "@/lib/supervisor/supervisor-homework-api";
import { exportSupervisorOvHomeworkExcel } from "@/lib/supervisor/supervisor-homework-export";
import {
  filterHomeworksByPeriod,
  formatSupervisorPeriodLabel,
} from "@/lib/supervisor/supervisor-report-utils";
import { FileSpreadsheet, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface SupervisorOvHomeworkWorkspaceProps {
  period: ReportPeriodSelection;
  onBack: () => void;
}

export function SupervisorOvHomeworkWorkspace({
  period,
  onBack,
}: SupervisorOvHomeworkWorkspaceProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [homeworks, setHomeworks] = useState<
    Awaited<ReturnType<typeof fetchSupervisorOvHomeworkReport>>["homeworks"]
  >([]);
  const [students, setStudents] = useState<
    Awaited<ReturnType<typeof fetchSupervisorOvHomeworkReport>>["students"]
  >([]);
  const [search, setSearch] = useState("");

  const load = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await fetchSupervisorOvHomeworkReport();
      if (!response.status) {
        throw new Error(response.error ?? "Не удалось загрузить отчёт");
      }
      const filteredHomeworks = filterHomeworksByPeriod(
        response.homeworks ?? [],
        period,
      );
      setHomeworks(filteredHomeworks);
      setStudents(response.students ?? []);
    } catch (err) {
      setHomeworks([]);
      setStudents([]);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return students;
    }
    return students.filter((student) =>
      student.full_name.toLowerCase().includes(query),
    );
  }, [search, students]);

  const periodLabel = formatSupervisorPeriodLabel(period);
  const fileName = `domashnie_${period.dateFrom}_${period.dateTo}.xlsx`;

  if (loading) {
    return <LoadingState label="Загрузка отчёта по домашним…" variant="panel" />;
  }

  return (
    <div className={reportStyles.workspace}>
      <header className={reportStyles.excelRibbon} aria-label="Отчёт по домашним">
        <div className={reportStyles.excelRow}>
          <section className={`${reportStyles.excelZone} ${reportStyles.excelZoneInfo}`}>
            <span className={reportStyles.excelZoneLabel}>Информация</span>
            <div className={reportStyles.excelZoneInfoRow}>
              <ReportMacClose onClose={onBack} />
              <div className={reportStyles.excelZoneBody}>
                <div className={reportStyles.excelDocBlock}>
                  <p className={reportStyles.excelDocTitle}>Домашние задания ОВ / ДЗНВ</p>
                  <p className={reportStyles.excelDocPeriod}>{periodLabel}</p>
                  <p className={reportStyles.excelDocFile}>{fileName}</p>
                </div>
                <span className={reportStyles.excelStudentCount}>
                  Ученики: <strong>{filteredStudents.length}</strong>
                </span>
                <span className={reportStyles.excelStudentCount}>
                  Заданий: <strong>{homeworks.length}</strong>
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
                disabled={exporting || homeworks.length === 0}
                onClick={() => {
                  setExporting(true);
                  try {
                    exportSupervisorOvHomeworkExcel(
                      homeworks,
                      filteredStudents,
                      fileName,
                    );
                  } finally {
                    window.setTimeout(() => setExporting(false), 300);
                  }
                }}
              >
                <FileSpreadsheet size={18} aria-hidden className={reportStyles.exportIcon} />
                <span>{exporting ? "Экспорт…" : "Excel"}</span>
              </button>
              <button
                type="button"
                className={reportStyles.refreshBtn}
                disabled={refreshing}
                onClick={() => void load(true)}
              >
                <RefreshCw size={17} aria-hidden />
                <span>{refreshing ? "Обновление…" : "Обновить"}</span>
              </button>
            </div>
          </section>
        </div>
      </header>

      {error ? <p className={styles.errorText}>{error}</p> : null}

      {!error ? (
        <>
          <div className={ratingReportStyles.filtersRow}>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Поиск по ФИО…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {homeworks.length === 0 ? (
            <div className={ratingReportStyles.emptyReport}>
              <p>За выбранный период домашних заданий не найдено.</p>
            </div>
          ) : (
            <div className={ratingReportStyles.gridScroll}>
              <table className={ratingReportStyles.gridTable}>
                <thead>
                  <tr>
                    <th>ФИО</th>
                    <th>Кл.</th>
                    <th>Группа</th>
                    {homeworks.map((homework) => (
                      <th key={homework.id} title={homework.deadline ?? undefined}>
                        {homework.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => {
                    const resultMap = new Map(
                      student.results.map((result) => [result.homework_id, result]),
                    );
                    return (
                      <tr key={student.id}>
                        <td>{student.full_name}</td>
                        <td>{student.class}</td>
                        <td>{student.group_name ?? "—"}</td>
                        {homeworks.map((homework) => {
                          const result = resultMap.get(homework.id);
                          if (!result) {
                            return <td key={homework.id}>—</td>;
                          }
                          return (
                            <td key={homework.id} title={result.status_text}>
                              {result.result != null
                                ? `${result.result}%`
                                : result.status_text}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
