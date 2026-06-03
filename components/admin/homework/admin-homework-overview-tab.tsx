"use client";

import { AdminHomeworkForm } from "@/components/admin/homework/admin-homework-form";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import type {
  AdminHomeworkAnalytics,
  AdminHomeworkItem,
} from "@/lib/admin/admin-homework-types";

interface AdminHomeworkOverviewTabProps {
  loading: boolean;
  analytics: AdminHomeworkAnalytics | null;
  homework: AdminHomeworkItem | null;
  onBack: () => void;
  onReload: () => void;
}

export function AdminHomeworkOverviewTab({
  loading,
  analytics,
  homework,
  onBack,
  onReload,
}: AdminHomeworkOverviewTabProps) {
  return (
    <div className={styles.overviewTab}>
      <section className={styles.overviewGrid}>
        {loading ? (
          <LoadingState label="Загрузка сводки…" variant="compact" />
        ) : analytics ? (
          <>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Всего студентов</span>
              <strong className={styles.statValue}>
                {analytics.totalStudents}
              </strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Сдали</span>
              <strong className={styles.statValue}>{analytics.submitted}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>В процессе</span>
              <strong className={styles.statValue}>
                {analytics.inProgress}
              </strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Просрочено</span>
              <strong className={styles.statValue}>{analytics.overdue}</strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Средний балл</span>
              <strong className={styles.statValue}>
                {analytics.averageScore != null
                  ? analytics.averageScore
                  : "—"}
              </strong>
            </article>
          </>
        ) : (
          <p className={styles.panelHint}>Не удалось загрузить сводку</p>
        )}
      </section>

      {homework ? (
        <section className={styles.overviewQuestions}>
          <h2 className={styles.overviewSectionTitle}>Параметры задания</h2>
          <AdminHomeworkForm
            mode="view"
            editingHomework={homework}
            embedded
            onBack={onBack}
            onSaved={onReload}
          />
        </section>
      ) : null}
    </div>
  );
}
