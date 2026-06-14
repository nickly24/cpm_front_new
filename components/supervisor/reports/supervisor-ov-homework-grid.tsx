"use client";

import gridStyles from "@/components/supervisor/reports/supervisor-homework-report.module.css";
import type {
  SupervisorOvHomework,
  SupervisorOvHomeworkStudent,
} from "@/lib/supervisor/supervisor-homework-api";
import {
  formatHomeworkDeadline,
  getHomeworkCellView,
  homeworkColumnLabel,
  homeworkTypeClass,
  type HomeworkHeaderMode,
} from "@/lib/supervisor/supervisor-homework-display";
import { useMemo } from "react";

interface SupervisorOvHomeworkGridProps {
  homeworks: SupervisorOvHomework[];
  students: SupervisorOvHomeworkStudent[];
  headerMode: HomeworkHeaderMode;
  typeFilter: "all" | "ОВ" | "ДЗНВ";
}

function toneClass(tone: ReturnType<typeof getHomeworkCellView>["tone"]): string {
  switch (tone) {
    case "empty":
      return gridStyles.toneEmpty;
    case "pending":
      return gridStyles.tonePending;
    case "progress":
      return gridStyles.toneProgress;
    case "overdue":
      return gridStyles.toneOverdue;
    case "done":
      return gridStyles.toneDone;
    case "failed":
      return gridStyles.toneFailed;
    default:
      return gridStyles.toneEmpty;
  }
}

function groupHomeworksByType(homeworks: SupervisorOvHomework[]) {
  const groups: { type: string; items: SupervisorOvHomework[] }[] = [];
  for (const homework of homeworks) {
    const last = groups[groups.length - 1];
    if (last && last.type === homework.type) {
      last.items.push(homework);
      continue;
    }
    groups.push({ type: homework.type, items: [homework] });
  }
  return groups;
}

export function SupervisorOvHomeworkGrid({
  homeworks,
  students,
  headerMode,
  typeFilter,
}: SupervisorOvHomeworkGridProps) {
  const visibleHomeworks = useMemo(() => {
    if (typeFilter === "all") {
      return homeworks;
    }
    return homeworks.filter((homework) => homework.type === typeFilter);
  }, [homeworks, typeFilter]);

  const typeGroups = useMemo(
    () => groupHomeworksByType(visibleHomeworks),
    [visibleHomeworks],
  );

  const homeworkIndex = useMemo(() => {
    const map = new Map<number, number>();
    homeworks.forEach((homework, index) => {
      map.set(homework.id, index);
    });
    return map;
  }, [homeworks]);

  if (visibleHomeworks.length === 0) {
    return (
      <div className={gridStyles.emptyReport}>
        <p>Нет заданий для выбранного фильтра.</p>
      </div>
    );
  }

  return (
    <div className={gridStyles.gridWrap}>
      <table className={gridStyles.table}>
        <thead>
          <tr className={gridStyles.typeRow}>
            <th className={`${gridStyles.stickyCol} ${gridStyles.colFio}`} rowSpan={2}>
              <span className={`${gridStyles.pinHeader} ${gridStyles.pinHeaderLeft}`}>
                ФИО
              </span>
            </th>
            <th className={`${gridStyles.stickyCol2} ${gridStyles.colClass}`} rowSpan={2}>
              <span className={gridStyles.pinHeader}>Кл.</span>
            </th>
            <th className={`${gridStyles.stickyCol3} ${gridStyles.colGroup}`} rowSpan={2}>
              <span className={`${gridStyles.pinHeader} ${gridStyles.pinHeaderLeft}`}>
                Группа
              </span>
            </th>
            {typeGroups.map((group) => (
              <th
                key={`${group.type}-${group.items[0]?.id}`}
                colSpan={group.items.length}
                className={
                  homeworkTypeClass(group.type) === "ov"
                    ? gridStyles.typeOv
                    : homeworkTypeClass(group.type) === "dznv"
                      ? gridStyles.typeDznv
                      : gridStyles.typeOther
                }
              >
                {group.type}
              </th>
            ))}
          </tr>
          <tr>
            {visibleHomeworks.map((homework) => {
              const index = homeworkIndex.get(homework.id) ?? 0;
              const type = homeworkTypeClass(homework.type);
              return (
                <th
                  key={homework.id}
                  className={gridStyles.colHomework}
                  title={`${homework.name}${homework.deadline ? ` · ${homework.deadline}` : ""}`}
                >
                  <div
                    className={`${gridStyles.hwHeader} ${
                      headerMode === "full"
                        ? gridStyles.hwHeaderFull
                        : gridStyles.hwHeaderShort
                    }`}
                  >
                    <span
                      className={`${gridStyles.hwHeaderType} ${
                        type === "ov"
                          ? gridStyles.hwHeaderTypeOv
                          : type === "dznv"
                            ? gridStyles.hwHeaderTypeDznv
                            : ""
                      }`}
                    >
                      {homework.type}
                    </span>
                    <span className={gridStyles.hwHeaderLabel}>
                      {homeworkColumnLabel(homework, index, headerMode)}
                    </span>
                    <span className={gridStyles.hwHeaderDate}>
                      {formatHomeworkDeadline(homework.deadline)}
                    </span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const resultMap = new Map(
              student.results.map((result) => [result.homework_id, result]),
            );
            return (
              <tr key={student.id}>
                <td className={`${gridStyles.stickyCol} ${gridStyles.colFio}`}>
                  <span className={gridStyles.fioCell} title={student.full_name}>
                    {student.full_name}
                  </span>
                </td>
                <td className={`${gridStyles.stickyCol2} ${gridStyles.colClass}`}>
                  <span className={gridStyles.metaCell}>{student.class}</span>
                </td>
                <td className={`${gridStyles.stickyCol3} ${gridStyles.colGroup}`}>
                  <span
                    className={gridStyles.groupCell}
                    title={student.group_name ?? undefined}
                  >
                    {student.group_name ?? "—"}
                  </span>
                </td>
                {visibleHomeworks.map((homework) => {
                  const cell = getHomeworkCellView(resultMap.get(homework.id));
                  return (
                    <td
                      key={homework.id}
                      className={gridStyles.colHomework}
                      title={cell.title}
                    >
                      <div
                        className={`${gridStyles.statusCell} ${toneClass(cell.tone)}`}
                      >
                        {cell.display}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
