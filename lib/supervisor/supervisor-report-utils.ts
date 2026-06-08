import type { ReportPeriodSelection } from "@/components/admin/attendance/report/period-modal";
import type {
  RatingsReportColumn,
  RatingsReportColumnKind,
  RatingsReportValue,
} from "@/lib/admin/ratings-report-types";

export function formatSupervisorPeriodLabel(
  period: ReportPeriodSelection | null,
): string {
  if (!period) {
    return "Период не выбран";
  }
  return `${period.dateFrom} — ${period.dateTo}`;
}

function isDateInRange(
  dateValue: string | null | undefined,
  dateFrom: string,
  dateTo: string,
): boolean {
  if (!dateValue) {
    return true;
  }
  const date = String(dateValue).slice(0, 10);
  return date >= dateFrom && date <= dateTo;
}

export function filterRatingsColumns(
  columns: RatingsReportColumn[],
  options: {
    kinds?: RatingsReportColumnKind[];
    summaryKeys?: string[];
    period?: ReportPeriodSelection | null;
  },
): RatingsReportColumn[] {
  const kindSet = options.kinds ? new Set(options.kinds) : null;
  const summarySet = options.summaryKeys ? new Set(options.summaryKeys) : null;

  return columns.filter((column) => {
    if (column.kind === "summary") {
      if (summarySet && !summarySet.has(column.key)) {
        return false;
      }
      if (kindSet && !kindSet.has("summary")) {
        return false;
      }
      return true;
    }

    if (kindSet && !kindSet.has(column.kind)) {
      return false;
    }

    if (
      options.period &&
      (column.kind === "homework" || column.kind === "exam")
    ) {
      return isDateInRange(
        column.subtitle,
        options.period.dateFrom,
        options.period.dateTo,
      );
    }

    return true;
  });
}

export function filterRatingsValues(
  values: RatingsReportValue[],
  columns: RatingsReportColumn[],
): RatingsReportValue[] {
  const keys = new Set(columns.map((column) => column.key));
  return values.filter((value) => keys.has(value.column_key));
}

export function filterHomeworksByPeriod<
  T extends { deadline?: string | null },
>(items: T[], period: ReportPeriodSelection | null): T[] {
  if (!period) {
    return items;
  }
  return items.filter((item) =>
    isDateInRange(item.deadline, period.dateFrom, period.dateTo),
  );
}
