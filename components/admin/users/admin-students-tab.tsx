"use client";

import { CoreCreateRecovery, CoreEditOnly, CoreReadOnlyControl } from "@/components/admin/users/core-access";

import { AdminListPaginationBar } from "@/components/admin/tests/admin-list-pagination";
import styles from "@/components/admin/tests/admin-tests.module.css";
import userStyles from "@/components/admin/users/admin-users.module.css";
import { AdminStudentPanel } from "@/components/admin/users/admin-student-panel";
import { AdminStudentDeletionManager } from "@/components/admin/users/admin-student-deletion";
import type { DeletionStudent } from "@/lib/admin/student-deletion";
import { Button } from "@/components/ui/button";
import { FilterPopover } from "@/components/ui/filter-popover";
import { LoadingState } from "@/components/ui/loading-state";
import {
  editAdminStudent,
  fetchAdminGroupsList,
  fetchAdminStudents,
} from "@/lib/admin/admin-users-api";
import type { AdminGroupItem, AdminStudent } from "@/lib/admin/admin-users-types";
import {
  matchesStudentSearch,
  schoolLabel,
  toClientPagination,
} from "@/lib/admin/admin-users-utils";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useAuth } from "@/contexts/AuthContext";
import { adminHref, canAccessSection } from "@/lib/auth/admin-access";
import Link from "next/link";
import { BFF_DEV } from "@/lib/config";
import { activateCoreUser } from "@/lib/bff/core-admin";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 15;

export function AdminStudentsTab() {
  const { user } = useAuth();
  const loadSerial=useRef(0);
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [groups, setGroups] = useState<AdminGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [panelMode, setPanelMode] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<AdminStudent | null>(null);
  const [deleting, setDeleting] = useState<DeletionStudent | null>(null);
  const canDelete = !BFF_DEV && canAccessSection(user, "users", "edit");

  const classOptions = useMemo(
    () => Array.from(new Set(students.map((student) => student.class))).sort((a, b) => a - b),
    [students],
  );

  const load = useCallback(async () => {
    const serial=++loadSerial.current;
    setLoading(true);
    setError(null);
    try {
      const [studentsData, groupsData] = await Promise.all([
        fetchAdminStudents(),
        fetchAdminGroupsList(),
      ]);
      if(serial!==loadSerial.current)return;
      setStudents(studentsData);
      setGroups(groupsData);
    } catch (err) {
      if(serial!==loadSerial.current)return;
      setStudents([]);
      setError(err instanceof Error ? err.message : "Не удалось загрузить учеников");
    } finally {
      if(serial===loadSerial.current)setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const filtered = useMemo(() => {
    return students.filter((student) => {
      if (!matchesStudentSearch(student.full_name, student.id, debouncedSearch, student.login)) {
        return false;
      }
      if (groupFilter === "none" && student.group_id != null) {
        return false;
      }
      if (groupFilter !== "all" && groupFilter !== "none") {
        if (student.group_id !== Number(groupFilter)) {
          return false;
        }
      }
      if (classFilter !== "all" && student.class !== Number(classFilter)) {
        return false;
      }
      return true;
    });
  }, [students, debouncedSearch, groupFilter, classFilter]);

  const visiblePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const pagination = toClientPagination(visiblePage, PAGE_SIZE, filtered.length);
  const pageItems = filtered.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE);

  const handleDeletionCompleted = useCallback((studentId: number) => {
    setStudents(previous => previous.filter(student => student.id !== studentId));
    void load();
  }, [load]);

  const handleDelete = async (student: AdminStudent) => {
    if (!BFF_DEV) {
      if (canDelete) setDeleting({ id: student.id, name: student.full_name,
        group_name: groups.find(group => group.group_id === student.group_id)?.group_name ?? null });
      return;
    }
    if (!window.confirm(`${student.is_active === false ? "Активировать" : "Заблокировать"} учётную запись «${student.full_name}»? История сохраняется.`)) return;
    try { await activateCoreUser(student.id, student.is_active === false); await load(); }
    catch (err) { window.alert(err instanceof Error ? err.message : "Ошибка изменения статуса"); }
  };

  const handleGroupChange = async (student: AdminStudent, value: string) => {
    try {
      if (value === "none") {
        await editAdminStudent({ student_id: student.id, group_id: null });
      } else {
        await editAdminStudent({
          student_id: student.id,
          group_id: Number(value),
        });
      }
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Не удалось сменить группу");
    }
  };

  if (panelMode) {
    return (
      <AdminStudentPanel
        mode={panelMode}
        student={editing}
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
    );
  }

  return (
    <>
      <CoreCreateRecovery onRecovered={load} />
      <div className={styles.listToolbar}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Имя, логин или ID ученика…"
          aria-label="Поиск учеников"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <FilterPopover
          activeCount={Number(groupFilter !== "all") + Number(classFilter !== "all")}
          onReset={() => {
            setGroupFilter("all");
            setClassFilter("all");
            setPage(1);
          }}
        >
          <label className={styles.dateField}>
            <span className={styles.fieldLabel}>Группа</span>
            <select
              className={userStyles.fieldSelect}
              value={groupFilter}
              onChange={(e) => {
                setGroupFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Все группы</option>
              <option value="none">Без группы</option>
              {groups.map((group) => (
                <option key={group.group_id} value={group.group_id}>
                  {group.group_name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.dateField}>
            <span className={styles.fieldLabel}>Класс</span>
            <select
              className={userStyles.fieldSelect}
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Все</option>
              {classOptions.map((classNumber) => (
                <option key={classNumber} value={classNumber}>
                  {classNumber}
                </option>
              ))}
            </select>
          </label>
        </FilterPopover>
        <div className={styles.toolbarActions}>
          <CoreEditOnly><Button type="button" onClick={() => setPanelMode("add")}>
            + Добавить ученика
          </Button></CoreEditOnly>
        </div>
      </div>

      {canDelete && user ? <AdminStudentDeletionManager
        key={`${user.role}:${user.id}`}
        owner={`${user.role}:${user.id}`}
        selected={deleting}
        onSelect={setDeleting}
        onCompleted={handleDeletionCompleted}
      /> : null}

      <p className={styles.resultsSummary}>Найдено учеников: <strong>{filtered.length}</strong>{filtered.length !== students.length ? ` из ${students.length}` : ""}</p>

      {error ? <div className={styles.stateBox}>{error}</div> : null}

      {loading ? (
        <LoadingState label="Загрузка учеников…" variant="block" className={styles.stateBox} />
      ) : pageItems.length === 0 ? (
        <div className={styles.stateBox}>Ученики не найдены</div>
      ) : (
        <>
          <div className={userStyles.tableWrap}>
            <table className={userStyles.table}>
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>Класс</th>
                  <th>Логин</th>
                  <th>{BFF_DEV ? "Статус" : "Пароль"}</th>
                  <th>Группа</th>
                  <th>Школа</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <div className={userStyles.memberName}>{student.full_name}</div>
                      <div className={userStyles.memberMeta}>ID {student.id}</div>
                    </td>
                    <td>{student.class}</td>
                    <td>
                      {student.login ? (
                        <span className={userStyles.credentialCode}>{student.login}</span>
                      ) : (
                        <span className={userStyles.memberMeta}>Не задан</span>
                      )}
                    </td>
                    <td>
                      {BFF_DEV ? <span>{student.is_active === false ? "Заблокирован" : "Активен"}</span> : student.password ? (
                        <span className={userStyles.credentialCode}>{student.password}</span>
                      ) : student.password_hidden ? (
                        <span className={userStyles.memberMeta}>Задайте новый</span>
                      ) : (
                        <span className={userStyles.memberMeta}>Не задан</span>
                      )}
                    </td>
                    <td>
                      <CoreReadOnlyControl section="groups"><select
                        className={userStyles.fieldSelect}
                        value={student.group_id ?? "none"}
                        onChange={(e) => handleGroupChange(student, e.target.value)}
                      >
                        <option value="none">Без группы</option>
                        {groups.map((group) => (
                          <option key={group.group_id} value={group.group_id}>
                            {group.group_name}
                          </option>
                        ))}
                      </select></CoreReadOnlyControl>
                    </td>
                    <td>
                      {student.school_id ? (
                        <span className={userStyles.metaTag}>
                          {schoolLabel(student.school_name, student.school_short_name)}
                        </span>
                      ) : canAccessSection(user, "schools") ? (
                        <Link
                          href={adminHref(user, "schools")}
                          className={`${userStyles.metaTag} ${userStyles.metaTagMuted}`}
                        >
                          Не указана →
                        </Link>
                      ) : <span>Не указана</span>}
                    </td>
                    <td>
                      <div className={userStyles.tableActions}>
                        <CoreEditOnly><button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => {
                            setEditing(student);
                            setPanelMode("edit");
                          }}
                        >
                          Изменить
                        </button></CoreEditOnly>
                        <CoreEditOnly fullAdmin><button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          onClick={() => handleDelete(student)}
                        >
                          {BFF_DEV ? (student.is_active === false ? "Активировать" : "Заблокировать") : "Удалить"}
                        </button></CoreEditOnly>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminListPaginationBar
            pagination={pagination}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
