"use client";

import { AdminListPaginationBar } from "@/components/admin/tests/admin-list-pagination";
import styles from "@/components/admin/tests/admin-tests.module.css";
import userStyles from "@/components/admin/users/admin-users.module.css";
import { AdminStudentPanel } from "@/components/admin/users/admin-student-panel";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import {
  deleteAdminUser,
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
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 15;

export function AdminStudentsTab() {
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

  const classOptions = useMemo(
    () => Array.from(new Set(students.map((student) => student.class))).sort((a, b) => a - b),
    [students],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [studentsData, groupsData] = await Promise.all([
        fetchAdminStudents(),
        fetchAdminGroupsList(),
      ]);
      setStudents(studentsData);
      setGroups(groupsData);
    } catch (err) {
      setStudents([]);
      setError(err instanceof Error ? err.message : "Не удалось загрузить учеников");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const filtered = useMemo(() => {
    return students.filter((student) => {
      if (!matchesStudentSearch(student.full_name, student.id, debouncedSearch)) {
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

  const pagination = toClientPagination(page, PAGE_SIZE, filtered.length);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = async (student: AdminStudent) => {
    if (!window.confirm(`Удалить ученика «${student.full_name}»?`)) {
      return;
    }
    try {
      await deleteAdminUser("student", student.id);
      setStudents((prev) => prev.filter((s) => s.id !== student.id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка удаления");
    }
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
      <div className={styles.filters}>
        <div className={userStyles.statsRow}>
          <span className={userStyles.statPill}>
            Всего: <strong>{students.length}</strong>
          </span>
          <span className={userStyles.statPill}>
            В выборке: <strong>{filtered.length}</strong>
          </span>
        </div>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Поиск по ФИО или ID…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <div className={styles.dateRow}>
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
          <Button type="button" onClick={() => setPanelMode("add")}>
            + Добавить ученика
          </Button>
        </div>
      </div>

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
                      <select
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
                      </select>
                    </td>
                    <td>
                      {student.school_id ? (
                        <span className={userStyles.metaTag}>
                          {schoolLabel(student.school_name, student.school_short_name)}
                        </span>
                      ) : (
                        <Link
                          href="/cabinet/admin/schools"
                          className={`${userStyles.metaTag} ${userStyles.metaTagMuted}`}
                        >
                          Не указана →
                        </Link>
                      )}
                    </td>
                    <td>
                      <div className={userStyles.tableActions}>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => {
                            setEditing(student);
                            setPanelMode("edit");
                          }}
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          onClick={() => handleDelete(student)}
                        >
                          Удалить
                        </button>
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
