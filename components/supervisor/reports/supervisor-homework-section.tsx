"use client";

import { SupervisorOvHomeworkWorkspace } from "@/components/supervisor/reports/supervisor-ov-homework-workspace";
import { SupervisorReportLauncher } from "@/components/supervisor/supervisor-report-launcher";
import { SUPERVISOR_SECTION_DESCRIPTIONS } from "@/lib/navigation/supervisor-sections";

export function SupervisorHomeworkSection() {
  return (
    <SupervisorReportLauncher
      title="Домашние задания"
      description={SUPERVISOR_SECTION_DESCRIPTIONS.homework}
    >
      {(period, onBack) => (
        <SupervisorOvHomeworkWorkspace period={period} onBack={onBack} />
      )}
    </SupervisorReportLauncher>
  );
}
