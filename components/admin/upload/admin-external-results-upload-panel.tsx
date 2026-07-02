"use client";

import styles from "@/components/admin/upload/admin-upload.module.css";
import testStyles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import {
  commitExternalTestResultsSession,
  fetchExternalTests,
  parseExternalTestResultsFile,
} from "@/lib/admin/admin-upload-api";
import {
  ADMIN_EXTERNAL_TEST_RESULTS_ACCEPT,
  formatUploadFileSize,
  type ExternalTestOption,
  type ExternalTestResultImportRow,
  type ExternalTestResultsImportPreview,
  type UserImportJob,
} from "@/lib/admin/admin-upload-types";
import { CheckCircle2, FileSpreadsheet, FileUp, Upload, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type PreviewFilter = "all" | "import" | "errors";

interface AdminExternalResultsUploadPanelProps {
  onCommitted: (job: UserImportJob) => void;
}

function isXlsxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".xlsx") || file.type.includes("spreadsheetml");
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("ru-RU");
}

function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const numberValue = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (Number.isNaN(numberValue)) {
    return String(value);
  }
  return `${numberValue.toFixed(2).replace(/\.00$/, "")}%`;
}

function externalTestLabel(test: ExternalTestOption): string {
  const parts = [
    test.direction_name,
    test.name,
    test.date ? formatDate(test.date) : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function rowStatusLabel(row: ExternalTestResultImportRow): string {
  return row.errors.length > 0 ? row.errors.join("; ") : "К импорту";
}

export function AdminExternalResultsUploadPanel({
  onCommitted,
}: AdminExternalResultsUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tests, setTests] = useState<ExternalTestOption[]>([]);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [testsLoading, setTestsLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [sourceFilename, setSourceFilename] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [preview, setPreview] = useState<ExternalTestResultsImportPreview | null>(null);
  const [filter, setFilter] = useState<PreviewFilter>("all");
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadTests() {
      setTestsLoading(true);
      setError(null);
      try {
        const response = await fetchExternalTests();
        if (!mounted) {
          return;
        }
        setTests(response ?? []);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Не удалось загрузить список тестов");
        }
      } finally {
        if (mounted) {
          setTestsLoading(false);
        }
      }
    }
    void loadTests();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedTest = useMemo(
    () => tests.find((test) => String(test.numeric_id ?? test.id) === selectedTestId),
    [selectedTestId, tests],
  );

  const filteredRows = useMemo(() => {
    const rows = preview?.rows ?? [];
    if (filter === "import") {
      return rows.filter((row) => row.errors.length === 0);
    }
    if (filter === "errors") {
      return rows.filter((row) => row.errors.length > 0);
    }
    return rows;
  }, [filter, preview?.rows]);

  const canCommit =
    Boolean(sessionId) &&
    !committing &&
    !parsing &&
    (preview?.summary.import_rows ?? 0) > 0 &&
    (preview?.summary.row_errors ?? 0) === 0;

  const resetFile = () => {
    setFile(null);
    setSourceFilename(null);
    setSessionId(null);
    setPreview(null);
    setFilter("all");
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleParse = async (nextFile: File) => {
    if (!selectedTestId) {
      window.alert("Сначала выберите внешний тест");
      return;
    }
    if (!isXlsxFile(nextFile)) {
      window.alert("Выберите файл .xlsx");
      return;
    }
    setParsing(true);
    setError(null);
    try {
      const response = await parseExternalTestResultsFile(nextFile, selectedTestId);
      if (!response.status) {
        throw new Error("Не удалось разобрать файл");
      }
      setFile(nextFile);
      setSourceFilename(nextFile.name);
      setSessionId(response.session_id);
      setPreview(response.preview);
      setFilter(response.preview.summary.row_errors > 0 ? "errors" : "all");
    } catch (err) {
      resetFile();
      setError(err instanceof Error ? err.message : "Ошибка разбора файла");
    } finally {
      setParsing(false);
    }
  };

  const handleCommit = async () => {
    if (!sessionId || !canCommit) {
      return;
    }
    setCommitting(true);
    setError(null);
    try {
      const response = await commitExternalTestResultsSession(sessionId);
      onCommitted(response.job);
      resetFile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось запустить импорт");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className={styles.main}>
      <div className={styles.mainHeader}>
        <div>
          <h2 className={styles.mainTitle}>Результаты внешних тестов</h2>
          <p className={styles.mainDesc}>
            Выберите тест CPM-LMS и загрузите Excel с результатами учеников.
          </p>
        </div>
      </div>

      {error ? <div className={testStyles.stateBox}>{error}</div> : null}

      <section className={styles.instructions} aria-labelledby="external-results-instructions">
        <h3 id="external-results-instructions" className={styles.blockTitle}>
          Инструкция
        </h3>
        <ol className={styles.instructionsList}>
          <li>Обязательные колонки: ФИО и Процент правильных ответов (%).</li>
          <li>Данные могут начинаться с 3-й строки, как в отчёте Статистика.</li>
          <li>ФИО сопоставляется по фамилии и имени; отчество игнорируется.</li>
          <li>Дубли ФИО, неизвестные ученики и уже существующие результаты считаются ошибками.</li>
        </ol>
      </section>

      <label className={styles.fieldGroup}>
        <span className={styles.blockTitle}>Внешний тест</span>
        <select
          className={testStyles.searchInput}
          value={selectedTestId}
          disabled={testsLoading || parsing || committing}
          onChange={(event) => {
            setSelectedTestId(event.target.value);
            resetFile();
          }}
        >
          <option value="">Выберите тест</option>
          {tests.map((test) => {
            const value = String(test.numeric_id ?? test.id);
            return (
              <option key={value} value={value}>
                {externalTestLabel(test)}
              </option>
            );
          })}
        </select>
      </label>

      {testsLoading ? (
        <LoadingState label="Загрузка тестов…" variant="block" className={testStyles.stateBox} />
      ) : null}

      <input
        ref={inputRef}
        type="file"
        className={styles.fileInput}
        accept={ADMIN_EXTERNAL_TEST_RESULTS_ACCEPT}
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (next) {
            void handleParse(next);
          }
        }}
      />

      {parsing ? (
        <LoadingState label="Разбор результатов…" variant="block" className={testStyles.stateBox} />
      ) : file ? (
        <div className={styles.fileRow}>
          <div className={styles.fileInfo}>
            <FileSpreadsheet className={styles.fileIcon} size={22} aria-hidden />
            <div className={styles.fileMeta}>
              <p className={styles.fileName}>{sourceFilename ?? file.name}</p>
              <p className={styles.fileSize}>
                {formatUploadFileSize(file.size)}
                {selectedTest ? ` · ${externalTestLabel(selectedTest)}` : ""}
              </p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={resetFile}>
            <XCircle size={16} aria-hidden />
            Убрать
          </Button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          className={styles.dropzone}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <span className={styles.dropzoneIcon}>
            <Upload size={24} aria-hidden />
          </span>
          <p className={styles.dropzoneTitle}>Перетащите .xlsx или выберите файл</p>
          <p className={styles.dropzoneText}>
            Лист Статистика: ФИО, процент правильных ответов и дата завершения
          </p>
        </div>
      )}

      {preview ? (
        <section className={styles.previewWrap}>
          <div className={styles.previewHeader}>
            <div>
              <h3 className={styles.mainTitle}>Предпросмотр результатов</h3>
              <p className={styles.mainDesc}>
                {preview.test_direction_name ? `${preview.test_direction_name} · ` : ""}
                {preview.test_name ?? selectedTest?.name ?? "Внешний тест"}
                {preview.source_sheet ? ` · лист ${preview.source_sheet}` : ""}
              </p>
            </div>
            <div className={styles.summaryGrid}>
              <span className={styles.statPill}>
                Всего: <strong>{preview.summary.total_rows}</strong>
              </span>
              <span className={styles.statPill}>
                К импорту: <strong>{preview.summary.import_rows}</strong>
              </span>
              <span
                className={`${styles.statPill} ${
                  preview.summary.row_errors > 0 ? styles.statPillDanger : ""
                }`.trim()}
              >
                Ошибок: <strong>{preview.summary.row_errors}</strong>
              </span>
              <span className={styles.statPill}>
                Дубли: <strong>{preview.summary.duplicate_rows}</strong>
              </span>
              <span className={styles.statPill}>
                Уже есть: <strong>{preview.summary.existing_results}</strong>
              </span>
            </div>
          </div>

          <div className={styles.previewFilters}>
            {[
              ["all", "Все"],
              ["import", "К импорту"],
              ["errors", "Ошибки"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`${testStyles.directionTab} ${
                  filter === id ? testStyles.directionTabActive : ""
                }`}
                onClick={() => setFilter(id as PreviewFilter)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className={styles.previewTableWrap}>
            <table className={styles.previewTable}>
              <thead>
                <tr>
                  <th>Строка</th>
                  <th>ФИО из файла</th>
                  <th>Студент CPM</th>
                  <th>Процент</th>
                  <th>Верных</th>
                  <th>Дата завершения</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={`${row.row}-${row.full_name}`}
                    className={row.errors.length > 0 ? styles.previewRowError : undefined}
                  >
                    <td>{row.row}</td>
                    <td>{row.full_name || "—"}</td>
                    <td>{row.student_full_name ?? "—"}</td>
                    <td>{formatPercent(row.percent)}</td>
                    <td>{row.correct_count ?? "—"}</td>
                    <td>{row.completed_at ?? "—"}</td>
                    <td>
                      <span className={styles.previewActionCell}>
                        {row.errors.length === 0 ? (
                          <span>
                            <CheckCircle2 size={14} aria-hidden /> К импорту
                          </span>
                        ) : (
                          <span className={styles.previewErrorText}>{rowStatusLabel(row)}</span>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={resetFile}>
              Выбрать другой файл
            </Button>
            <Button type="button" disabled={!canCommit} onClick={() => void handleCommit()}>
              <FileUp size={16} aria-hidden />
              {committing ? "Запуск…" : "Запустить загрузку"}
            </Button>
          </div>
        </section>
      ) : (
        <div className={styles.actions}>
          <Button type="button" disabled>
            <FileUp size={16} aria-hidden />
            Сначала выберите файл
          </Button>
        </div>
      )}
    </div>
  );
}
