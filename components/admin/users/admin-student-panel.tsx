"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import userStyles from "@/components/admin/users/admin-users.module.css";
import { Button } from "@/components/ui/button";
import { DismissibleOverlay } from "@/components/ui/dismissible-overlay";
import {
  addAdminStudent,
  editAdminStudent,
} from "@/lib/admin/admin-users-api";
import type { AdminGroupItem, AdminStudent } from "@/lib/admin/admin-users-types";
import { useAuth } from "@/contexts/AuthContext";
import { adminHref, canAccessSection } from "@/lib/auth/admin-access";
import Link from "next/link";
import { BFF_DEV } from "@/lib/config";
import { coreCan, coreFullAdmin } from "@/lib/bff/core-admin";
import { CoreCreateRecovery } from "./core-access";
import { useContextGuard } from "@/lib/bff/use-context-guard";
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
  const { user } = useAuth();
  useContextGuard(BFF_DEV);
  const [fullName, setFullName] = useState(student?.full_name ?? "");
  const [classNumber, setClassNumber] = useState(student?.class ? String(student.class) : "");
  const [tgName, setTgName] = useState(student?.tg_name ?? "");
  const [login, setLogin] = useState(student?.login ?? "");
  const [password, setPassword] = useState(student?.password ?? "");
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
    const parsedClass = BFF_DEV && !classNumber.trim() ? null : Number(classNumber);
    if (parsedClass !== null && (!Number.isInteger(parsedClass) || parsedClass <= 0 || (BFF_DEV && parsedClass > 99))) {
      setError(BFF_DEV ? "Класс должен быть целым числом от 1 до 99" : "Класс должен быть положительным целым числом");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "add") {
        const res = await addAdminStudent({
          full_name: fullName.trim(),
          class: parsedClass,
          tg_name: tgName.trim() || undefined,
          ...(BFF_DEV ? {login:login.trim(),password} : {}),
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
      if ((!BFF_DEV || coreFullAdmin(user)) && !login.trim()) {
        setError("Логин не может быть пустым");
        return;
      }

      const payload: {
        student_id: number;
        full_name?: string;
        class?: number | null;
        group_id?: number | null;
        tg_name?: string | null;
        login?: string;
        password?: string;
      } = { student_id: student.id };

      if (fullName.trim() !== student.full_name) {
        payload.full_name = fullName.trim();
      }
      if (parsedClass !== student.class) {
        payload.class = parsedClass;
      }
      const nextGroup =
        groupId === "none" ? null : Number(groupId);
      if ((!BFF_DEV || coreCan("groups",true,user)) && nextGroup !== student.group_id) {
        payload.group_id = nextGroup;
      }
      const nextTg = tgName.trim() || null;
      if (nextTg !== (student.tg_name ?? null)) {
        payload.tg_name = nextTg;
      }
      const nextLogin = login.trim();
      if ((!BFF_DEV || coreFullAdmin(user)) && nextLogin && nextLogin !== (student.login ?? "")) {
        payload.login = nextLogin;
      }
      const nextPassword = password.trim();
      if ((!BFF_DEV || coreFullAdmin(user)) && nextPassword && nextPassword !== (student.password ?? "")) {
        payload.password = nextPassword;
      }

      if (Object.keys(payload).length === 1) {
        await onSaved();
        return;
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
    <DismissibleOverlay className={userStyles.overlay} onDismiss={onClose}>
      <div
        className={userStyles.modal}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className={userStyles.modalTitle}>
          {mode === "add" ? "Новый ученик" : "Редактирование ученика"}
        </h2>

        {mode === "edit" && student?.school_id && canAccessSection(user, "schools") ? (
          <p className={userStyles.hint}>
            Школа: {student.school_name ?? `#${student.school_id}`}. Изменить привязку
            можно в разделе{" "}
            <Link href={adminHref(user, "schools")} className={userStyles.hintLink}>
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
            <span className={userStyles.fieldLabel}>Класс{BFF_DEV ? " (необязательно)" : ""}</span>
            <input
              type="number"
              min="1"
              max={BFF_DEV ? 99 : undefined}
              step="1"
              className={userStyles.fieldInput}
              value={classNumber}
              onChange={(e) => setClassNumber(e.target.value)}
              required={!BFF_DEV}
            />
          </label>

          {mode === "edit" && (!BFF_DEV || coreCan("groups",true,user)) ? (
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

          {(mode === "edit" && (!BFF_DEV || coreFullAdmin(user))) || (mode === "add" && BFF_DEV) ? (
            <>
              <label className={userStyles.field}>
                <span className={userStyles.fieldLabel}>Логин</span>
                <input
                  className={userStyles.fieldInput}
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                />
              </label>

              <label className={userStyles.field}>
                <span className={userStyles.fieldLabel}>{mode === "edit" ? "Новый пароль" : "Пароль"}</span>
                <input
                  className={userStyles.fieldInput}
                  type="password"
                  autoComplete="new-password"
                  minLength={BFF_DEV ? 8 : undefined}
                  required={BFF_DEV && mode === "add"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {student?.password_hidden && !student.password ? (
                  <span className={userStyles.memberMeta}>
                    Сохранённый пароль прочитать нельзя. При смене логина укажите новый пароль.
                  </span>
                ) : null}
              </label>
            </>
          ) : null}

          <CoreCreateRecovery onRecovered={onSaved} />
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
    </DismissibleOverlay>
  );
}
