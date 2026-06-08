"use client";

import { ReportWorkspace } from "@/components/admin/attendance/report/report-workspace";
import { SupervisorReportLauncher } from "@/components/supervisor/supervisor-report-launcher";
import { SUPERVISOR_SECTION_DESCRIPTIONS } from "@/lib/navigation/supervisor-sections";

export function SupervisorAttendanceSection() {
  return (
    <SupervisorReportLauncher
      title="Посещаемость"
      description={SUPERVISOR_SECTION_DESCRIPTIONS.attendance}
    >
      {(period, onBack) => (
        <ReportWorkspace
          period={period}
          onBack={onBack}
          readOnly
          title="Посещаемость"
        />
      )}
    </SupervisorReportLauncher>
  );
}
