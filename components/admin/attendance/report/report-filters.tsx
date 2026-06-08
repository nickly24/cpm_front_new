"use client";

import attendanceStyles from "@/components/admin/attendance/admin-attendance.module.css";
import reportStyles from "@/components/admin/attendance/report/report.module.css";
import { OptionSelect } from "@/components/ui/option-select";
import { uniqueFilterOptions } from "@/lib/attendance/attendance-report-utils";
import type { AttendanceReportStudent } from "@/lib/attendance/attendance-report-types";
import { Filter, GraduationCap, School, Users } from "lucide-react";
import { useMemo } from "react";

interface ReportFiltersProps {
  students: AttendanceReportStudent[];
  searchFio: string;
  onSearchFioChange: (value: string) => void;
  classFilter: string;
  onClassFilterChange: (value: string) => void;
  schoolFilter: string;
  onSchoolFilterChange: (value: string) => void;
  groupFilter: string;
  onGroupFilterChange: (value: string) => void;
}

const ALL_OPTION = {
  value: "all" as const,
  label: "Все",
  icon: Filter,
};

export function ReportFilters({
  students,
  searchFio,
  onSearchFioChange,
  classFilter,
  onClassFilterChange,
  schoolFilter,
  onSchoolFilterChange,
  groupFilter,
  onGroupFilterChange,
}: ReportFiltersProps) {
  const { classes, schools, groups } = useMemo(
    () => uniqueFilterOptions(students),
    [students],
  );

  const classOptions = useMemo(
    () => [
      ALL_OPTION,
      ...classes.map((item) => ({
        value: item.value,
        label: `Класс ${item.label}`,
        icon: GraduationCap,
      })),
    ],
    [classes],
  );

  const schoolOptions = useMemo(
    () => [
      ALL_OPTION,
      ...schools.map((item) => ({
        value: item.value,
        label: item.label,
        icon: School,
      })),
    ],
    [schools],
  );

  const groupOptions = useMemo(
    () => [
      ALL_OPTION,
      ...groups.map((item) => ({
        value: item.value,
        label: item.label,
        icon: Users,
      })),
    ],
    [groups],
  );

  return (
    <div className={reportStyles.filtersRow}>
      <div className={reportStyles.searchField}>
        <label className={attendanceStyles.fieldLabel} htmlFor="report-fio-search">
          Поиск по ФИО
        </label>
        <input
          id="report-fio-search"
          type="search"
          className={reportStyles.searchInput}
          value={searchFio}
          onChange={(event) => onSearchFioChange(event.target.value)}
          placeholder="Фамилия, имя…"
        />
      </div>
      <OptionSelect
        label="Класс"
        value={classFilter}
        options={classOptions}
        onChange={onClassFilterChange}
        className={reportStyles.filterSelect}
      />
      <OptionSelect
        label="Школа"
        value={schoolFilter}
        options={schoolOptions}
        onChange={onSchoolFilterChange}
        className={reportStyles.filterSelect}
      />
      <OptionSelect
        label="Группа"
        value={groupFilter}
        options={groupOptions}
        onChange={onGroupFilterChange}
        className={reportStyles.filterSelect}
      />
    </div>
  );
}
