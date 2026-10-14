"use client";

import { CoreCreateRecovery, CoreEditOnly } from "@/components/admin/users/core-access";

import styles from "@/components/admin/tests/admin-tests.module.css";
import userStyles from "@/components/admin/users/admin-users.module.css";
import { AdminStaffPanel } from "@/components/admin/users/admin-staff-panel";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import {
  deleteAdminUser,
  fetchAdminGroupsList,
  fetchAdminStaff,
  resetAdminStaffPassword,
} from "@/lib/admin/admin-users-api";
import type { AdminGroupItem, AdminStaffRole, AdminStaffUser } from "@/lib/admin/admin-users-types";
import { BFF_DEV } from "@/lib/config";
import { activateCoreUser, coreFullAdmin } from "@/lib/bff/core-admin";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback, useEffect, useRef, useState } from "react";

const ROLES: { id: AdminStaffRole; label: string }[] = [
  { id: "proctor", label: "Прокторы" },
  { id: "examinator", label: "Экзаменаторы" },
  { id: "supervisor", label: "Супервайзеры" },
  { id: "staff_admin", label: "Администраторы подразделения" },
];

function passwordLabel(user: AdminStaffUser): string {
  if (user.password) {
    return user.password;
  }
  if (user.password_hidden) {
    return "Скрыт (хеш)";
  }
  if (!user.login) {
    return "Нет учётки";
  }
  return "—";
}

export function AdminStaffTab() {
  const {user: actor}=useAuth();
  const loadSerial=useRef(0);
  const [role, setRole] = useState<AdminStaffRole>("proctor");
  const [users, setUsers] = useState<AdminStaffUser[]>([]);
  const [groups, setGroups] = useState<AdminGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<AdminStaffUser | null>(null);
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<{
    userId: number;
    login: string;
    password: string;
  } | null>(null);

  const load = useCallback(async () => {
    const serial=++loadSerial.current;
    setLoading(true);
    setError(null);
    try {
      const [usersData, groupsData] = await Promise.all([
        fetchAdminStaff(role),
        fetchAdminGroupsList(),
      ]);
      if(serial!==loadSerial.current)return;
      setUsers(usersData);
      setGroups(groupsData);
    } catch (err) {
      if(serial!==loadSerial.current)return;
      setUsers([]);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      if(serial===loadSerial.current)setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    queueMicrotask(()=>{void load();});
  }, [load]);

  const handleDelete = async (user: AdminStaffUser) => {
    if (!window.confirm(BFF_DEV ? `${user.is_active === false ? "Активировать" : "Заблокировать"} учётную запись «${user.full_name}»? История сохраняется.` : `Удалить «${user.full_name}»?`)) {
      return;
    }
    try {
      if(BFF_DEV){await activateCoreUser(user.id,user.is_active===false);await load();}
      else {await deleteAdminUser(role, user.id);setUsers((prev) => prev.filter((item) => item.id !== user.id));}
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  const handleResetPassword = async (user: AdminStaffUser) => {
    if (
      !window.confirm(
        `Сгенерировать новый пароль для «${user.full_name}»? Старый пароль перестанет работать.`,
      )
    ) {
      return;
    }

    setResettingId(user.id);
    try {
      const res = await resetAdminStaffPassword(role, user.id);
      if (!res.status || !res.user_data) {
        throw new Error(res.error || "Не удалось сбросить пароль");
      }
      setRevealedPassword({
        userId: user.id,
        login: res.user_data.login,
        password: res.user_data.password,
      });
      if (!BFF_DEV) setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id
            ? {
                ...item,
                login: res.user_data!.login,
                password: res.user_data!.password,
                password_hidden: false,
              }
            : item,
        ),
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка сброса пароля");
    } finally {
      setResettingId(null);
    }
  };

  return (
    <>
      <CoreCreateRecovery onRecovered={load} />
      <div className={userStyles.sectionTabs}>
        {ROLES.filter(r=>r.id!=="staff_admin"||(BFF_DEV&&coreFullAdmin(actor))).map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.directionTab} ${role === item.id ? styles.directionTabActive : ""}`}
            onClick={() => {
              setRole(item.id);
              setPanelMode(null);
              setEditing(null);
              setRevealedPassword(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={userStyles.statsRow}>
        <span className={userStyles.statPill}>
          Всего: <strong>{users.length}</strong>
        </span>
        <CoreEditOnly fullAdmin><Button
          type="button"
          onClick={() => {
            setPanelMode("add");
            setEditing(null);
          }}
        >
          Добавить
        </Button></CoreEditOnly>
      </div>

      <p className={userStyles.hint}>
        {BFF_DEV ? "Пароль показывается при создании и сбросе. Сохранённые пароли прочитать нельзя." : "Логин и пароль показываются при создании и после сброса пароля. Для старых учёток с захешированным паролем используйте «Новый пароль»."}
      </p>

      {revealedPassword ? (
        <div className={userStyles.credentialsBox}>
          <strong>Новые учётные данные</strong>
          <div>Логин: {revealedPassword.login}</div>
          <div>Пароль: {revealedPassword.password}</div>
        </div>
      ) : null}

      {error ? <div className={styles.stateBox}>{error}</div> : null}

      {loading ? (
        <LoadingState label="Загрузка…" variant="block" className={styles.stateBox} />
      ) : users.length === 0 ? (
        <div className={styles.stateBox}>Пользователи не найдены</div>
      ) : (
        <div className={userStyles.tableWrap}>
          <table className={userStyles.table}>
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Логин</th>
                <th>{BFF_DEV ? "Статус" : "Пароль"}</th>
                {role === "proctor" ? <th>Группа</th> : null}
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className={userStyles.memberName}>{user.full_name}</div>
                    <div className={userStyles.memberMeta}>ID {user.id}</div>
                  </td>
                  <td>
                    <code className={userStyles.credentialCode}>
                      {user.login ?? "—"}
                    </code>
                  </td>
                  <td>
                    <code className={userStyles.credentialCode}>
                      {BFF_DEV ? (user.is_active === false ? "Заблокирован" : "Активен") : passwordLabel(user)}
                    </code>
                  </td>
                  {role === "proctor" ? (
                    <td>
                      {user.group_name ? (
                        <span className={userStyles.metaTag}>{user.group_name}</span>
                      ) : user.group_id != null ? (
                        <span className={userStyles.metaTag}>#{user.group_id}</span>
                      ) : (
                        <span className={`${userStyles.metaTag} ${userStyles.metaTagMuted}`}>
                          Без группы
                        </span>
                      )}
                    </td>
                  ) : null}
                  <td>
                    <div className={userStyles.tableActions}>
                      <CoreEditOnly><button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => {
                          setPanelMode("edit");
                          setEditing(user);
                        }}
                      >
                        Изменить
                      </button></CoreEditOnly>
                      <CoreEditOnly fullAdmin><button
                        type="button"
                        className={styles.actionBtn}
                        disabled={resettingId === user.id}
                        onClick={() => void handleResetPassword(user)}
                      >
                        {resettingId === user.id ? "Сброс…" : "Новый пароль"}
                      </button></CoreEditOnly>
                      <CoreEditOnly fullAdmin><button
                        type="button"
                        className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                        onClick={() => void handleDelete(user)}
                      >
                        {BFF_DEV ? (user.is_active === false ? "Активировать" : "Заблокировать") : "Удалить"}
                      </button></CoreEditOnly>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {panelMode ? (
        <AdminStaffPanel
          mode={panelMode}
          role={role}
          user={editing}
          groups={groups}
          onClose={() => {
            setPanelMode(null);
            setEditing(null);
          }}
          onSaved={async () => {
            setPanelMode(null);
            setEditing(null);
            await load();
          }}
        />
      ) : null}
    </>
  );
}
