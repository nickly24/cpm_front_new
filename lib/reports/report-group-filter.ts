/** Прокторская группа, исключаемая фильтром «Все, кроме …» в журнальных отчётах. */
export const REPORT_EXCLUDED_PROCTOR_GROUP_NAME = "ПиП ВсОШ";

export const REPORT_GROUP_FILTER_ALL = "all";

export const REPORT_GROUP_FILTER_ALL_EXCEPT_PIP_VSOSH =
  "all_except_pip_vsosh";

export const REPORT_GROUP_FILTER_EXCEPT_PIP_OPTION = {
  value: REPORT_GROUP_FILTER_ALL_EXCEPT_PIP_VSOSH,
  label: "Все, кроме ПиП ВсОШ",
} as const;

export interface ReportGroupFilterStudent {
  group_id?: number | null;
  group_name?: string | null;
}

export function isExcludedPipVsoshGroup(
  student: ReportGroupFilterStudent,
): boolean {
  return (
    (student.group_name ?? "").trim() === REPORT_EXCLUDED_PROCTOR_GROUP_NAME
  );
}

export function matchesReportGroupFilter(
  student: ReportGroupFilterStudent,
  groupFilter: string,
): boolean {
  if (groupFilter === REPORT_GROUP_FILTER_ALL) {
    return true;
  }
  if (groupFilter === REPORT_GROUP_FILTER_ALL_EXCEPT_PIP_VSOSH) {
    return !isExcludedPipVsoshGroup(student);
  }
  if (student.group_id != null && String(student.group_id) === groupFilter) {
    return true;
  }
  return String(student.group_name ?? "") === groupFilter;
}

export function buildReportGroupFilterOptions(
  groups: { value: string; label: string }[],
): { value: string; label: string }[] {
  return [
    { value: REPORT_GROUP_FILTER_ALL, label: "Все" },
    { ...REPORT_GROUP_FILTER_EXCEPT_PIP_OPTION },
    ...groups,
  ];
}
