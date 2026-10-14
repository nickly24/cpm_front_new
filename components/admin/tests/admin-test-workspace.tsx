"use client";
import { BFF_DEV } from "@/lib/config";

import { EditOnly, useAdminSectionAccess } from "@/components/admin/admin-section-access";

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
  onEditInNew: (testId: string) => void;
}

export function AdminTestWorkspace({
  testId,
  directions,
  onBack,
  onEdit,
  onEditInNew,
}: AdminTestWorkspaceProps) {
  const { canView: canViewResults } = useAdminSectionAccess("test-results");
  const [metaError,setMetaError] = useState<string|null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("test");
  const [title, setTitle] = useState("Тест");
  const [testDetail, setTestDetail] = useState<AdminTestDetail | null>(null);
  const [analytics, setAnalytics] = useState<AdminTestAnalytics | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  const loadMeta = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const test = await fetchAdminTestById(testId);
      const overview = !BFF_DEV || canViewResults ? await fetchAdminTestOverview(testId) : null;
      setTestDetail(test);
      setTitle(test.title || overview?.testTitle || "Тест");
      setAnalytics(overview?.analytics || null);
      setMetaError(null);
    } catch (err) {
      setAnalytics(null);
      setMetaError(err instanceof Error?err.message:"Не удалось загрузить тест");
    } finally {
      setLoadingOverview(false);
    }
  }, [testId,canViewResults]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const tabs: { id: WorkspaceTab; label: string }[] = [
    { id: "test", label: "Тест" },
    ...(!BFF_DEV || canViewResults ? [{ id: "sessions" as const, label: "Сдачи" }, { id: "attempts" as const, label: "В процессе" }] : []),
  ];

  return (
    <div className={styles.fullscreenShell}>
      <header className={styles.fullscreenHeader}>
        <div className={styles.fullscreenHeaderContent}>
          <AdminFullscreenBack onBack={onBack} />
          <div className={styles.fullscreenHeaderMain}>
            <h1 className={styles.fullscreenTitle}>{title}</h1>
            <div className={styles.fullscreenHeaderActions}>
            <EditOnly><Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => testDetail && onEdit(testDetail)}
              disabled={!testDetail || (BFF_DEV && !testDetail.actions?.can_edit_metadata && !testDetail.actions?.can_edit_settings)}
            >
              Редактировать
            </Button></EditOnly>
            <EditOnly><Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={BFF_DEV && !testDetail?.actions?.can_edit_metadata}
              onClick={() => onEditInNew(testId)}
            >
              Редактировать в новом интерфейсе
            </Button></EditOnly>
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
        {metaError?<p className={styles.errorText}>{metaError}</p>:null}
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
