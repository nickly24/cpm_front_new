"use client";

import reportStyles from "@/components/admin/attendance/report/report.module.css";
import { ReportCell } from "@/components/admin/attendance/report/report-cell";
import { ReportSummaryCells } from "@/components/admin/attendance/report/report-summary-cell";
import { summarizeStudentAttendance } from "@/lib/attendance/attendance-report-summary";
import type {
  AttendanceReportClassDay,
  AttendanceReportEntry,
  AttendanceReportStudent,
  CellUiState,
  ReportSortDir,
  ReportSortKey,
  ReportTool,
} from "@/lib/attendance/attendance-report-types";
import { cellMapKey } from "@/lib/attendance/attendance-report-utils";
import { buildReportGroupFilterOptions } from "@/lib/reports/report-group-filter";
import { WEEKDAY_SHORT } from "@/lib/attendance/attendance-utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown, X } from "lucide-react";
import { useRef } from "react";

function formatDayHeader(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return {
    num: parsed.getDate(),
    wd: WEEKDAY_SHORT[parsed.getDay()],
  };
}

export interface ReportGridFilterOptions {
  classes: { value: string; label: string }[];
  schools: { value: string; label: string }[];
  groups: { value: string; label: string }[];
}

interface ReportGridProps {
  students: AttendanceReportStudent[];
  classDays: AttendanceReportClassDay[];
  cellMap: Map<string, AttendanceReportEntry>;
  cellUi: Map<string, CellUiState>;
  tool: ReportTool;
  sortKey: ReportSortKey;
  sortDir: ReportSortDir;
  onSort: (key: ReportSortKey) => void;
  searchFio: string;
  onSearchFioChange: (value: string) => void;
  classFilter: string;
  onClassFilterChange: (value: string) => void;
  schoolFilter: string;
  onSchoolFilterChange: (value: string) => void;
  groupFilter: string;
  onGroupFilterChange: (value: string) => void;
  filterOptions: ReportGridFilterOptions | null;
  onCellPointerDown: (
    studentId: number,
    classDayId: number,
    event?: React.MouseEvent<HTMLButtonElement>,
  ) => void;
  onCellPointerEnter: (studentId: number, classDayId: number) => void;
}

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: ReportSortDir;
}) {
  if (!active) return <ArrowUpDown size={11} aria-hidden />;
  return dir === "asc" ? (
    <ArrowUp size={11} aria-hidden />
  ) : (
    <ArrowDown size={11} aria-hidden />
  );
}

function HeaderSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
}) {
  return (
    <select
      className={reportStyles.headerSelect}
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
      onClick={(event) => event.stopPropagation()}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function ReportGrid({
  students,
  classDays,
  cellMap,
  cellUi,
  tool,
  sortKey,
  sortDir,
  onSort,
  searchFio,
  onSearchFioChange,
  classFilter,
  onClassFilterChange,
  schoolFilter,
  onSchoolFilterChange,
  groupFilter,
  onGroupFilterChange,
  filterOptions,
  onCellPointerDown,
  onCellPointerEnter,
}: ReportGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: students.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 14,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() -
        virtualRows[virtualRows.length - 1].end
      : 0;

  const interactiveTool = tool !== "cursor";
  const colSpan = 6 + classDays.length;

  const classOptions = [
    { value: "all", label: "Все" },
    ...(filterOptions?.classes ?? []),
  ];
  const schoolOptions = [
    { value: "all", label: "Все" },
    ...(filterOptions?.schools ?? []),
  ];
  const groupOptions = buildReportGroupFilterOptions(filterOptions?.groups ?? []);

  if (classDays.length === 0) {
    return (
      <div className={reportStyles.gridWrap}>
        <div className={reportStyles.emptyGrid}>
          За выбранный период нет дней занятий.
        </div>
      </div>
    );
  }

  const hasRows = students.length > 0;

  return (
    <div ref={scrollRef} className={reportStyles.gridWrap}>
      <table className={reportStyles.gridTable}>
        <thead>
          <tr>
            <th className={reportStyles.colGroup}>
              <div className={reportStyles.headerStack}>
                <button
                  type="button"
                  className={`${reportStyles.headerBtn} ${sortKey === "group" ? reportStyles.headerBtnActive : ""}`}
                  onClick={() => onSort("group")}
                >
                  Группа
                  <SortIcon active={sortKey === "group"} dir={sortDir} />
                </button>
                <HeaderSelect
                  value={groupFilter}
                  onChange={onGroupFilterChange}
                  options={groupOptions}
                  ariaLabel="Фильтр по группе"
                />
              </div>
            </th>
            <th className={reportStyles.colClass}>
              <div className={reportStyles.headerStack}>
                <button
                  type="button"
                  className={`${reportStyles.headerBtn} ${sortKey === "class" ? reportStyles.headerBtnActive : ""}`}
                  onClick={() => onSort("class")}
                >
                  Класс
                  <SortIcon active={sortKey === "class"} dir={sortDir} />
                </button>
                <HeaderSelect
                  value={classFilter}
                  onChange={onClassFilterChange}
                  options={classOptions}
                  ariaLabel="Фильтр по классу"
                />
              </div>
            </th>
            <th className={reportStyles.colSchool}>
              <div className={reportStyles.headerStack}>
                <button
                  type="button"
                  className={`${reportStyles.headerBtn} ${sortKey === "school" ? reportStyles.headerBtnActive : ""}`}
                  onClick={() => onSort("school")}
                >
                  Школа
                  <SortIcon active={sortKey === "school"} dir={sortDir} />
                </button>
                <HeaderSelect
                  value={schoolFilter}
                  onChange={onSchoolFilterChange}
                  options={schoolOptions}
                  ariaLabel="Фильтр по школе"
                />
              </div>
            </th>
            <th className={reportStyles.colFio}>
              <div className={reportStyles.headerStack}>
                <button
                  type="button"
                  className={`${reportStyles.headerBtn} ${reportStyles.headerFioSort} ${sortKey === "fio" ? reportStyles.headerBtnActive : ""}`}
                  onClick={() => onSort("fio")}
                  title="Сортировка по ФИО"
                >
                  ФИО
                  <SortIcon active={sortKey === "fio"} dir={sortDir} />
                </button>
                <div className={reportStyles.headerSearchWrap}>
                  <input
                    type="text"
                    className={reportStyles.headerSearch}
                    value={searchFio}
                    placeholder="Поиск…"
                    aria-label="Поиск по ФИО"
                    onChange={(event) => onSearchFioChange(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                  />
                  {searchFio ? (
                    <button
                      type="button"
                      className={reportStyles.headerSearchClear}
                      title="Очистить поиск"
                      aria-label="Очистить поиск"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSearchFioChange("");
                      }}
                    >
                      <X size={12} aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>
            </th>
            {classDays.map((day) => {
              const { num, wd } = formatDayHeader(day.date);
              return (
                <th key={day.id} className={reportStyles.colDay}>
                  <div className={reportStyles.dayHeader} title={day.comment ?? undefined}>
                    <span className={reportStyles.dayHeaderNum}>{num}</span>
                    <span className={reportStyles.dayHeaderWd}>{wd}</span>
                  </div>
                </th>
              );
            })}
            <th className={reportStyles.colSummaryStat} title="Отмечено занятий">
              <div className={reportStyles.summaryHeaderMini}>Σ</div>
            </th>
            <th className={reportStyles.colSummaryChips} title="Разбивка по типам">
              <div className={reportStyles.summaryHeaderMini}>Сводка</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {!hasRows ? (
            <tr>
              <td colSpan={colSpan} className={reportStyles.gridEmptyRow}>
                {searchFio.trim()
                  ? "Никого не найдено по ФИО. Очистите поиск или измените фильтры."
                  : "Нет учеников по выбранным фильтрам."}
              </td>
            </tr>
          ) : null}
          {hasRows && paddingTop > 0 ? (
            <tr aria-hidden>
              <td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: "none" }} />
            </tr>
          ) : null}
          {hasRows
            ? virtualRows.map((virtualRow) => {
            const student = students[virtualRow.index];
            const summary = summarizeStudentAttendance(
              student.student_id,
              classDays,
              cellMap,
            );
            return (
              <tr key={student.student_id} data-index={virtualRow.index}>
                <td
                  className={`${reportStyles.colGroup} ${reportStyles.frozenCell} ${reportStyles.frozenCellMuted}`}
                >
                  <span className={reportStyles.frozenCellInner}>
                    {student.group_name ?? "—"}
                  </span>
                </td>
                <td className={`${reportStyles.colClass} ${reportStyles.frozenCell}`}>
                  <span className={reportStyles.frozenCellInner}>
                    {student.class ?? "—"}
                  </span>
                </td>
                <td
                  className={`${reportStyles.colSchool} ${reportStyles.frozenCell} ${reportStyles.frozenCellMuted}`}
                >
                  <span className={reportStyles.frozenCellInner}>
                    {student.school_short_name ?? "—"}
                  </span>
                </td>
                <td
                  className={`${reportStyles.colFio} ${reportStyles.frozenCell} ${reportStyles.frozenCellFio}`}
                  title={student.full_name}
                >
                  <span className={reportStyles.frozenCellInner}>
                    {student.full_name}
                  </span>
                </td>
                {classDays.map((day) => {
                  const key = cellMapKey(student.student_id, day.id);
                  const entry = cellMap.get(key) ?? null;
                  const ui = cellUi.get(key);
                  return (
                    <td key={day.id} className={reportStyles.colDay}>
                      <ReportCell
                        entry={entry}
                        tool={tool}
                        uiState={ui}
                        interactive={interactiveTool}
                        onPointerDown={(event) =>
                          onCellPointerDown(student.student_id, day.id, event)
                        }
                        onPointerEnter={() =>
                          onCellPointerEnter(student.student_id, day.id)
                        }
                      />
                    </td>
                  );
                })}
                <ReportSummaryCells summary={summary} />
              </tr>
            );
              })
            : null}
          {hasRows && paddingBottom > 0 ? (
            <tr aria-hidden>
              <td colSpan={colSpan} style={{ height: paddingBottom, padding: 0, border: "none" }} />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
