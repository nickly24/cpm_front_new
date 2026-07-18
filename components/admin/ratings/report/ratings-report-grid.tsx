"use client";

import reportStyles from "@/components/admin/attendance/report/report.module.css";
import ratingReportStyles from "@/components/admin/ratings/report/ratings-report.module.css";
import type {
  RatingsReportColumn,
  RatingsReportSortDir,
  RatingsReportSortKey,
  RatingsReportStudent,
  RatingsReportValue,
} from "@/lib/admin/ratings-report-types";
import {
  formatScore,
  valueMapKey,
} from "@/lib/admin/ratings-report-utils";
import { buildReportGroupFilterOptions } from "@/lib/reports/report-group-filter";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown, X } from "lucide-react";
import { useMemo, useRef } from "react";

export interface RatingsReportGridFilterOptions {
  classes: { value: string; label: string }[];
  schools: { value: string; label: string }[];
  groups: { value: string; label: string }[];
}

interface RatingsReportGridProps {
  students: RatingsReportStudent[];
  columns: RatingsReportColumn[];
  valueMap: Map<string, RatingsReportValue>;
  sortKey: RatingsReportSortKey;
  sortDir: RatingsReportSortDir;
  onSort: (key: RatingsReportSortKey) => void;
  searchFio: string;
  onSearchFioChange: (value: string) => void;
  classFilter: string;
  onClassFilterChange: (value: string) => void;
  schoolFilter: string;
  onSchoolFilterChange: (value: string) => void;
  groupFilter: string;
  onGroupFilterChange: (value: string) => void;
  filterOptions: RatingsReportGridFilterOptions | null;
}

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: RatingsReportSortDir;
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

function sectionClass(kind: RatingsReportColumn["kind"]): string {
  if (kind === "homework") return ratingReportStyles.sectionHeaderHomework;
  if (kind === "exam") return ratingReportStyles.sectionHeaderExam;
  if (kind === "test_direction") return ratingReportStyles.sectionHeaderTestDirection;
  if (kind === "test") return ratingReportStyles.sectionHeaderTest;
  return ratingReportStyles.sectionHeaderSummary;
}

function scoreCellClass(column: RatingsReportColumn, score: number): string {
  const base = ratingReportStyles.scoreCell;
  if (column.key === "sum_final") {
    return `${base} ${ratingReportStyles.scoreCellFinal}`;
  }
  if (column.kind === "summary") {
    return `${base} ${ratingReportStyles.scoreCellSummary}`;
  }
  if (column.kind === "test_direction") {
    return `${base} ${ratingReportStyles.scoreCellDirection}`;
  }
  if (score > 0) {
    return `${base} ${ratingReportStyles.scoreCellPositive}`;
  }
  return `${base} ${ratingReportStyles.scoreCellZero}`;
}

function groupColumns(columns: RatingsReportColumn[]) {
  const groups: {
    key: string;
    kind: RatingsReportColumn["kind"];
    label: string;
    items: RatingsReportColumn[];
  }[] = [];
  for (const column of columns) {
    const last = groups[groups.length - 1];
    const groupKey = column.group_key ?? column.kind;
    if (last && last.key === groupKey) {
      last.items.push(column);
      continue;
    }
    const label =
      column.group_label ?? (column.kind === "summary"
        ? "Сводка"
        : column.kind === "homework"
          ? "Домашние задания"
          : column.kind === "exam"
            ? "Экзамены"
            : column.kind === "test_direction"
              ? "Среднее по направлениям"
              : "Тесты по направлениям");
    groups.push({ key: groupKey, kind: column.kind, label, items: [column] });
  }
  return groups;
}

export function RatingsReportGrid({
  students,
  columns,
  valueMap,
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
}: RatingsReportGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnGroups = useMemo(() => groupColumns(columns), [columns]);

  const rowVirtualizer = useVirtualizer({
    count: students.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 12,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  const classOptions = [
    { value: "all", label: "Все" },
    ...(filterOptions?.classes ?? []),
  ];
  const schoolOptions = [
    { value: "all", label: "Все" },
    ...(filterOptions?.schools ?? []),
  ];
  const groupOptions = buildReportGroupFilterOptions(filterOptions?.groups ?? []);

  const fixedColSpan = 4;
  const colSpan = fixedColSpan + columns.length;

  return (
    <div ref={scrollRef} className={reportStyles.gridWrap}>
      <table className={reportStyles.gridTable}>
        <thead>
          <tr>
            <th className={reportStyles.colGroup} rowSpan={2}>
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
            <th className={reportStyles.colClass} rowSpan={2}>
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
            <th className={reportStyles.colSchool} rowSpan={2}>
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
            <th className={reportStyles.colFio} rowSpan={2}>
              <div className={reportStyles.headerStack}>
                <button
                  type="button"
                  className={`${reportStyles.headerBtn} ${reportStyles.headerFioSort} ${sortKey === "fio" ? reportStyles.headerBtnActive : ""}`}
                  onClick={() => onSort("fio")}
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
                  />
                  {searchFio ? (
                    <button
                      type="button"
                      className={reportStyles.headerSearchClear}
                      aria-label="Очистить поиск"
                      onClick={() => onSearchFioChange("")}
                    >
                      <X size={12} aria-hidden />
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={`${reportStyles.headerBtn} ${sortKey === "final" ? reportStyles.headerBtnActive : ""}`}
                  onClick={() => onSort("final")}
                >
                  Итог
                  <SortIcon active={sortKey === "final"} dir={sortDir} />
                </button>
              </div>
            </th>
            {columnGroups.map((group) => (
              <th
                key={group.key}
                colSpan={group.items.length}
                className={sectionClass(group.kind)}
              >
                {group.label}
              </th>
            ))}
          </tr>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`${column.kind === "test_direction" ? ratingReportStyles.colDirectionScore : ratingReportStyles.colScore} ${sectionClass(column.kind)}`}
                title={column.subtitle ? `${column.label} · ${column.subtitle}` : column.label}
              >
                <div className={ratingReportStyles.columnHeaderStack}>
                  <span className={ratingReportStyles.columnHeaderTitle}>
                    {column.label}
                  </span>
                  {column.subtitle ? (
                    <span className={ratingReportStyles.columnHeaderSubtitle}>
                      {column.subtitle}
                    </span>
                  ) : null}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.length === 0 ? (
            <tr>
              <td colSpan={colSpan}>
                <div className={ratingReportStyles.emptyReport}>
                  Нет учеников по выбранным фильтрам
                </div>
              </td>
            </tr>
          ) : (
            <>
              {paddingTop > 0 ? (
                <tr aria-hidden>
                  <td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: "none" }} />
                </tr>
              ) : null}
              {virtualRows.map((virtualRow) => {
                const student = students[virtualRow.index];
                return (
                  <tr key={student.student_id} data-index={virtualRow.index}>
                    <td className={`${reportStyles.colGroup} ${reportStyles.frozenCellMuted}`}>
                      <span className={reportStyles.frozenCellInner}>
                        {student.group_name ?? "—"}
                      </span>
                    </td>
                    <td className={reportStyles.colClass}>
                      <span className={reportStyles.frozenCellInner}>
                        {student.class ?? "—"}
                      </span>
                    </td>
                    <td className={`${reportStyles.colSchool} ${reportStyles.frozenCellMuted}`}>
                      <span className={reportStyles.frozenCellInner}>
                        {student.school_short_name ?? "—"}
                      </span>
                    </td>
                    <td className={`${reportStyles.colFio} ${reportStyles.frozenCellFio}`} title={student.full_name}>
                      <span className={reportStyles.frozenCellInner}>
                        {student.full_name}
                      </span>
                    </td>
                    {columns.map((column) => {
                      const cell = valueMap.get(
                        valueMapKey(student.student_id, column.key),
                      );
                      const score = cell?.score ?? 0;
                      return (
                        <td
                          key={column.key}
                          className={column.kind === "test_direction" ? ratingReportStyles.colDirectionScore : ratingReportStyles.colScore}
                          title={
                            cell?.status
                              ? `${formatScore(score)} · ${cell.status}`
                              : formatScore(score)
                          }
                        >
                          <div className={scoreCellClass(column, score)}>
                            {formatScore(score)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {paddingBottom > 0 ? (
                <tr aria-hidden>
                  <td colSpan={colSpan} style={{ height: paddingBottom, padding: 0, border: "none" }} />
                </tr>
              ) : null}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
