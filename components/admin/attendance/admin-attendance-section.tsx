"use client";

import { AdminFullscreenBack } from "@/components/admin/admin-fullscreen-back";
import { ClassDayFormModal } from "@/components/admin/attendance/class-day-form-modal";
import { EditAttendanceModal } from "@/components/admin/attendance/edit-attendance-modal";
import {
  PeriodModal,
  type ReportPeriodSelection,
} from "@/components/admin/attendance/report/period-modal";
import { ReportWorkspace } from "@/components/admin/attendance/report/report-workspace";
import attendanceStyles from "@/components/admin/attendance/admin-attendance.module.css";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { OptionSelect } from "@/components/ui/option-select";
import { useCabinetChrome } from "@/contexts/cabinet-chrome-context";
import {
  deleteClassDay,
  deleteClassDayAttendance,
  fetchAttendanceTypes,
  fetchClassDayAttendance,
  fetchClassDays,
  setClassDayAttendance,
} from "@/lib/attendance/attendance-api";
import { buildAttendanceTypeOptions } from "@/lib/attendance/attendance-type-options";
import type {
  AttendanceType,
  ClassDay,
  ClassDayAttendanceItem,
} from "@/lib/attendance/attendance-types";
import {
  formatClassDayLong,
  getMonthRange,
  MONTH_NAMES,
  yearOptions,
} from "@/lib/attendance/attendance-utils";
import { syncScanDaySelection } from "@/lib/attendance/scan-history";
import { TableProperties } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type DayFormMode = "create" | "edit" | null;

export function AdminAttendanceSection() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [classDays, setClassDays] = useState<ClassDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<AttendanceType[]>([]);
  const [dayFormMode, setDayFormMode] = useState<DayFormMode>(null);
  const [editingDay, setEditingDay] = useState<ClassDay | null>(null);

  const [selectedDay, setSelectedDay] = useState<ClassDay | null>(null);
  const [attendance, setAttendance] = useState<ClassDayAttendanceItem[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [addStudentId, setAddStudentId] = useState("");
  const [addTypeId, setAddTypeId] = useState(1);
  const [adding, setAdding] = useState(false);
  const [deletingDay, setDeletingDay] = useState(false);
  const [deletingAttendanceId, setDeletingAttendanceId] = useState<number | null>(
    null,
  );
  const [editingAttendance, setEditingAttendance] =
    useState<ClassDayAttendanceItem | null>(null);
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriodSelection | null>(
    null,
  );
  const { setImmersive } = useCabinetChrome();

  useEffect(() => {
    setImmersive(Boolean(reportPeriod));
    return () => setImmersive(false);
  }, [reportPeriod, setImmersive]);

  const { dateFrom, dateTo } = useMemo(
    () => getMonthRange(year, month),
    [year, month],
  );

  const loadDays = useCallback(async () => {
    setLoading(true);
    try {
      setClassDays(await fetchClassDays(dateFrom, dateTo));
    } catch {
      setClassDays([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  const loadAttendance = useCallback(async (classDayId: number) => {
    setAttendanceLoading(true);
    try {
      setAttendance(await fetchClassDayAttendance(classDayId));
    } catch {
      setAttendance([]);
    } finally {
      setAttendanceLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDays();
  }, [loadDays]);

  useEffect(() => {
    void fetchAttendanceTypes().then(setTypes);
  }, []);

  useEffect(() => {
    if (selectedDay) {
      void loadAttendance(selectedDay.id);
    } else {
      setAttendance([]);
    }
  }, [loadAttendance, selectedDay]);

  const typeOptions = useMemo(() => buildAttendanceTypeOptions(types), [types]);

  const openDay = (day: ClassDay) => {
    setSelectedDay(day);
    syncScanDaySelection(day.id);
  };

  const refreshSelectedDay = async (dayId: number) => {
    await loadDays();
    const days = await fetchClassDays(dateFrom, dateTo);
    const nextDay = days.find((day) => day.id === dayId) ?? null;
    if (nextDay) {
      setSelectedDay(nextDay);
      syncScanDaySelection(nextDay.id);
    }
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedDay || !addStudentId.trim()) return;
    setAdding(true);
    try {
      const result = await setClassDayAttendance(selectedDay.id, {
        student_id: Number(addStudentId.trim()),
        attendance_type_id: addTypeId,
      });
      if (result.status) {
        setAddStudentId("");
        void loadAttendance(selectedDay.id);
      } else {
        window.alert(result.error ?? "Ошибка добавления");
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteDay = async () => {
    if (!selectedDay) return;
    const confirmed = window.confirm(
      `Удалить день «${formatClassDayLong(selectedDay)}» и все отметки (${attendance.length})?`,
    );
    if (!confirmed) return;

    setDeletingDay(true);
    try {
      const result = await deleteClassDay(selectedDay.id);
      if (result.status) {
        setSelectedDay(null);
        await loadDays();
      } else {
        window.alert(result.error ?? "Не удалось удалить день");
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setDeletingDay(false);
    }
  };

  const handleDeleteAttendance = async (item: ClassDayAttendanceItem) => {
    if (!selectedDay) return;
    const confirmed = window.confirm(
      `Удалить отметку ${item.full_name} (ID ${item.student_id})?`,
    );
    if (!confirmed) return;

    setDeletingAttendanceId(item.id);
    try {
      const result = await deleteClassDayAttendance(selectedDay.id, item.id);
      if (result.status) {
        void loadAttendance(selectedDay.id);
      } else {
        window.alert(result.error ?? "Не удалось удалить отметку");
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setDeletingAttendanceId(null);
    }
  };

  const handleDeleteDayFromList = async (
    event: React.MouseEvent,
    day: ClassDay,
  ) => {
    event.stopPropagation();
    const confirmed = window.confirm(
      `Удалить день «${formatClassDayLong(day)}» и все отметки в нём?`,
    );
    if (!confirmed) return;

    try {
      const result = await deleteClassDay(day.id);
      if (result.status) {
        if (selectedDay?.id === day.id) {
          setSelectedDay(null);
        }
        await loadDays();
      } else {
        window.alert(result.error ?? "Не удалось удалить день");
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  const openEditDayFromList = (event: React.MouseEvent, day: ClassDay) => {
    event.stopPropagation();
    setEditingDay(day);
    setDayFormMode("edit");
  };

  if (reportPeriod) {
    return (
      <ReportWorkspace
        period={reportPeriod}
        onBack={() => setReportPeriod(null)}
      />
    );
  }

  if (selectedDay) {
    return (
      <div className={styles.page}>
        <AdminFullscreenBack
          onBack={() => setSelectedDay(null)}
          label="К списку дней"
        />

        <header className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>{formatClassDayLong(selectedDay)}</h1>
            <p className={attendanceStyles.pageSubtitle}>
              {attendance.length} отметок
            </p>
          </div>
          <div className={attendanceStyles.headerActions}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditingDay(selectedDay);
                setDayFormMode("edit");
              }}
            >
              Редактировать день
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={attendanceStyles.dangerBtn}
              disabled={deletingDay}
              onClick={() => void handleDeleteDay()}
            >
              {deletingDay ? "Удаление…" : "Удалить день"}
            </Button>
          </div>
        </header>

        <div className={styles.detailCard}>
          <h3 className={styles.detailSectionTitle}>Добавить посещение</h3>
          <form className={attendanceStyles.addBlock} onSubmit={(e) => void handleAdd(e)}>
            <div className={attendanceStyles.field}>
              <label className={attendanceStyles.fieldLabel} htmlFor="add-student-id">
                ID ученика
              </label>
              <input
                id="add-student-id"
                className={attendanceStyles.addInput}
                type="number"
                value={addStudentId}
                onChange={(event) => setAddStudentId(event.target.value)}
                placeholder="123"
              />
            </div>
            <OptionSelect
              label="Тип посещения"
              value={addTypeId}
              options={typeOptions}
              onChange={setAddTypeId}
              disabled={adding || typeOptions.length === 0}
              className={attendanceStyles.typeField}
              dropdownClassName={attendanceStyles.typeDropdown}
            />
            <Button type="submit" disabled={adding}>
              {adding ? "…" : "Добавить"}
            </Button>
          </form>

          <h3 className={styles.detailSectionTitle}>Список</h3>
          {attendanceLoading ? (
            <LoadingState label="Загрузка…" variant="compact" />
          ) : attendance.length === 0 ? (
            <div className={attendanceStyles.emptyState}>
              В этот день пока никого нет.
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Ученик</th>
                    <th>Тип</th>
                    <th aria-label="Действия" />
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.full_name}{" "}
                        <span className={attendanceStyles.studentIdMuted}>
                          (ID {item.student_id})
                        </span>
                      </td>
                      <td>{item.type_name}</td>
                      <td>
                        <div className={attendanceStyles.rowActions}>
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => setEditingAttendance(item)}
                          >
                            Изменить
                          </button>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                            disabled={deletingAttendanceId === item.id}
                            onClick={() => void handleDeleteAttendance(item)}
                          >
                            {deletingAttendanceId === item.id ? "…" : "Удалить"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {dayFormMode === "edit" && editingDay ? (
          <ClassDayFormModal
            mode="edit"
            editingDay={editingDay}
            onClose={() => {
              setDayFormMode(null);
              setEditingDay(null);
            }}
            onSaved={async (id) => {
              await refreshSelectedDay(id);
            }}
          />
        ) : null}

        {editingAttendance ? (
          <EditAttendanceModal
            classDayId={selectedDay.id}
            item={editingAttendance}
            types={types}
            onClose={() => setEditingAttendance(null)}
            onSaved={async () => {
              await loadAttendance(selectedDay.id);
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Посещаемость</h1>
          <p className={attendanceStyles.pageSubtitle}>
            Дни занятий и ручная отметка учеников.
          </p>
        </div>
        <div className={attendanceStyles.headerActions}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setPeriodModalOpen(true)}
          >
            <TableProperties size={16} style={{ marginRight: 6 }} />
            Отчёт
          </Button>
          <Button type="button" onClick={() => setDayFormMode("create")}>
            + День занятий
          </Button>
        </div>
      </header>

      {periodModalOpen ? (
        <PeriodModal
          onClose={() => setPeriodModalOpen(false)}
          onCreate={(period) => {
            setPeriodModalOpen(false);
            setReportPeriod(period);
          }}
        />
      ) : null}

      <div className={styles.filters}>
        <div className={attendanceStyles.periodRow}>
          <div className={attendanceStyles.field}>
            <label className={attendanceStyles.fieldLabel} htmlFor="att-year">
              Год
            </label>
            <select
              id="att-year"
              className={styles.select}
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {yearOptions().map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className={attendanceStyles.field}>
            <label className={attendanceStyles.fieldLabel} htmlFor="att-month">
              Месяц
            </label>
            <select
              id="att-month"
              className={styles.select}
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Загрузка дней…" variant="panel" />
      ) : classDays.length === 0 ? (
        <div className={attendanceStyles.emptyState}>
          За выбранный период нет дней занятий.
        </div>
      ) : (
        <div className={attendanceStyles.daysGrid}>
          {classDays.map((day) => (
            <article key={day.id} className={attendanceStyles.dayCard}>
              <button
                type="button"
                className={attendanceStyles.dayCardMain}
                onClick={() => openDay(day)}
              >
                <h3 className={attendanceStyles.dayCardTitle}>
                  {formatClassDayLong(day)}
                </h3>
                {day.comment ? (
                  <p className={attendanceStyles.dayCardComment}>{day.comment}</p>
                ) : null}
              </button>
              <div className={attendanceStyles.dayCardActions}>
                <button
                  type="button"
                  className={attendanceStyles.cardActionBtn}
                  onClick={(event) => openEditDayFromList(event, day)}
                >
                  Изменить
                </button>
                <button
                  type="button"
                  className={`${attendanceStyles.cardActionBtn} ${attendanceStyles.cardActionBtnDanger}`}
                  onClick={(event) => void handleDeleteDayFromList(event, day)}
                >
                  Удалить
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {dayFormMode === "create" ? (
        <ClassDayFormModal
          mode="create"
          onClose={() => setDayFormMode(null)}
          onSaved={async (id) => {
            syncScanDaySelection(id);
            await loadDays();
            const days = await fetchClassDays(dateFrom, dateTo);
            const created = days.find((day) => day.id === id);
            if (created) setSelectedDay(created);
          }}
        />
      ) : null}

      {dayFormMode === "edit" && editingDay ? (
        <ClassDayFormModal
          mode="edit"
          editingDay={editingDay}
          onClose={() => {
            setDayFormMode(null);
            setEditingDay(null);
          }}
          onSaved={async () => {
            await loadDays();
          }}
        />
      ) : null}
    </div>
  );
}
