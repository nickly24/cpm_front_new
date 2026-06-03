"use client";

import { AdminFullscreenBack } from "@/components/admin/admin-fullscreen-back";
import { AdminHomeworkOverviewTab } from "@/components/admin/homework/admin-homework-overview-tab";
import { AdminHomeworkStudentsPanel } from "@/components/admin/homework/admin-homework-students-panel";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import {
  fetchAdminHomeworkById,
  fetchAdminHomeworkOverview,
} from "@/lib/admin/admin-homework-api";
import type {
  AdminHomeworkAnalytics,
  AdminHomeworkItem,
} from "@/lib/admin/admin-homework-types";
import { useCallback, useEffect, useState } from "react";

type WorkspaceTab = "homework" | "students";

interface AdminHomeworkWorkspaceProps {
  homeworkId: number;
  onBack: () => void;
  onEdit: (hw: AdminHomeworkItem) => void;
}

export function AdminHomeworkWorkspace({
  homeworkId,
  onBack,
  onEdit,
}: AdminHomeworkWorkspaceProps) {
  const [tab, setTab] = useState<WorkspaceTab>("homework");
  const [title, setTitle] = useState("Домашнее задание");
  const [homework, setHomework] = useState<AdminHomeworkItem | null>(null);
  const [analytics, setAnalytics] = useState<AdminHomeworkAnalytics | null>(
    null,
  );
  const [loadingOverview, setLoadingOverview] = useState(true);

  const loadMeta = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const [hw, overview] = await Promise.all([
        fetchAdminHomeworkById(homeworkId),
        fetchAdminHomeworkOverview(homeworkId),
      ]);
      setHomework(hw);
      setAnalytics(overview.analytics);
      setTitle(hw.name || overview.homework?.name || "Домашнее задание");
    } catch {
      setAnalytics(null);
    } finally {
      setLoadingOverview(false);
    }
  }, [homeworkId]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const tabs: { id: WorkspaceTab; label: string }[] = [
    { id: "homework", label: "Задание" },
    { id: "students", label: "Студенты" },
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
              onClick={() => homework && onEdit(homework)}
              disabled={!homework}
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
        {tab === "homework" ? (
          <AdminHomeworkOverviewTab
            loading={loadingOverview}
            analytics={analytics}
            homework={homework}
            onBack={onBack}
            onReload={loadMeta}
          />
        ) : (
          <AdminHomeworkStudentsPanel homeworkId={homeworkId} />
        )}
      </div>
    </div>
  );
}
