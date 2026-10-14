"use client";

import { RatingsReportWorkspace } from "@/components/admin/ratings/report/ratings-report-workspace";
import { SupervisorReportLauncher } from "@/components/supervisor/supervisor-report-launcher";
import { SUPERVISOR_SECTION_DESCRIPTIONS } from "@/lib/navigation/supervisor-sections";
import { BFF_DEV } from "@/lib/config";
import { RatingsReadonlyWorkspace } from "@/components/ratings/ratings-readonly-workspace";

export function SupervisorRatingsSection() {
  if (BFF_DEV) return <RatingsReadonlyWorkspace role="supervisor" />;
  return (
    <SupervisorReportLauncher
      title="Рейтинг"
      description={SUPERVISOR_SECTION_DESCRIPTIONS.ratings}
    >
      {(period, onBack) => (
        <RatingsReportWorkspace
          onBack={onBack}
          title="Общий рейтинг"
          fileNamePrefix="reyting"
          periodSelection={period}
        />
      )}
    </SupervisorReportLauncher>
  );
}
