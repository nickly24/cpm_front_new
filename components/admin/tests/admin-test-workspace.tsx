"use client";

import { AdminFullscreenBack } from "@/components/admin/admin-fullscreen-back";
import { AdminTestAttemptsPanel } from "@/components/admin/tests/admin-test-attempts-panel";
import { AdminTestOverviewTab } from "@/components/admin/tests/admin-test-overview-tab";
import { AdminTestSessionsPanel } from "@/components/admin/tests/admin-test-sessions-panel";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { fetchAdminTestById } from "@/lib/admin/admin-tests-api";
import { fetchAdminTestOverview } from "@/lib/admin/admin-tests-monitoring-api";
import type { AdminTestAnalytics } from "@/lib/admin/admin-tests-monitoring-types";
import type { AdminTestDetail, Direction } from "@/lib/admin/admin-tests-types";
import { useCallback, useEffect, useState } from "react";

type WorkspaceTab = "test" | "sessions" | "attempts";

interface AdminTestWorkspaceProps {
  testId: string;
  directions: Direction[];
  onBack: () => void;
  onEdit: (test: AdminTestDetail) => void;
}

export function AdminTestWorkspace({
  testId,
  directions,
  onBack,
  onEdit,
}: AdminTestWorkspaceProps) {
  const [tab, setTab] = useState<WorkspaceTab>("test");
  const [title, setTitle] = useState("Тест");
  const [testDetail, setTestDetail] = useState<AdminTestDetail | null>(null);
  const [analytics, setAnalytics] = useState<AdminTestAnalytics | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  const loadMeta = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const [test, overview] = await Promise.all([
        fetchAdminTestById(testId),
        fetchAdminTestOverview(testId),
      ]);
      setTestDetail(test);
      setTitle(test.title || overview.testTitle || "Тест");
      setAnalytics(overview.analytics);
    } catch {
      setAnalytics(null);
    } finally {
      setLoadingOverview(false);
    }
  }, [testId]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const tabs: { id: WorkspaceTab; label: string }[] = [
    { id: "test", label: "Тест" },
    { id: "sessions", label: "Сдачи" },
    { id: "attempts", label: "В процессе" },
  ];

  return (
    <div className={styles.fullscreenShell}>
      <header className={styles.fullscreenHeader}>
        <div className={styles.fullscreenHeaderContent}>
          <AdminFullscreenBack onBack={onBack} />
          <div className={styles.fullscreenHeaderMain}>
            <h1 className={styles.fullscreenTitle}>{title}</h1>
            <div className={styles.fullscreenHeaderActions}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => testDetail && onEdit(testDetail)}
              disabled={!testDetail}
            >
              Редактировать
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={loadMeta}>
              Обновить
            </Button>
            </div>
          </div>
        </div>
      </header>

      <nav className={styles.workspaceTabs}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.workspaceTab} ${tab === t.id ? styles.workspaceTabActive : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className={styles.fullscreenBody}>
        {tab === "test" ? (
          <AdminTestOverviewTab
            loading={loadingOverview}
            analytics={analytics}
            testDetail={testDetail}
            directions={directions}
            onBack={onBack}
            onReload={loadMeta}
          />
        ) : null}
        {tab === "sessions" ? <AdminTestSessionsPanel testId={testId} /> : null}
        {tab === "attempts" ? <AdminTestAttemptsPanel testId={testId} /> : null}
      </div>
    </div>
  );
}
