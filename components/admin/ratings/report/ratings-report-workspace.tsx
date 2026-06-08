"use client";

import reportStyles from "@/components/admin/attendance/report/report.module.css";
import ratingReportStyles from "@/components/admin/ratings/report/ratings-report.module.css";
import { RatingsReportGrid } from "@/components/admin/ratings/report/ratings-report-grid";
import { RatingsReportToolbar } from "@/components/admin/ratings/report/ratings-report-toolbar";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import { useCabinetChrome } from "@/contexts/cabinet-chrome-context";
import { fetchRatingsReport } from "@/lib/admin/ratings-report-api";
import { exportRatingsReportExcel } from "@/lib/admin/ratings-report-export";
import type {
  RatingsReportData,
  RatingsReportSortDir,
  RatingsReportSortKey,
} from "@/lib/admin/ratings-report-types";
import {
  buildValueMap,
  filterReportStudents,
  formatReportPeriod,
  sortReportStudents,
  uniqueFilterOptions,
} from "@/lib/admin/ratings-report-utils";
import type { ReportPeriodSelection } from "@/components/admin/attendance/report/period-modal";
import type { RatingsReportColumnKind } from "@/lib/admin/ratings-report-types";
import {
  filterRatingsColumns,
  filterRatingsValues,
  formatSupervisorPeriodLabel,
} from "@/lib/supervisor/supervisor-report-utils";
import { useCallback, useEffect, useMemo, useState } from "react";

interface RatingsReportWorkspaceProps {
  onBack: () => void;
  title?: string;
  fileNamePrefix?: string;
  columnKinds?: RatingsReportColumnKind[];
  summaryKeys?: string[];
  periodSelection?: ReportPeriodSelection | null;
}

export function RatingsReportWorkspace({
  onBack,
  title,
  fileNamePrefix = "reyting",
  columnKinds,
  summaryKeys,
  periodSelection = null,
}: RatingsReportWorkspaceProps) {
  const { setImmersive } = useCabinetChrome();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<RatingsReportData | null>(null);
  const [valueMap, setValueMap] = useState(buildValueMap([]));

  const [searchFio, setSearchFio] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [sortKey, setSortKey] = useState<RatingsReportSortKey>("final");
  const [sortDir, setSortDir] = useState<RatingsReportSortDir>("desc");

  useEffect(() => {
    setImmersive(true);
    return () => setImmersive(false);
  }, [setImmersive]);

  const applyResponse = useCallback(
    (data: RatingsReportData) => {
      const columns = filterRatingsColumns(data.columns, {
        kinds: columnKinds,
        summaryKeys,
        period: periodSelection,
      });
      const values = filterRatingsValues(data.values, columns);
      const nextReport = { ...data, columns, values };
      setReport(nextReport);
      setValueMap(buildValueMap(values));
    },
    [columnKinds, periodSelection, summaryKeys],
  );

  const loadReport = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await fetchRatingsReport();
      if (!response.status) {
        throw new Error(response.error ?? "Не удалось загрузить отчёт");
      }
      applyResponse({
        period: response.period ?? null,
        students: response.students ?? [],
        columns: response.columns ?? [],
        values: response.values ?? [],
        message: response.message,
      });
    } catch (err) {
      setReport(null);
      setValueMap(buildValueMap([]));
      setError(err instanceof Error ? err.message : "Ошибка загрузки отчёта");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyResponse]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const filterOptions = useMemo(
    () => (report ? uniqueFilterOptions(report.students) : null),
    [report],
  );

  const filteredStudents = useMemo(() => {
    if (!report) {
      return [];
    }
    const filtered = filterReportStudents(report.students, {
      searchFio,
      classFilter,
      schoolFilter,
      groupFilter,
    });
    return sortReportStudents(filtered, sortKey, sortDir);
  }, [report, searchFio, classFilter, schoolFilter, groupFilter, sortKey, sortDir]);

  const periodLabel = periodSelection
    ? formatSupervisorPeriodLabel(periodSelection)
    : formatReportPeriod(report?.period ?? null);
  const fileName = periodSelection
    ? `${fileNamePrefix}_${periodSelection.dateFrom}_${periodSelection.dateTo}.xlsx`
    : report?.period
      ? `${fileNamePrefix}_${report.period.date_from}_${report.period.date_to}.xlsx`
      : `${fileNamePrefix}_snapshot.xlsx`;

  const handleSort = (key: RatingsReportSortKey) => {
    if (sortKey === key) {
      setSortDir((value) => (value === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "fio" ? "asc" : "desc");
  };

  const handleExport = () => {
    if (!report) {
      return;
    }
    setExporting(true);
    try {
      exportRatingsReportExcel(report, filteredStudents, valueMap, fileName);
    } finally {
      window.setTimeout(() => setExporting(false), 300);
    }
  };

  if (loading) {
    return (
      <div className={reportStyles.workspace}>
        <LoadingState label="Загрузка отчёта по рейтингу…" variant="panel" />
      </div>
    );
  }

  return (
    <div className={reportStyles.workspace}>
      <RatingsReportToolbar
        onBack={onBack}
        title={title}
        periodLabel={periodLabel}
        fileName={fileName}
        rowCountLabel={String(filteredStudents.length)}
        columnCountLabel={String(report?.columns.length ?? 0)}
        onExport={handleExport}
        onRefresh={() => void loadReport(true)}
        exporting={exporting}
        refreshing={refreshing}
      />

      {error ? <p className={styles.errorText}>{error}</p> : null}

      {!error && report && report.students.length === 0 ? (
        <div className={ratingReportStyles.emptyReport}>
          <p>{report.message ?? "Рейтинг ещё не рассчитан за выбранный период."}</p>
        </div>
      ) : null}

      {!error && report && report.students.length > 0 ? (
        <RatingsReportGrid
          students={filteredStudents}
          columns={report.columns}
          valueMap={valueMap}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          searchFio={searchFio}
          onSearchFioChange={setSearchFio}
          classFilter={classFilter}
          onClassFilterChange={setClassFilter}
          schoolFilter={schoolFilter}
          onSchoolFilterChange={setSchoolFilter}
          groupFilter={groupFilter}
          onGroupFilterChange={setGroupFilter}
          filterOptions={filterOptions}
        />
      ) : null}
    </div>
  );
}
