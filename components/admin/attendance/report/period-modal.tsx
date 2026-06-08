"use client";

import attendanceStyles from "@/components/admin/attendance/admin-attendance.module.css";
import reportStyles from "@/components/admin/attendance/report/report.module.css";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { OptionSelect } from "@/components/ui/option-select";
import {
  getMonthRange,
  MONTH_NAMES,
  todayIsoDate,
  yearOptions,
} from "@/lib/attendance/attendance-utils";
import { Calendar, CalendarRange, CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";

export type PeriodMode = "current_month" | "year_month" | "date_range";

export interface ReportPeriodSelection {
  dateFrom: string;
  dateTo: string;
}

interface PeriodModalProps {
  onClose: () => void;
  onCreate: (period: ReportPeriodSelection) => void;
}

const MODE_OPTIONS: {
  id: PeriodMode;
  label: string;
  icon: typeof Calendar;
}[] = [
  { id: "current_month", label: "Текущий месяц", icon: Calendar },
  { id: "year_month", label: "Выбрать год и месяц", icon: CalendarDays },
  { id: "date_range", label: "Диапазон дат", icon: CalendarRange },
];

export function PeriodModal({ onClose, onCreate }: PeriodModalProps) {
  const now = new Date();
  const [mode, setMode] = useState<PeriodMode>("current_month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dateFrom, setDateFrom] = useState(todayIsoDate());
  const [dateTo, setDateTo] = useState(todayIsoDate());
  const [error, setError] = useState<string | null>(null);

  const yearSelectOptions = useMemo(
    () =>
      yearOptions().map((value) => ({
        value,
        label: String(value),
        icon: Calendar,
      })),
    [],
  );

  const monthSelectOptions = useMemo(
    () =>
      MONTH_NAMES.map((name, index) => ({
        value: index + 1,
        label: name,
        icon: CalendarDays,
      })),
    [],
  );

  const resolvePeriod = (): ReportPeriodSelection | null => {
    if (mode === "current_month") {
      const current = getMonthRange(now.getFullYear(), now.getMonth() + 1);
      return { dateFrom: current.dateFrom, dateTo: current.dateTo };
    }
    if (mode === "year_month") {
      const range = getMonthRange(year, month);
      return { dateFrom: range.dateFrom, dateTo: range.dateTo };
    }
    if (!dateFrom || !dateTo) {
      setError("Укажите обе даты");
      return null;
    }
    if (dateFrom > dateTo) {
      setError("Дата «с» не может быть позже даты «по»");
      return null;
    }
    return { dateFrom, dateTo };
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const period = resolvePeriod();
    if (!period) return;
    onCreate(period);
  };

  return (
    <div className={attendanceStyles.modalOverlay} onClick={onClose}>
      <form
        className={attendanceStyles.modal}
        style={{ maxWidth: 480 }}
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 className={attendanceStyles.modalTitle}>Журнал посещаемости</h3>
        <p className={attendanceStyles.pageSubtitle}>
          Выберите период для отчёта.
        </p>

        <div className={reportStyles.periodModes}>
          {MODE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={`${reportStyles.periodModeBtn} ${active ? reportStyles.periodModeBtnActive : ""}`}
                onClick={() => {
                  setMode(option.id);
                  setError(null);
                }}
              >
                <Icon size={18} aria-hidden />
                {option.label}
              </button>
            );
          })}
        </div>

        {mode === "year_month" ? (
          <div className={reportStyles.periodFields}>
            <OptionSelect
              label="Год"
              value={year}
              options={yearSelectOptions}
              onChange={setYear}
              className={reportStyles.filterSelect}
            />
            <OptionSelect
              label="Месяц"
              value={month}
              options={monthSelectOptions}
              onChange={setMonth}
              className={reportStyles.filterSelect}
            />
          </div>
        ) : null}

        {mode === "date_range" ? (
          <div className={reportStyles.periodFields}>
            <div className={reportStyles.periodField}>
              <label className={attendanceStyles.fieldLabel} htmlFor="rep-from">
                С
              </label>
              <input
                id="rep-from"
                type="date"
                className={reportStyles.periodDateInput}
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>
            <div className={reportStyles.periodField}>
              <label className={attendanceStyles.fieldLabel} htmlFor="rep-to">
                По
              </label>
              <input
                id="rep-to"
                type="date"
                className={reportStyles.periodDateInput}
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>
          </div>
        ) : null}

        {error ? <p className={styles.errorText}>{error}</p> : null}

        <div className={attendanceStyles.modalActions}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit">Создать</Button>
        </div>
      </form>
    </div>
  );
}
