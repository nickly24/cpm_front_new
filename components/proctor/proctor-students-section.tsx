"use client";

import { ProctorStudentList } from "@/components/proctor/proctor-student-list";
import styles from "@/components/proctor/proctor.module.css";
import { useAuth } from "@/contexts/AuthContext";

export function ProctorStudentsSection() {
  const { user } = useAuth();

  if (!user?.group_id) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          Группа не назначена. Обратитесь к администратору.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Проктор</span>
          <h1 className={styles.title}>Список учеников</h1>
          <p className={styles.subtitle}>
            Ученики вашей группы
          </p>
        </div>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelBody}>
          <ProctorStudentList groupId={user.group_id} />
        </div>
      </section>
    </div>
  );
}
