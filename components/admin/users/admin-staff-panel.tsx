"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import userStyles from "@/components/admin/users/admin-users.module.css";
import { Button } from "@/components/ui/button";
import {
  addAdminStaffUser,
  editAdminStaffUser,
} from "@/lib/admin/admin-users-api";
import type {
  AdminGroupItem,
  AdminStaffRole,
  AdminStaffUser,
} from "@/lib/admin/admin-users-types";
import { useEffect, useState } from "react";

interface AdminStaffPanelProps {
  mode: "add" | "edit";
  role: AdminStaffRole;
  user: AdminStaffUser | null;
  groups: AdminGroupItem[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

const ROLE_LABELS: Record<AdminStaffRole, string> = {
  proctor: "проктор",
  examinator: "экзаменатор",
  supervisor: "супервайзер",
};

export function AdminStaffPanel({
  mode,
  role,
  user,
  groups,
  onClose,
  onSaved,
}: AdminStaffPanelProps) {
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [login, setLogin] = useState(user?.login ?? "");
  const [groupId, setGroupId] = useState(
    user?.group_id != null ? String(user.group_id) : "none",
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

    setSubmitting(true);
    try {
      if (mode === "add") {
        const res = await addAdminStaffUser(role, {
          full_name: fullName.trim(),
          group_id:
            role === "proctor" && groupId !== "none" ? Number(groupId) : null,
        });
        if (!res.status || !res.user_data) {
          throw new Error(res.error || "Не удалось создать пользователя");
        }
        setCredentials({
          login: res.user_data.login,
          password: res.user_data.password,
        });
        return;
      }

      if (!user) {
        return;
      }

      const payload: {
        role: AdminStaffRole;
        user_id: number;
        full_name?: string;
        group_id?: number | null;
        login?: string;
      } = {
        role,
        user_id: user.id,
      };

      if (fullName.trim() !== user.full_name) {
        payload.full_name = fullName.trim();
      }

      if (role === "proctor") {
        const nextGroup = groupId === "none" ? null : Number(groupId);
        if (nextGroup !== (user.group_id ?? null)) {
          payload.group_id = nextGroup;
        }
      }

      const nextLogin = login.trim();
      if (nextLogin && nextLogin !== (user.login ?? "")) {
        payload.login = nextLogin;
      }

      const res = await editAdminStaffUser(payload);
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
          {mode === "add"
            ? `Новый ${ROLE_LABELS[role]}`
            : `Редактирование: ${ROLE_LABELS[role]}`}
        </h2>

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

          {mode === "edit" ? (
            <label className={userStyles.field}>
              <span className={userStyles.fieldLabel}>Логин</span>
              <input
                className={userStyles.fieldInput}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder={user?.login ? undefined : "Нет учётной записи"}
              />
            </label>
          ) : null}

          {role === "proctor" ? (
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

          {error ? <p className={styles.errorText}>{error}</p> : null}

          {credentials ? (
            <div className={userStyles.credentialsBox}>
              <strong>Пользователь создан.</strong>
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
