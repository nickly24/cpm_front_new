"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import userStyles from "@/components/admin/users/admin-users.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import {
  deleteAdminUser,
  fetchAdminStaff,
} from "@/lib/admin/admin-users-api";
import type { AdminStaffRole, AdminStaffUser } from "@/lib/admin/admin-users-types";
import { useCallback, useEffect, useState } from "react";

const ROLES: { id: AdminStaffRole; label: string }[] = [
  { id: "proctor", label: "Прокторы" },
  { id: "examinator", label: "Экзаменаторы" },
  { id: "supervisor", label: "Супервайзеры" },
];

export function AdminStaffTab() {
  const [role, setRole] = useState<AdminStaffRole>("proctor");
  const [users, setUsers] = useState<AdminStaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await fetchAdminStaff(role));
    } catch (err) {
      setUsers([]);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (user: AdminStaffUser) => {
    if (!window.confirm(`Удалить «${user.full_name}»?`)) {
      return;
    }
    try {
      await deleteAdminUser(role, user.id);
      setUsers((prev) => prev.filter((item) => item.id !== user.id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  return (
    <>
      <div className={userStyles.sectionTabs}>
        {ROLES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.directionTab} ${role === item.id ? styles.directionTabActive : ""}`}
            onClick={() => setRole(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <p className={userStyles.hint}>
        Создание прокторов и других ролей — через БД или отдельный процесс. Здесь
        просмотр и удаление.
      </p>

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
                  {role === "proctor" ? (
                    <td>
                      {user.group_id != null ? (
                        <span className={userStyles.metaTag}>#{user.group_id}</span>
                      ) : (
                        <span className={`${userStyles.metaTag} ${userStyles.metaTagMuted}`}>
                          Без группы
                        </span>
                      )}
                    </td>
                  ) : null}
                  <td>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      onClick={() => handleDelete(user)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
