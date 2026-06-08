"use client";

import reportStyles from "@/components/admin/attendance/report/report.module.css";
import styles from "@/components/admin/upload/admin-upload.module.css";
import testStyles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchUserImportReport } from "@/lib/admin/admin-upload-api";
import { exportUserImportReportExcel } from "@/lib/admin/admin-upload-export";
import type { UserImportReport, UserImportReportRow } from "@/lib/admin/admin-upload-types";
import { useCabinetChrome } from "@/contexts/cabinet-chrome-context";
import { ArrowLeft, Download } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface AdminUploadReportWorkspaceProps {
  jobId: number;
  onBack: () => void;
}

function statusLabel(row: UserImportReportRow): string {
  if (row.status === "created") {
    return row.message === "Без группы" ? "Создан (без группы)" : "Создан";
  }
  if (row.status === "skipped") {
    return "Пропущен";
  }
  return row.status;
}

export function AdminUploadReportWorkspace({
  jobId,
  onBack,
}: AdminUploadReportWorkspaceProps) {
  const { setImmersive } = useCabinetChrome();
  const [report, setReport] = useState<UserImportReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setImmersive(true);
    return () => setImmersive(false);
  }, [setImmersive]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchUserImportReport(jobId);
      setReport(response.report);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Не удалось загрузить отчёт");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const rows = report?.rows ?? [];
    const query = search.trim().toLowerCase();
    if (!query) {
      return rows;
    }
    return rows.filter((row) => {
      return (
        row.full_name.toLowerCase().includes(query) ||
        (row.login ?? "").toLowerCase().includes(query) ||
        (row.group_name ?? "").toLowerCase().includes(query) ||
        (row.proctor_name ?? "").toLowerCase().includes(query)
      );
    });
  }, [report?.rows, search]);

  if (loading) {
    return <LoadingState label="Загрузка отчёта…" variant="block" className={testStyles.stateBox} />;
  }

  if (error || !report) {
    return (
      <div className={testStyles.stateBox}>
        {error ?? "Отчёт не найден"}
        <div className={styles.reportBackRow}>
          <Button type="button" variant="ghost" onClick={onBack}>
            Назад
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.reportPage}>
      <header className={reportStyles.excelRibbon} aria-label="Отчёт импорта">
        <div className={reportStyles.excelRow}>
          <section className={`${reportStyles.excelZone} ${reportStyles.excelZoneInfo}`}>
            <span className={reportStyles.excelZoneLabel}>Информация</span>
            <div className={reportStyles.excelZoneInfoRow}>
              <div className={reportStyles.excelZoneBody}>
                <div className={reportStyles.excelDocBlock}>
                  <p className={reportStyles.excelDocTitle}>Импорт пользователей #{jobId}</p>
                  <p className={reportStyles.excelDocPeriod}>
                    Создано: {report.successful} · Пропущено: {report.skipped}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className={`${reportStyles.excelZone} ${reportStyles.excelZoneActions}`}>
            <span className={reportStyles.excelZoneLabel}>Действия</span>
            <div className={reportStyles.excelZoneBody}>
              <Button type="button" variant="ghost" onClick={onBack}>
                <ArrowLeft size={16} aria-hidden />
                К журналу
              </Button>
              <Button
                type="button"
                onClick={() => exportUserImportReportExcel(report.rows, jobId)}
              >
                <Download size={16} aria-hidden />
                Excel
              </Button>
            </div>
          </section>
        </div>
      </header>

      <div className={styles.reportToolbar}>
        <input
          type="search"
          className={testStyles.searchInput}
          placeholder="Поиск по ФИО, логину, группе…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className={styles.reportTableWrap}>
        <table className={styles.reportTable}>
          <thead>
            <tr>
              <th>Строка</th>
              <th>ФИО</th>
              <th>Класс</th>
              <th>Школа</th>
              <th>Проктор</th>
              <th>Группа</th>
              <th>Логин</th>
              <th>Пароль</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr
                key={`${row.row}-${row.full_name}`}
                className={row.status === "skipped" ? styles.previewRowSkip : undefined}
              >
                <td>{row.row}</td>
                <td>{row.full_name}</td>
                <td>{row.class ?? "—"}</td>
                <td>{row.school_name ?? "—"}</td>
                <td>{row.proctor_name ?? "—"}</td>
                <td>{row.group_name ?? (row.message === "Без группы" ? "Без группы" : "—")}</td>
                <td>{row.login ?? "—"}</td>
                <td>{row.password ?? "—"}</td>
                <td>{statusLabel(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
