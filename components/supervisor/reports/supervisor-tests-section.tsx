"use client";

import { RatingsReportWorkspace } from "@/components/admin/ratings/report/ratings-report-workspace";
import { SupervisorReportLauncher } from "@/components/supervisor/supervisor-report-launcher";
import { SUPERVISOR_SECTION_DESCRIPTIONS } from "@/lib/navigation/supervisor-sections";
import { BFF_DEV } from "@/lib/config";
import { CoreReportWorkspace } from "./core-report-workspace";

export function SupervisorTestsSection() {
  return (
    <SupervisorReportLauncher
      title="Тесты"
      description={SUPERVISOR_SECTION_DESCRIPTIONS.tests}
    >
      {(period, onBack) => BFF_DEV ? <CoreReportWorkspace kind="tests" period={period} onBack={onBack} /> : (
        <RatingsReportWorkspace
          onBack={onBack}
          title="Результаты тестов"
          fileNamePrefix="testy"
          columnKinds={["test_direction", "test", "summary"]}
          summaryKeys={["sum_tests"]}
          periodSelection={period}
        />
      )}
    </SupervisorReportLauncher>
  );
}
