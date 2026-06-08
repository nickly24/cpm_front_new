"use client";

import { ProctorHomeworkList } from "@/components/proctor/proctor-homework-list";
import styles from "@/components/proctor/proctor.module.css";
import { useAuth } from "@/contexts/AuthContext";

export function ProctorHomeworkSection() {
  const { user } = useAuth();

  if (!user?.id) {
    return null;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Проктор</span>
          <h1 className={styles.title}>Домашние задания</h1>
          <p className={styles.subtitle}>
            Занесение и редактирование сдачи ДЗ для учеников вашей группы
          </p>
        </div>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelBody}>
          <ProctorHomeworkList proctorId={user.id} />
        </div>
      </section>
    </div>
  );
}
