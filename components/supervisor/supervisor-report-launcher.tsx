"use client";

import {
  PeriodModal,
  type ReportPeriodSelection,
} from "@/components/admin/attendance/report/period-modal";
import styles from "@/components/admin/tests/admin-tests.module.css";
import dashboardStyles from "@/components/admin/dashboard/admin-dashboard.module.css";
import { Button } from "@/components/ui/button";
import { useCabinetChrome } from "@/contexts/cabinet-chrome-context";
import { CalendarRange } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

interface SupervisorReportLauncherProps {
  title: string;
  description: string;
  children: (period: ReportPeriodSelection, onBack: () => void) => ReactNode;
}

export function SupervisorReportLauncher({
  title,
  description,
  children,
}: SupervisorReportLauncherProps) {
  const [period, setPeriod] = useState<ReportPeriodSelection | null>(null);
  const [modalOpen, setModalOpen] = useState(true);
  const { setImmersive } = useCabinetChrome();

  useEffect(() => {
    setImmersive(Boolean(period));
    return () => setImmersive(false);
  }, [period, setImmersive]);

  if (period) {
    return <>{children(period, () => setPeriod(null))}</>;
  }

  return (
    <div className={styles.page}>
      <header className={dashboardStyles.welcome}>
        <h1 className={dashboardStyles.welcomeTitle}>{title}</h1>
        <p className={dashboardStyles.welcomeText}>{description}</p>
        <Button type="button" onClick={() => setModalOpen(true)}>
          <CalendarRange size={16} aria-hidden />
          Выбрать период и сформировать отчёт
        </Button>
      </header>

      {modalOpen ? (
        <PeriodModal
          onClose={() => setModalOpen(false)}
          onCreate={(nextPeriod) => {
            setPeriod(nextPeriod);
            setModalOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
