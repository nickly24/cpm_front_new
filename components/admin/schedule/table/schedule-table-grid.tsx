"use client";

import { ReadOnlyControl, EditOnly } from "@/components/admin/admin-section-access";

import styles from "@/components/admin/schedule/table/schedule-table.module.css";
import { SCHEDULE_PRESET_COLORS } from "@/lib/schedule/constants";
import {
  emptyTableRow,
  formatDayBandLabel,
  isRowBlank,
  isRowFilledEnough,
  type ScheduleTableRow,
} from "@/lib/schedule/schedule-table-utils";
import { Plus, Trash2 } from "lucide-react";

interface ScheduleTableGridProps {
  weekDates: string[];
  rows: ScheduleTableRow[];
  onChange: (rows: ScheduleTableRow[]) => void;
}

type RowField = keyof Pick<
  ScheduleTableRow,
  | "start_time"
  | "end_time"
  | "lesson_name"
  | "teacher_name"
  | "location"
  | "classroom"
  | "color"
  | "is_changed"
  | "is_in_person"
  | "is_for_all"
>;

export function ScheduleTableGrid({
  weekDates,
  rows,
  onChange,
}: ScheduleTableGridProps) {
  const updateRow = (key: string, patch: Partial<ScheduleTableRow>) => {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const removeRow = (key: string) => {
    onChange(rows.filter((row) => row.key !== key));
  };

  const addRow = (date: string) => {
    onChange([...rows, emptyTableRow(date)]);
  };

  const setField = (key: string, field: RowField, value: string | boolean) => {
    updateRow(key, { [field]: value } as Partial<ScheduleTableRow>);
  };

  return (
    <div className={styles.gridWrap}>
      {weekDates.map((date) => {
        const dayRows = rows.filter((row) => row.date === date);
        return (
          <div key={date}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.dayBand} colSpan={11}>
                    {formatDayBandLabel(date)}
                  </th>
                </tr>
                <tr>
                  <th className={`${styles.colHead} ${styles.colHeadNarrow}`}>
                    Начало
                  </th>
                  <th className={`${styles.colHead} ${styles.colHeadNarrow}`}>
                    Конец
                  </th>
                  <th className={styles.colHead}>Предмет</th>
                  <th className={styles.colHead}>Преподаватель</th>
                  <th className={styles.colHead}>Локация</th>
                  <th className={styles.colHead}>Аудитория</th>
                  <th className={`${styles.colHead} ${styles.colHeadNarrow}`}>
                    Цвет
                  </th>
                  <th className={`${styles.colHead} ${styles.colHeadNarrow}`}>
                    Очно
                  </th>
                  <th className={`${styles.colHead} ${styles.colHeadNarrow}`}>
                    Все
                  </th>
                  <th className={`${styles.colHead} ${styles.colHeadNarrow}`}>
                    Изм.
                  </th>
                  <th
                    className={`${styles.colHead} ${styles.colHeadAction}`}
                    aria-label="Удалить"
                  />
                </tr>
              </thead>
              <tbody>
                {dayRows.map((row) => {
                  const incomplete =
                    !isRowBlank(row) && !isRowFilledEnough(row);
                  return (
                    <tr
                      key={row.key}
                      className={`${styles.row} ${incomplete ? styles.rowIncomplete : ""}`}
                    >
                      <td>
                        <ReadOnlyControl><input
                          type="time"
                          className={`${styles.cellInput} ${styles.cellTime}`}
                          value={row.start_time}
                          onChange={(e) =>
                            setField(row.key, "start_time", e.target.value)
                          }
                        /></ReadOnlyControl>
                      </td>
                      <td>
                        <ReadOnlyControl><input
                          type="time"
                          className={`${styles.cellInput} ${styles.cellTime}`}
                          value={row.end_time}
                          onChange={(e) =>
                            setField(row.key, "end_time", e.target.value)
                          }
                        /></ReadOnlyControl>
                      </td>
                      <td>
                        <ReadOnlyControl><input
                          className={styles.cellInput}
                          value={row.lesson_name}
                          onChange={(e) =>
                            setField(row.key, "lesson_name", e.target.value)
                          }
                          placeholder="Предмет"
                        /></ReadOnlyControl>
                      </td>
                      <td>
                        <ReadOnlyControl><input
                          className={styles.cellInput}
                          value={row.teacher_name}
                          onChange={(e) =>
                            setField(row.key, "teacher_name", e.target.value)
                          }
                          placeholder="ФИО"
                        /></ReadOnlyControl>
                      </td>
                      <td>
                        <ReadOnlyControl><input
                          className={styles.cellInput}
                          value={row.location}
                          onChange={(e) =>
                            setField(row.key, "location", e.target.value)
                          }
                          placeholder="Вуз"
                        /></ReadOnlyControl>
                      </td>
                      <td>
                        <ReadOnlyControl><input
                          className={styles.cellInput}
                          value={row.classroom}
                          onChange={(e) =>
                            setField(row.key, "classroom", e.target.value)
                          }
                          placeholder="301А"
                        /></ReadOnlyControl>
                      </td>
                      <td>
                        <div className={styles.colorCell}>
                          <ReadOnlyControl><select
                            className={styles.cellSelect}
                            value={
                              (SCHEDULE_PRESET_COLORS as readonly string[]).includes(
                                row.color.toUpperCase(),
                              )
                                ? row.color.toUpperCase()
                                : "__custom__"
                            }
                            onChange={(e) => {
                              if (e.target.value === "__custom__") return;
                              setField(row.key, "color", e.target.value);
                            }}
                            aria-label="Цвет"
                          >
                            {SCHEDULE_PRESET_COLORS.map((color) => (
                              <option key={color} value={color}>
                                {color}
                              </option>
                            ))}
                            <option value="__custom__">Свой…</option>
                          </select></ReadOnlyControl>
                          <ReadOnlyControl><input
                            type="color"
                            className={styles.colorNative}
                            value={
                              /^#[0-9A-Fa-f]{6}$/.test(row.color)
                                ? row.color
                                : "#5B8DEF"
                            }
                            onChange={(e) =>
                              setField(
                                row.key,
                                "color",
                                e.target.value.toUpperCase(),
                              )
                            }
                            aria-label="Свой цвет"
                          /></ReadOnlyControl>
                        </div>
                      </td>
                      <td>
                        <div className={styles.cellCheck}>
                          <ReadOnlyControl><input
                            type="checkbox"
                            checked={row.is_in_person !== false}
                            onChange={(e) =>
                              setField(row.key, "is_in_person", e.target.checked)
                            }
                            aria-label="Очно"
                            title="Очно (выкл. = дистанционно)"
                          /></ReadOnlyControl>
                        </div>
                      </td>
                      <td>
                        <div className={styles.cellCheck}>
                          <ReadOnlyControl><input
                            type="checkbox"
                            checked={row.is_for_all !== false}
                            onChange={(e) =>
                              setField(row.key, "is_for_all", e.target.checked)
                            }
                            aria-label="Для всех"
                            title="Все (выкл. = частично)"
                          /></ReadOnlyControl>
                        </div>
                      </td>
                      <td>
                        <div className={styles.cellCheck}>
                          <ReadOnlyControl><input
                            type="checkbox"
                            checked={row.is_changed}
                            onChange={(e) =>
                              setField(row.key, "is_changed", e.target.checked)
                            }
                            aria-label="Расписание изменено"
                          /></ReadOnlyControl>
                        </div>
                      </td>
                      <td>
                        <div className={styles.rowAction}>
                          <EditOnly><button
                            type="button"
                            className={styles.deleteBtn}
                            aria-label="Удалить строку"
                            title="Удалить"
                            onClick={() => removeRow(row.key)}
                          >
                            <Trash2 size={14} strokeWidth={2.25} />
                          </button></EditOnly>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className={styles.addRowWrap}>
              <EditOnly><button
                type="button"
                className={styles.addRowBtn}
                onClick={() => addRow(date)}
              >
                <Plus size={14} strokeWidth={2.4} />
                Строка
              </button></EditOnly>
            </div>
          </div>
        );
      })}
    </div>
  );
}
