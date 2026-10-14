"use client";

import { RatingsReportWorkspace } from "@/components/admin/ratings/report/ratings-report-workspace";
import { SupervisorReportLauncher } from "@/components/supervisor/supervisor-report-launcher";
import { SUPERVISOR_SECTION_DESCRIPTIONS } from "@/lib/navigation/supervisor-sections";
import { BFF_DEV } from "@/lib/config";
import { CoreReportWorkspace } from "./core-report-workspace";

export function SupervisorExamsSection() {
  return (
    <SupervisorReportLauncher
      title="Экзамены"
      description={SUPERVISOR_SECTION_DESCRIPTIONS.exams}
    >
      {(period, onBack) => BFF_DEV ? <CoreReportWorkspace kind="exams" period={period} onBack={onBack} /> : (
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
