"use client";

import { RatingsReportWorkspace } from "@/components/admin/ratings/report/ratings-report-workspace";
import { SupervisorReportLauncher } from "@/components/supervisor/supervisor-report-launcher";
import { SUPERVISOR_SECTION_DESCRIPTIONS } from "@/lib/navigation/supervisor-sections";

export function SupervisorExamsSection() {
  return (
    <SupervisorReportLauncher
      title="Экзамены"
      description={SUPERVISOR_SECTION_DESCRIPTIONS.exams}
    >
      {(period, onBack) => (
        <RatingsReportWorkspace
          onBack={onBack}
          title="Результаты экзаменов"
          fileNamePrefix="ekzameny"
          columnKinds={["exam", "summary"]}
          summaryKeys={["sum_exams"]}
          periodSelection={period}
        />
      )}
    </SupervisorReportLauncher>
  );
}
