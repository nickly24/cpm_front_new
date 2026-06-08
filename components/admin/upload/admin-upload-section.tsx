"use client";

import { AdminUploadJobsTab } from "@/components/admin/upload/admin-upload-jobs-tab";
import { AdminUploadPreview } from "@/components/admin/upload/admin-upload-preview";
import { AdminUploadReportWorkspace } from "@/components/admin/upload/admin-upload-report-workspace";
import styles from "@/components/admin/upload/admin-upload.module.css";
import testStyles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import {
  commitUserImportSession,
  parseUserImportFile,
  updateUserImportSession,
} from "@/lib/admin/admin-upload-api";
import { downloadUserImportTemplate } from "@/lib/admin/admin-upload-export";
import {
  ADMIN_UPLOAD_ACCEPT,
  ADMIN_UPLOAD_TYPES,
  formatUploadFileSize,
  type AdminUploadTab,
  type UserImportPreview,
  type UserImportPreviewStudent,
} from "@/lib/admin/admin-upload-types";
import {
  FileSpreadsheet,
  FileUp,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

function isXlsxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".xlsx") || file.type.includes("spreadsheetml");
}

const TABS: { id: AdminUploadTab; label: string }[] = [
  { id: "upload", label: "Новая загрузка" },
  { id: "jobs", label: "Журнал" },
];

export function AdminUploadSection() {
  const uploadType = ADMIN_UPLOAD_TYPES[0];
  const [tab, setTab] = useState<AdminUploadTab>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sourceFilename, setSourceFilename] = useState<string | null>(null);
  const [preview, setPreview] = useState<UserImportPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobsRefreshToken, setJobsRefreshToken] = useState(0);
  const [hasActiveJob, setHasActiveJob] = useState(false);
  const [reportJobId, setReportJobId] = useState<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetUpload = () => {
    setFile(null);
    setSessionId(null);
    setSourceFilename(null);
    setPreview(null);
    setError(null);
  };

  const handleParse = async (nextFile: File) => {
    if (!isXlsxFile(nextFile)) {
      window.alert("Выберите файл .xlsx");
      return;
    }
    setParsing(true);
    setError(null);
    try {
      const response = await parseUserImportFile(nextFile);
      if (!response.status) {
        throw new Error("Не удалось разобрать файл");
      }
      setFile(nextFile);
      setSessionId(response.session_id);
      setSourceFilename(nextFile.name);
      setPreview(response.preview);
    } catch (err) {
      resetUpload();
      setError(err instanceof Error ? err.message : "Ошибка разбора файла");
    } finally {
      setParsing(false);
    }
  };

  const persistPreview = useCallback(
    async (nextPreview: UserImportPreview) => {
      if (!sessionId) {
        return;
      }
      setSaving(true);
      try {
        const response = await updateUserImportSession(sessionId, nextPreview);
        setPreview(response.preview);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка сохранения preview");
      } finally {
        setSaving(false);
      }
    },
    [sessionId],
  );

  const handleStudentChange = (
    row: number,
    patch: Partial<
      Pick<UserImportPreviewStudent, "full_name" | "class" | "school_name" | "proctor_name">
    >,
  ) => {
    if (!preview) {
      return;
    }

    const students = preview.students.map((student) => {
      if (student.row !== row) {
        return student;
      }
      return {
        ...student,
        ...patch,
        school_name: patch.school_name !== undefined ? patch.school_name || null : student.school_name,
        proctor_name: patch.proctor_name !== undefined ? patch.proctor_name || null : student.proctor_name,
      };
    });

    const nextPreview = { ...preview, students };
    setPreview(nextPreview);

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void persistPreview({ ...nextPreview, students });
    }, 450);
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const handleCommit = async () => {
    if (!sessionId) {
      return;
    }
    setCommitting(true);
    setError(null);
    try {
      if (preview) {
        await updateUserImportSession(sessionId, preview);
      }
      await commitUserImportSession(sessionId);
      setJobsRefreshToken((value) => value + 1);
      setTab("jobs");
      setHasActiveJob(true);
      resetUpload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось запустить импорт");
    } finally {
      setCommitting(false);
    }
  };

  if (reportJobId != null) {
    return (
      <AdminUploadReportWorkspace
        jobId={reportJobId}
        onBack={() => {
          setReportJobId(null);
          setTab("jobs");
        }}
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Загрузка</h1>
          <p className={styles.hint}>
            Массовый импорт учеников, школ, групп и прокторов из Excel с предпросмотром и
            отчётом с логинами.
          </p>
        </div>
      </header>

      <div className={styles.sectionTabs}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${testStyles.directionTab} ${tab === item.id ? testStyles.directionTabActive : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.id === "jobs" && hasActiveJob ? (
              <span className={styles.tabDot} aria-hidden />
            ) : null}
          </button>
        ))}
      </div>

      {error ? <div className={testStyles.stateBox}>{error}</div> : null}

      {tab === "jobs" ? (
        <AdminUploadJobsTab
          refreshToken={jobsRefreshToken}
          onActiveChange={setHasActiveJob}
          onOpenReport={(jobId) => setReportJobId(jobId)}
        />
      ) : preview && sessionId ? (
        <AdminUploadPreview
          preview={preview}
          sourceFilename={sourceFilename}
          saving={saving}
          committing={committing}
          onStudentChange={handleStudentChange}
          onCommit={handleCommit}
          onReset={resetUpload}
        />
      ) : (
        <div className={styles.main}>
          <div className={styles.mainHeader}>
            <div>
              <h2 className={styles.mainTitle}>{uploadType.label}</h2>
              <p className={styles.mainDesc}>{uploadType.description}</p>
            </div>
          </div>

          <section className={styles.instructions} aria-labelledby="upload-instructions">
            <h3 id="upload-instructions" className={styles.blockTitle}>
              Инструкция
            </h3>
            <ol className={styles.instructionsList}>
              {uploadType.instructions.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <input
            ref={inputRef}
            type="file"
            className={styles.fileInput}
            accept={ADMIN_UPLOAD_ACCEPT}
            onChange={(event) => {
              const next = event.target.files?.[0];
              if (next) {
                void handleParse(next);
              }
            }}
          />

          {parsing ? (
            <LoadingState label="Разбор файла…" variant="block" className={testStyles.stateBox} />
          ) : file ? (
            <div className={styles.fileRow}>
              <div className={styles.fileInfo}>
                <FileSpreadsheet className={styles.fileIcon} size={22} aria-hidden />
                <div className={styles.fileMeta}>
                  <p className={styles.fileName}>{file.name}</p>
                  <p className={styles.fileSize}>{formatUploadFileSize(file.size)}</p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={resetUpload}>
                <X size={16} aria-hidden />
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
                Колонки: ФИО, Класс, Школа, Проктор
              </p>
            </div>
          )}

          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={downloadUserImportTemplate}>
              Скачать шаблон
            </Button>
            <Button type="button" disabled>
              <FileUp size={16} aria-hidden />
              Сначала выберите файл
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
