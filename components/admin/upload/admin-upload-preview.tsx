"use client";

import styles from "@/components/admin/upload/admin-upload.module.css";
import testStyles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import type {
  UserImportPreview,
  UserImportPreviewStudent,
} from "@/lib/admin/admin-upload-types";
import { useMemo, useState } from "react";

interface AdminUploadPreviewProps {
  preview: UserImportPreview;
  sourceFilename?: string | null;
  saving?: boolean;
  committing?: boolean;
  onStudentChange: (
    row: number,
    patch: Partial<
      Pick<
        UserImportPreviewStudent,
        "full_name" | "class" | "school_name" | "proctor_name" | "tg_name"
      >
    >,
  ) => void;
  onCommit: () => void;
  onReset: () => void;
}

function actionLabel(student: UserImportPreviewStudent): string {
  if (student.action === "create") {
    return student.without_group ? "Создать (без группы)" : "Создать";
  }
  if (student.action === "skip") {
    return "Пропустить";
  }
  return "Ошибка";
}

export function AdminUploadPreview({
  preview,
  sourceFilename,
  saving,
  committing,
  onStudentChange,
  onCommit,
  onReset,
}: AdminUploadPreviewProps) {
  const [filter, setFilter] = useState<"all" | "errors" | "create" | "skip">("all");
  const summary = preview.summary;

  const filteredStudents = useMemo(() => {
    if (filter === "errors") {
      return preview.students.filter((item) => item.action === "error");
    }
    if (filter === "create") {
      return preview.students.filter((item) => item.action === "create");
    }
    if (filter === "skip") {
      return preview.students.filter((item) => item.action === "skip");
    }
    return preview.students;
  }, [filter, preview.students]);

  const canCommit =
    summary.row_errors === 0 && summary.students_create > 0 && !saving && !committing;

  return (
    <div className={styles.previewWrap}>
      <div className={styles.previewHeader}>
        <div>
          <h2 className={styles.mainTitle}>Предпросмотр</h2>
          <p className={styles.mainDesc}>
            {sourceFilename ? `Файл: ${sourceFilename}` : "Проверьте данные перед загрузкой в БД"}
          </p>
        </div>
        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onReset}>
            Другой файл
          </Button>
          <Button type="button" disabled={!canCommit} onClick={onCommit}>
            {committing ? "Запуск…" : "Загрузить в БД"}
          </Button>
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <span className={styles.statPill}>
          Строк: <strong>{summary.total_rows}</strong>
        </span>
        <span className={styles.statPill}>
          Создать учеников: <strong>{summary.students_create}</strong>
        </span>
        <span className={styles.statPill}>
          Пропустить: <strong>{summary.students_skip}</strong>
        </span>
        <span className={styles.statPill}>
          Без группы: <strong>{summary.students_without_group}</strong>
        </span>
        <span className={styles.statPill}>
          Школ: <strong>{summary.schools_create}</strong> нов. /{" "}
          <strong>{summary.schools_existing}</strong> сущ.
        </span>
        <span className={styles.statPill}>
          Групп: <strong>{summary.groups_create}</strong> нов. /{" "}
          <strong>{summary.groups_existing}</strong> сущ.
        </span>
        <span className={styles.statPill}>
          Прокторов: <strong>{summary.proctors_create}</strong> нов. /{" "}
          <strong>{summary.proctors_existing}</strong> сущ.
        </span>
        {summary.row_errors > 0 ? (
          <span className={`${styles.statPill} ${styles.statPillDanger}`}>
            Ошибок: <strong>{summary.row_errors}</strong>
          </span>
        ) : null}
      </div>

      {summary.row_errors > 0 ? (
        <div className={styles.notice}>
          Исправьте строки с ошибками — загрузка недоступна, пока есть хотя бы одна ошибка.
        </div>
      ) : null}

      <div className={styles.previewFilters}>
        {(
          [
            ["all", "Все"],
            ["create", "К созданию"],
            ["skip", "Пропуск"],
            ["errors", "Ошибки"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`${testStyles.directionTab} ${filter === id ? testStyles.directionTabActive : ""}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.previewTableWrap}>
        <table className={styles.previewTable}>
          <thead>
            <tr>
              <th>#</th>
              <th>ФИО</th>
              <th>Класс</th>
              <th>Школа</th>
              <th>Telegram</th>
              <th>Проктор</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student) => (
              <tr
                key={student.row}
                className={
                  student.action === "error"
                    ? styles.previewRowError
                    : student.action === "skip"
                      ? styles.previewRowSkip
                      : undefined
                }
              >
                <td>{student.row}</td>
                <td>
                  <input
                    className={styles.previewInput}
                    value={student.full_name}
                    onChange={(event) =>
                      onStudentChange(student.row, { full_name: event.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    className={styles.previewInputNarrow}
                    value={student.class ?? ""}
                    onChange={(event) =>
                      onStudentChange(student.row, {
                        class: Number(event.target.value) || null,
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    className={styles.previewInput}
                    value={student.school_name ?? ""}
                    onChange={(event) =>
                      onStudentChange(student.row, { school_name: event.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    className={styles.previewInput}
                    value={student.tg_name ?? ""}
                    onChange={(event) =>
                      onStudentChange(student.row, { tg_name: event.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    className={styles.previewInput}
                    value={student.proctor_name ?? ""}
                    onChange={(event) =>
                      onStudentChange(student.row, { proctor_name: event.target.value })
                    }
                  />
                </td>
                <td>
                  <div className={styles.previewActionCell}>
                    <span>{actionLabel(student)}</span>
                    {student.errors.length > 0 ? (
                      <span className={styles.previewErrorText}>{student.errors.join("; ")}</span>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {saving ? <p className={styles.hint}>Сохранение изменений…</p> : null}
    </div>
  );
}
