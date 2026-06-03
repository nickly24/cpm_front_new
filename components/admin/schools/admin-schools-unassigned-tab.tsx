"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import userStyles from "@/components/admin/users/admin-users.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import {
  assignAdminStudentToSchool,
  fetchAdminUnassignedSchoolStudents,
} from "@/lib/admin/admin-schools-api";
import type { AdminSchool } from "@/lib/admin/admin-schools-types";
import { useCallback, useEffect, useState } from "react";

interface AdminSchoolsUnassignedTabProps {
  schools: AdminSchool[];
  onChanged: () => void | Promise<void>;
}

export function AdminSchoolsUnassignedTab({
  schools,
  onChanged,
}: AdminSchoolsUnassignedTabProps) {
  const [students, setStudents] = useState<
    Awaited<ReturnType<typeof fetchAdminUnassignedSchoolStudents>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStudents(await fetchAdminUnassignedSchoolStudents());
    } catch (err) {
      setStudents([]);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const assign = async (studentId: number) => {
    const schoolId = selection[studentId];
    if (!schoolId) {
      window.alert("Выберите школу");
      return;
    }
    try {
      await assignAdminStudentToSchool(studentId, Number(schoolId));
      setStudents((prev) => prev.filter((s) => s.student_id !== studentId));
      await onChanged();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка");
    }
  };

  if (loading) {
    return (
      <LoadingState label="Загрузка…" variant="block" className={styles.stateBox} />
    );
  }

  if (error) {
    return <div className={styles.stateBox}>{error}</div>;
  }

  if (students.length === 0) {
    return (
      <div className={styles.stateBox}>
        Все ученики привязаны к школам
      </div>
    );
  }

  if (schools.length === 0) {
    return (
      <div className={styles.stateBox}>
        Сначала создайте школу во вкладке «Справочник»
      </div>
    );
  }

  return (
    <>
      <p className={userStyles.hint}>
        Ученики без школы. Группа CPM назначается отдельно в разделе «Пользователи».
      </p>
      <div className={userStyles.memberList}>
        {students.map((student) => (
          <div key={student.student_id} className={userStyles.searchResultRow}>
            <div>
              <div className={userStyles.memberName}>{student.full_name}</div>
              <div className={userStyles.memberMeta}>
                ID {student.student_id}
                {student.class ? ` · класс ${student.class}` : ""}
                {student.group_id ? ` · группа #${student.group_id}` : ""}
              </div>
            </div>
            <div className={userStyles.tableActions}>
              <select
                className={userStyles.fieldSelect}
                value={selection[student.student_id] ?? ""}
                onChange={(e) =>
                  setSelection((prev) => ({
                    ...prev,
                    [student.student_id]: e.target.value,
                  }))
                }
              >
                <option value="">Школа</option>
                {schools.map((school) => (
                  <option key={school.school_id} value={school.school_id}>
                    {school.short_name || school.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => assign(student.student_id)}
              >
                Привязать
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
