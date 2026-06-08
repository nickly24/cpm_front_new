"use client";

import { LoadingState } from "@/components/ui/loading-state";
import { fetchProctorGroupStudents } from "@/lib/proctor/proctor-api";
import type { ProctorGroupStudent } from "@/lib/proctor/proctor-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./proctor.module.css";

interface ProctorStudentListProps {
  groupId: number | null | undefined;
}

export function ProctorStudentList({ groupId }: ProctorStudentListProps) {
  const [students, setStudents] = useState<ProctorGroupStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const loadStudents = useCallback(async () => {
    if (!groupId) {
      setStudents([]);
      setError("Группа не назначена");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchProctorGroupStudents(groupId);
      if (response.status && Array.isArray(response.res)) {
        setStudents(response.res);
      } else {
        setStudents([]);
        setError("Не удалось загрузить список учеников");
      }
    } catch (err) {
      setStudents([]);
      setError(
        err instanceof Error ? err.message : "Ошибка при загрузке учеников",
      );
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents, reloadToken]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return students;
    }
    return students.filter((student) =>
      student.full_name.toLowerCase().includes(query),
    );
  }, [search, students]);

  if (loading) {
    return <LoadingState label="Загрузка списка учеников…" variant="panel" />;
  }

  if (error) {
    return (
      <div className={styles.errorBox}>
        <p>{error}</p>
        <button
          type="button"
          className="ds-btn ds-btn--ghost ds-btn--sm"
          onClick={() => setReloadToken((value) => value + 1)}
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.searchRow}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Поиск по имени…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={students.length === 0}
        />
        <span className={styles.counter}>
          Найдено: {filteredStudents.length} из {students.length}
        </span>
      </div>

      {filteredStudents.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>ID</th>
                <th>ФИО</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id}>
                  <td>{student.id}</td>
                  <td>{student.full_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.emptyState}>
          {students.length === 0
            ? "В этой группе нет учеников"
            : "Ученики по запросу не найдены"}
        </div>
      )}
    </div>
  );
}
