"use client";

import reportStyles from "@/components/admin/attendance/report/report.module.css";
import styles from "@/components/admin/upload/admin-upload.module.css";
import testStyles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchUserImportReport } from "@/lib/admin/admin-upload-api";
import { exportImportReportExcel } from "@/lib/admin/admin-upload-export";
import type {
  ExternalTestResultImportReportRow,
  UserImportReport,
  UserImportReportRow,
} from "@/lib/admin/admin-upload-types";
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

function externalResultStatusLabel(row: ExternalTestResultImportReportRow): string {
  if (row.status === "imported") {
    return "Загружен";
  }
  if (row.status === "error") {
    return "Ошибка";
  }
  return row.status;
}

function rowText(row: UserImportReportRow | ExternalTestResultImportReportRow): string {
  return Object.values(row)
    .filter((value) => value !== null && value !== undefined)
    .join(" ")
    .toLowerCase();
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
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const filteredRows = useMemo(() => {
    const rows = report?.rows ?? [];
    const query = search.trim().toLowerCase();
    if (!query) {
      return rows;
    }
    return rows.filter((row) => rowText(row).includes(query));
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

  const isExternalResults = report.import_type === "external_test_results";
  const userRows = filteredRows as UserImportReportRow[];
  const externalRows = filteredRows as ExternalTestResultImportReportRow[];

  return (
    <div className={styles.reportPage}>
      <header className={reportStyles.excelRibbon} aria-label="Отчёт импорта">
        <div className={reportStyles.excelRow}>
          <section className={`${reportStyles.excelZone} ${reportStyles.excelZoneInfo}`}>
            <span className={reportStyles.excelZoneLabel}>Информация</span>
            <div className={reportStyles.excelZoneInfoRow}>
              <div className={reportStyles.excelZoneBody}>
                <div className={reportStyles.excelDocBlock}>
                  <p className={reportStyles.excelDocTitle}>
                    {isExternalResults ? "Импорт результатов тестов" : "Импорт пользователей"} #{jobId}
                  </p>
                  <p className={reportStyles.excelDocPeriod}>
                    {isExternalResults ? "Загружено" : "Создано"}: {report.successful}
                    {report.skipped > 0 ? ` · Пропущено: ${report.skipped}` : ""}
                    {report.failed > 0 ? ` · Ошибок: ${report.failed}` : ""}
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
                onClick={() => exportImportReportExcel(report)}
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
          placeholder={
            isExternalResults
              ? "Поиск по ФИО, студенту, тесту…"
              : "Поиск по ФИО, логину, группе…"
          }
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className={styles.reportTableWrap}>
        <table className={styles.reportTable}>
          <thead>
            {isExternalResults ? (
              <tr>
                <th>Строка</th>
                <th>ФИО из файла</th>
                <th>Студент CPM</th>
                <th>ID студента</th>
                <th>ID теста</th>
                <th>Тест</th>
                <th>Процент</th>
                <th>Верных</th>
                <th>Дата завершения</th>
                <th>Логин</th>
                <th>Статус</th>
                <th>Комментарий</th>
              </tr>
            ) : (
              <tr>
                <th>Строка</th>
                <th>ФИО</th>
                <th>Класс</th>
                <th>Школа</th>
                <th>Telegram</th>
                <th>Проктор</th>
                <th>Группа</th>
                <th>Логин</th>
                <th>Пароль</th>
                <th>Статус</th>
              </tr>
            )}
          </thead>
          <tbody>
            {isExternalResults ? (
              externalRows.map((row) => (
                <tr
                  key={`${row.row}-${row.full_name}`}
                  className={row.status === "error" ? styles.previewRowError : undefined}
                >
                  <td>{row.row}</td>
                  <td>{row.full_name}</td>
                  <td>{row.student_full_name ?? "—"}</td>
                  <td>{row.student_id ?? "—"}</td>
                  <td>{row.test_id ?? "—"}</td>
                  <td>{row.test_name ?? "—"}</td>
                  <td>{row.percent ?? "—"}</td>
                  <td>{row.correct_count ?? "—"}</td>
                  <td>{row.completed_at ?? "—"}</td>
                  <td>{row.login ?? "—"}</td>
                  <td>{externalResultStatusLabel(row)}</td>
                  <td>{row.message ?? "—"}</td>
                </tr>
              ))
            ) : (
            userRows.map((row) => (
              <tr
                key={`${row.row}-${row.full_name}`}
                className={row.status === "skipped" ? styles.previewRowSkip : undefined}
              >
                <td>{row.row}</td>
                <td>{row.full_name}</td>
                <td>{row.class ?? "—"}</td>
                <td>{row.school_name ?? "—"}</td>
                <td>{row.tg_name ?? "—"}</td>
                <td>{row.proctor_name ?? "—"}</td>
                <td>{row.group_name ?? (row.message === "Без группы" ? "Без группы" : "—")}</td>
                <td>{row.login ?? "—"}</td>
                <td>{row.password ?? "—"}</td>
                <td>{statusLabel(row)}</td>
              </tr>
            ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
