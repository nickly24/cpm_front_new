"use client";

import { AdminListPaginationBar } from "@/components/admin/tests/admin-list-pagination";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchAdminHomeworkStudents } from "@/lib/admin/admin-homework-api";
import type { AdminHomeworkStudentRow } from "@/lib/admin/admin-homework-types";
import { toUiPagination } from "@/lib/admin/admin-homework-utils";
import type { AdminListPagination } from "@/lib/admin/admin-tests-monitoring-types";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useCallback, useEffect, useState } from "react";

interface AdminHomeworkStudentsPanelProps {
  homeworkId: number;
}

const emptyPagination: AdminListPagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

export function AdminHomeworkStudentsPanel({
  homeworkId,
}: AdminHomeworkStudentsPanelProps) {
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminHomeworkStudentRow[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminHomeworkStudents(homeworkId, {
        page,
        limit: 10,
        search: debouncedSearch,
        status: statusFilter,
      });
      if (!res.status) {
        throw new Error(res.error || "Ошибка загрузки");
      }
      setRows(res.res ?? []);
      setPagination(toUiPagination(res.pagination));
    } catch (err) {
      setRows([]);
      setPagination(emptyPagination);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [homeworkId, page, debouncedSearch, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={styles.panel}>
      <div className={styles.panelToolbar}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Поиск по ФИО…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Все статусы</option>
          <option value="submitted">Сдано</option>
          <option value="in_progress">В процессе</option>
          <option value="overdue">Просрочено</option>
        </select>
        <button type="button" className={styles.actionBtn} onClick={load}>
          Обновить
        </button>
      </div>

      {loading ? (
        <LoadingState label="Загрузка студентов…" variant="panel" />
      ) : error ? (
        <p className={styles.panelHint}>{error}</p>
      ) : rows.length === 0 ? (
        <p className={styles.panelHint}>Студенты не найдены</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Студент</th>
                <th>Группа</th>
                <th>Статус</th>
                <th>Балл</th>
                <th>Дата сдачи</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.student_id}>
                  <td>{row.student_name}</td>
                  <td>{row.group_name ?? "—"}</td>
                  <td>{row.status_text ?? "—"}</td>
                  <td>
                    {row.status === 1 && row.result != null
                      ? row.result
                      : "—"}
                  </td>
                  <td>
                    {row.date_pass
                      ? String(row.date_pass).slice(0, 10)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminListPaginationBar
        pagination={pagination}
        onPageChange={setPage}
      />
    </div>
  );
}
