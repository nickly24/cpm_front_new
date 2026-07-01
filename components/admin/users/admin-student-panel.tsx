"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import userStyles from "@/components/admin/users/admin-users.module.css";
import { Button } from "@/components/ui/button";
import {
  addAdminStudent,
  editAdminStudent,
} from "@/lib/admin/admin-users-api";
import type { AdminGroupItem, AdminStudent } from "@/lib/admin/admin-users-types";
import Link from "next/link";
import { useEffect, useState } from "react";

interface AdminStudentPanelProps {
  mode: "add" | "edit";
  student: AdminStudent | null;
  groups: AdminGroupItem[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function AdminStudentPanel({
  mode,
  student,
  groups,
  onClose,
  onSaved,
}: AdminStudentPanelProps) {
  const [fullName, setFullName] = useState(student?.full_name ?? "");
  const [classNumber, setClassNumber] = useState(String(student?.class ?? 9));
  const [tgName, setTgName] = useState(student?.tg_name ?? "");
  const [groupId, setGroupId] = useState(
    student?.group_id != null ? String(student.group_id) : "none",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{
    login: string;
    password: string;
  } | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Укажите ФИО");
      return;
    }
    const parsedClass = Number(classNumber);
    if (!Number.isInteger(parsedClass) || parsedClass <= 0) {
      setError("Класс должен быть положительным целым числом");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "add") {
        const res = await addAdminStudent({
          full_name: fullName.trim(),
          class: parsedClass,
          tg_name: tgName.trim() || undefined,
        });
        if (!res.status || !res.student_data) {
          throw new Error(res.error || "Не удалось создать ученика");
        }
        setCredentials({
          login: res.student_data.login,
          password: res.student_data.password,
        });
        return;
      }

      if (!student) {
        return;
      }

      const payload: {
        student_id: number;
        full_name?: string;
        class?: number;
        group_id?: number | null;
        tg_name?: string | null;
      } = { student_id: student.id };

      if (fullName.trim() !== student.full_name) {
        payload.full_name = fullName.trim();
      }
      if (parsedClass !== student.class) {
        payload.class = parsedClass;
      }
      const nextGroup =
        groupId === "none" ? null : Number(groupId);
      if (nextGroup !== student.group_id) {
        payload.group_id = nextGroup;
      }
      const nextTg = tgName.trim() || null;
      if (nextTg !== (student.tg_name ?? null)) {
        payload.tg_name = nextTg;
      }

      const res = await editAdminStudent(payload);
      if (!res.status) {
        throw new Error(res.error || "Не удалось сохранить");
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={userStyles.overlay} onClick={onClose}>
      <div
        className={userStyles.modal}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className={userStyles.modalTitle}>
          {mode === "add" ? "Новый ученик" : "Редактирование ученика"}
        </h2>

        {mode === "edit" && student?.school_id ? (
          <p className={userStyles.hint}>
            Школа: {student.school_name ?? `#${student.school_id}`}. Изменить привязку
            можно в разделе{" "}
            <Link href="/cabinet/admin/schools" className={userStyles.hintLink}>
              Школы
            </Link>
            .
          </p>
        ) : null}

        <form className={userStyles.formGrid} onSubmit={handleSubmit}>
          <label className={userStyles.field}>
            <span className={userStyles.fieldLabel}>ФИО</span>
            <input
              className={userStyles.fieldInput}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </label>

          <label className={userStyles.field}>
            <span className={userStyles.fieldLabel}>Класс</span>
            <input
              type="number"
              min="1"
              step="1"
              className={userStyles.fieldInput}
              value={classNumber}
              onChange={(e) => setClassNumber(e.target.value)}
              required
            />
          </label>

          {mode === "edit" ? (
            <label className={userStyles.field}>
              <span className={userStyles.fieldLabel}>Группа CPM</span>
              <select
                className={userStyles.fieldSelect}
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              >
                <option value="none">Без группы</option>
                {groups.map((group) => (
                  <option key={group.group_id} value={group.group_id}>
                    {group.group_name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className={userStyles.field}>
            <span className={userStyles.fieldLabel}>Telegram (необязательно)</span>
            <input
              className={userStyles.fieldInput}
              value={tgName}
              onChange={(e) => setTgName(e.target.value)}
            />
          </label>

          {error ? <p className={styles.errorText}>{error}</p> : null}

          {credentials ? (
            <div className={userStyles.credentialsBox}>
              <strong>Ученик создан.</strong>
              <div>Логин: {credentials.login}</div>
              <div>Пароль: {credentials.password}</div>
            </div>
          ) : null}

          <div className={userStyles.modalActions}>
            <Button type="button" variant="ghost" onClick={onClose}>
              {credentials ? "Закрыть" : "Отмена"}
            </Button>
            {credentials ? (
              <Button
                type="button"
                onClick={async () => {
                  await onSaved();
                }}
              >
                К списку
              </Button>
            ) : (
              <Button type="submit" disabled={submitting}>
                {submitting ? "Сохранение…" : mode === "add" ? "Создать" : "Сохранить"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
