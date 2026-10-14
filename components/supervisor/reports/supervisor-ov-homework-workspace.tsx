"use client";

import reportStyles from "@/components/admin/attendance/report/report.module.css";
import gridStyles from "@/components/supervisor/reports/supervisor-homework-report.module.css";
import { SupervisorOvHomeworkGrid } from "@/components/supervisor/reports/supervisor-ov-homework-grid";
import styles from "@/components/admin/tests/admin-tests.module.css";
import type { ReportPeriodSelection } from "@/components/admin/attendance/report/period-modal";
import { ReportMacClose } from "@/components/admin/attendance/report/report-mac-close";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchSupervisorOvHomeworkReport } from "@/lib/supervisor/supervisor-homework-api";
import { exportSupervisorOvHomeworkExcel } from "@/lib/supervisor/supervisor-homework-export";
import { filterSupervisorHomeworkStudents } from "@/lib/supervisor/supervisor-homework-filter";
import type { HomeworkHeaderMode } from "@/lib/supervisor/supervisor-homework-display";
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
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState("all");
  const [headerMode, setHeaderMode] = useState<HomeworkHeaderMode>("short");

  const load = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await fetchSupervisorOvHomeworkReport(period);
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
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filteredStudents = useMemo(() => {
    return filterSupervisorHomeworkStudents(students, search, classFilter);
  }, [search, students, classFilter]);
  const visibleHomeworks = useMemo(() => typeFilter === "all" ? homeworks : homeworks.filter(homework => homework.type === typeFilter), [homeworks, typeFilter]);

  const visibleHomeworkCount = useMemo(() => {
    if (typeFilter === "all") {
      return homeworks.length;
    }
    return homeworks.filter((homework) => homework.type === typeFilter).length;
  }, [homeworks, typeFilter]);

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
                  <p className={reportStyles.excelDocTitle}>Домашние задания</p>
                  <p className={reportStyles.excelDocPeriod}>{periodLabel}</p>
                  <p className={reportStyles.excelDocFile}>{fileName}</p>
                </div>
                <span className={reportStyles.excelStudentCount}>
                  Ученики: <strong>{filteredStudents.length}</strong>
                </span>
                <span className={reportStyles.excelStudentCount}>
                  Заданий: <strong>{visibleHomeworkCount}</strong>
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
                      visibleHomeworks,
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
          <div className={gridStyles.toolbar}>
            <div className={gridStyles.toolbarLeft}>
              <input
                type="search"
                className={gridStyles.searchInput}
                placeholder="Поиск по ФИО…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              <label className={gridStyles.filterField}>
                <span className={gridStyles.filterLabel}>Класс</span>
                <select aria-label="Класс" className={gridStyles.filterSelect} value={classFilter} onChange={event => setClassFilter(event.target.value)}>
                  <option value="all">Все классы</option>
                  {[...new Set(students.map(student => student.class).filter((value): value is number => value !== null))].sort((a, b) => a - b).map(value => <option key={value} value={value}>{value} класс</option>)}
                  {students.some(student => student.class === null) ? <option value="unknown">Класс не указан</option> : null}
                </select>
              </label>
              <label className={gridStyles.filterField}>
                <span className={gridStyles.filterLabel}>Тип</span>
                <select
                  className={gridStyles.filterSelect}
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(event.target.value)
                  }
                >
                  <option value="all">Все задания</option>
                  {Array.from(new Set(homeworks.map(h=>h.type))).map(name=><option key={name} value={name}>{name}</option>)}
                </select>
              </label>

              <label className={gridStyles.filterField}>
                <span className={gridStyles.filterLabel}>Колонки</span>
                <select
                  className={gridStyles.filterSelect}
                  value={headerMode}
                  onChange={(event) =>
                    setHeaderMode(event.target.value as HomeworkHeaderMode)
                  }
                >
                  <option value="short">Краткие (#номер)</option>
                  <option value="full">Полные названия</option>
                </select>
              </label>
            </div>

            <div className={gridStyles.legend} aria-label="Легенда статусов">
              <span className={gridStyles.legendItem}>
                <span className={`${gridStyles.legendSwatch} ${gridStyles.tonePending}`}>·</span>
                Не начато
              </span>
              <span className={gridStyles.legendItem}>
                <span className={`${gridStyles.legendSwatch} ${gridStyles.toneProgress}`}>…</span>
                В процессе
              </span>
              <span className={gridStyles.legendItem}>
                <span className={`${gridStyles.legendSwatch} ${gridStyles.toneOverdue}`}>!</span>
                Просрочено
              </span>
              <span className={gridStyles.legendItem}>
                <span className={`${gridStyles.legendSwatch} ${gridStyles.toneDone}`}>85</span>
                Сдано
              </span>
            </div>
          </div>

          <p className={gridStyles.hint}>
            Наведите на ячейку или заголовок колонки — увидите полное название и статус.
            Горизонтальная прокрутка для всех заданий, ФИО закреплено слева.
          </p>

          {homeworks.length === 0 ? (
            <div className={gridStyles.emptyReport}>
              <p>За выбранный период домашних заданий не найдено.</p>
            </div>
          ) : (
            <SupervisorOvHomeworkGrid
              homeworks={homeworks}
              students={filteredStudents}
              headerMode={headerMode}
              typeFilter={typeFilter}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
