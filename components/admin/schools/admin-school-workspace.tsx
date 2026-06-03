"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import userStyles from "@/components/admin/users/admin-users.module.css";
import { AdminFullscreenBack } from "@/components/admin/admin-fullscreen-back";
import { LoadingState } from "@/components/ui/loading-state";
import {
  assignAdminStudentToSchool,
  fetchAdminSchoolById,
  fetchAdminSchoolStudents,
  removeAdminStudentFromSchool,
  searchAdminStudentsForSchool,
} from "@/lib/admin/admin-schools-api";
import type { AdminSchool, AdminSchoolStudent } from "@/lib/admin/admin-schools-types";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useCallback, useEffect, useState } from "react";

interface AdminSchoolWorkspaceProps {
  schoolId: number;
  onBack: () => void;
}

export function AdminSchoolWorkspace({ schoolId, onBack }: AdminSchoolWorkspaceProps) {
  const [school, setSchool] = useState<AdminSchool | null>(null);
  const [students, setStudents] = useState<AdminSchoolStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [searchResults, setSearchResults] = useState<
    Awaited<ReturnType<typeof searchAdminStudentsForSchool>>
  >([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [schoolData, studentsData] = await Promise.all([
        fetchAdminSchoolById(schoolId),
        fetchAdminSchoolStudents(schoolId),
      ]);
      if (!schoolData) {
        throw new Error("Школа не найдена");
      }
      setSchool(schoolData);
      setStudents(studentsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    setSearching(true);
    searchAdminStudentsForSchool(debouncedSearch)
      .then((results) => {
        if (!cancelled) {
          setSearchResults(results);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSearching(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const handleAssign = async (studentId: number) => {
    try {
      await assignAdminStudentToSchool(studentId, schoolId);
      await load();
      setSearch("");
      setSearchResults([]);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Не удалось привязать");
    }
  };

  const handleRemove = async (studentId: number) => {
    if (!window.confirm("Убрать ученика из этой школы?")) {
      return;
    }
    try {
      await removeAdminStudentFromSchool(studentId);
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка");
    }
  };

  return (
    <div className={styles.page}>
      <AdminFullscreenBack onBack={onBack} label="К списку школ" />

      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{school?.name ?? "Школа"}</h1>
          <p className={userStyles.hint}>
            Учеников в школе: {students.length}
            {school?.short_name ? ` · ${school.short_name}` : ""}
          </p>
        </div>
      </header>

      <div className={styles.filters}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Найти ученика по ФИО и добавить в школу…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {searching ? (
        <LoadingState label="Поиск…" variant="block" className={styles.stateBox} />
      ) : searchResults.length > 0 ? (
        <div className={userStyles.searchResults}>
          {searchResults.map((student) => (
            <div key={student.id} className={userStyles.searchResultRow}>
              <div>
                <div className={userStyles.memberName}>{student.full_name}</div>
                <div className={userStyles.memberMeta}>
                  {student.school_name
                    ? `Сейчас: ${student.school_name}`
                    : "Школа не указана"}
                  {student.group_name ? ` · ${student.group_name}` : ""}
                </div>
              </div>
              <button
                type="button"
                className={styles.actionBtn}
                disabled={student.school_id === schoolId}
                onClick={() => handleAssign(student.id)}
              >
                {student.school_id === schoolId ? "Уже здесь" : "Добавить"}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <div className={styles.stateBox}>{error}</div> : null}

      {loading ? (
        <LoadingState label="Загрузка…" variant="block" className={styles.stateBox} />
      ) : students.length === 0 ? (
        <div className={styles.stateBox}>В школе пока нет учеников</div>
      ) : (
        <div className={userStyles.memberList}>
          {students.map((student) => (
            <div key={student.id} className={userStyles.memberRow}>
              <div>
                <div className={userStyles.memberName}>{student.full_name}</div>
                <div className={userStyles.memberMeta}>
                  Класс {student.class ?? "—"}
                  {student.group_id ? ` · группа #${student.group_id}` : ""}
                </div>
              </div>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                onClick={() => handleRemove(student.id)}
              >
                Убрать
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
