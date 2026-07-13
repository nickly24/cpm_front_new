"use client";

import reportStyles from "@/components/admin/attendance/report/report.module.css";
import styles from "@/components/admin/upload/admin-upload.module.css";
import testStyles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchUserImportReport } from "@/lib/admin/admin-upload-api";
import { exportImportReportExcel } from "@/lib/admin/admin-upload-export";
import type {
  CardImportReportRow,
  CardTransformPreviewSummary,
  CardTransformReportRow,
  ExternalTestResultImportReportRow,
  UserImportReport,
  UserImportReportRow,
} from "@/lib/admin/admin-upload-types";
import { useCabinetChrome } from "@/contexts/cabinet-chrome-context";
import { ArrowLeft, Download } from "lucide-react";
import { useRouter } from "next/navigation";
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

function cardImportStatusLabel(row: CardImportReportRow): string {
  if (row.status === "created") {
    return "Создана";
  }
  if (row.status === "skipped") {
    return "Пропущена";
  }
  if (row.status === "error") {
    return "Ошибка";
  }
  return row.status;
}

function cardTransformStatusLabel(row: CardTransformReportRow): string {
  if (row.status === "transformed") {
    return "Трансформирована";
  }
  if (row.status === "error") {
    return "Ошибка";
  }
  return row.status;
}

function rowText(
  row: UserImportReportRow | ExternalTestResultImportReportRow | CardImportReportRow | CardTransformReportRow,
): string {
  return Object.values(row)
    .filter((value) => value !== null && value !== undefined)
    .join(" ")
    .toLowerCase();
}

export function AdminUploadReportWorkspace({
  jobId,
  onBack,
}: AdminUploadReportWorkspaceProps) {
  const router = useRouter();
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
  const isCardsImport = report.import_type === "cards";
  const isCardsToDraft = report.import_type === "cards_to_draft";
  const userRows = filteredRows as UserImportReportRow[];
  const externalRows = filteredRows as ExternalTestResultImportReportRow[];
  const cardRows = filteredRows as CardImportReportRow[];
  const transformRows = filteredRows as CardTransformReportRow[];
  const transformSummary = isCardsToDraft
    ? (report.summary as CardTransformPreviewSummary | null | undefined)
    : null;
  const draftId =
    transformSummary?.draft_id ??
    transformRows.find((row) => row.draft_id)?.draft_id ??
    null;

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
                    {isExternalResults
                      ? "Импорт результатов тестов"
                      : isCardsToDraft
                        ? "Карточки → драфт"
                        : isCardsImport
                          ? "Импорт карточек"
                          : "Импорт пользователей"}{" "}
                    #{jobId}
                  </p>
                  <p className={reportStyles.excelDocPeriod}>
                    {isExternalResults
                      ? "Загружено"
                      : isCardsToDraft
                        ? "Трансформировано"
                        : "Создано"}
                    : {report.successful}
                    {report.skipped > 0 ? ` · Пропущено: ${report.skipped}` : ""}
                    {report.failed > 0 ? ` · Ошибок: ${report.failed}` : ""}
                    {transformSummary?.draft_title
                      ? ` · Драфт: ${transformSummary.draft_title}`
                      : ""}
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
              {draftId ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push("/cabinet/admin/tests")}
                >
                  Открыть драфт
                </Button>
              ) : null}
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
              : isCardsToDraft || isCardsImport
                ? "Поиск по вопросу, ответу…"
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
            ) : isCardsImport ? (
              <tr>
                <th>Строка</th>
                <th>Вопрос</th>
                <th>Ответ</th>
                <th>ID карточки</th>
                <th>Раздел</th>
                <th>Направление</th>
                <th>Статус</th>
                <th>Комментарий</th>
              </tr>
            ) : isCardsToDraft ? (
              <tr>
                <th>Строка</th>
                <th>Вопрос</th>
                <th>Ответ</th>
                <th>ID карточки</th>
                <th>ID драфта</th>
                <th>Раздел</th>
                <th>Направление</th>
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
            ) : isCardsImport ? (
              cardRows.map((row) => (
                <tr
                  key={`${row.row}-${row.question}`}
                  className={row.status === "skipped" ? styles.previewRowSkip : undefined}
                >
                  <td>{row.row}</td>
                  <td>{row.question}</td>
                  <td>{row.answer}</td>
                  <td>{row.card_id ?? "—"}</td>
                  <td>{row.theme_name ?? "—"}</td>
                  <td>{row.direction_name ?? "—"}</td>
                  <td>{cardImportStatusLabel(row)}</td>
                  <td>{row.message ?? "—"}</td>
                </tr>
              ))
            ) : isCardsToDraft ? (
              transformRows.map((row) => (
                <tr
                  key={`${row.row}-${row.card_id ?? row.question}`}
                  className={row.status === "error" ? styles.previewRowError : undefined}
                >
                  <td>{row.row}</td>
                  <td>{row.question}</td>
                  <td>{row.answer}</td>
                  <td>{row.card_id ?? "—"}</td>
                  <td>{row.draft_id ?? "—"}</td>
                  <td>{row.theme_name ?? "—"}</td>
                  <td>{row.direction_name ?? "—"}</td>
                  <td>{cardTransformStatusLabel(row)}</td>
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
