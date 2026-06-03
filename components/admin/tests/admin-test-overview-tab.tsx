"use client";

import { AdminTestForm } from "@/components/admin/tests/admin-test-form";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import type { AdminTestAnalytics } from "@/lib/admin/admin-tests-monitoring-types";
import type { AdminTestDetail, Direction } from "@/lib/admin/admin-tests-types";

interface AdminTestOverviewTabProps {
  loading: boolean;
  analytics: AdminTestAnalytics | null;
  testDetail: AdminTestDetail | null;
  directions: Direction[];
  onBack: () => void;
  onReload: () => void;
}

export function AdminTestOverviewTab({
  loading,
  analytics,
  testDetail,
  directions,
  onBack,
  onReload,
}: AdminTestOverviewTabProps) {
  return (
    <div className={styles.overviewTab}>
      <section className={styles.overviewGrid}>
        {loading ? (
          <LoadingState label="Загрузка сводки…" variant="compact" />
        ) : analytics ? (
          <>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Сдали тест</span>
              <strong className={styles.statValue}>
                {analytics.sessionsCompleted}
              </strong>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Сейчас в тесте</span>
              <strong className={styles.statValue}>
                {analytics.attemptsActive}
              </strong>
              <span className={styles.statSub}>
                в процессе {analytics.attemptsInProgress}, истекло{" "}
                {analytics.attemptsExpired}
              </span>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Средний балл</span>
              <strong className={styles.statValue}>
                {analytics.averageScore != null
                  ? `${analytics.averageScore}%`
                  : "—"}
              </strong>
            </article>
          </>
        ) : (
          <p className={styles.panelHint}>Не удалось загрузить сводку</p>
        )}
      </section>

      {testDetail ? (
        <section className={styles.overviewQuestions}>
          <h2 className={styles.overviewSectionTitle}>Содержание теста</h2>
          <p className={styles.panelHint}>
            {testDetail.questions?.length ?? 0} вопросов · лимит{" "}
            {testDetail.timeLimitMinutes ?? "—"} мин
          </p>
          <AdminTestForm
            mode="view"
            directions={directions}
            editingTest={testDetail}
            embedded
            onBack={onBack}
            onSaved={onReload}
          />
        </section>
      ) : null}
    </div>
  );
}
