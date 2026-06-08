"use client";

import { CameraScanModal } from "@/components/admin/scan/camera-scan-modal";
import styles from "@/components/admin/scan/admin-scan.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import type { AttendanceSetAction } from "@/lib/attendance/attendance-api";
import {
  fetchClassDay,
  fetchClassDayAttendance,
  fetchClassDays,
  fetchStudentBrief,
  markInPersonAttendance,
} from "@/lib/attendance/attendance-api";
import type { ClassDay, ScanHistoryItem } from "@/lib/attendance/attendance-types";
import {
  formatClassDayLabel,
  formatClassDayLong,
  getMonthRange,
  MONTH_NAMES,
  normalizeScannedStudentId,
  todayIsoDate,
  yearOptions,
} from "@/lib/attendance/attendance-utils";
import {
  clearScanHistory,
  getScanHistoryItemKey,
  loadScanHistory,
  loadSelectedScanDayId,
  parseClassDayPeriod,
  saveSelectedScanDayId,
  upsertScanHistory,
} from "@/lib/attendance/scan-history";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ToastTone = "success" | "warning" | "error";

function scanResultToast(action?: AttendanceSetAction): {
  message: string;
  tone: ToastTone;
} {
  if (action === "unchanged") {
    return { message: "⚠ Уже отмечен в этот день", tone: "warning" };
  }
  if (action === "updated") {
    return { message: "✓ Запись обновлена", tone: "success" };
  }
  return { message: "✓ Отмечен", tone: "success" };
}

function resolveScanAction(
  apiAction: AttendanceSetAction | undefined,
  alreadyMarked: boolean,
): AttendanceSetAction {
  if (apiAction === "created" || apiAction === "updated" || apiAction === "unchanged") {
    return apiAction;
  }
  return alreadyMarked ? "unchanged" : "created";
}

export function AdminScanSection() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [classDays, setClassDays] = useState<ClassDay[]>([]);
  const [daysLoading, setDaysLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<ClassDay | null>(null);

  const [studentId, setStudentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: ToastTone;
  } | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const periodSyncRef = useRef(false);
  const markedStudentIdsRef = useRef<Set<number>>(new Set());
  const toastTimerRef = useRef<number | null>(null);

  const { dateFrom, dateTo } = useMemo(
    () => getMonthRange(year, month),
    [year, month],
  );

  const todayDay = useMemo(
    () => classDays.find((day) => day.date === todayIsoDate()) ?? null,
    [classDays],
  );

  const loadDays = useCallback(async () => {
    setDaysLoading(true);
    try {
      const savedId = loadSelectedScanDayId();
      if (savedId && !periodSyncRef.current) {
        const savedDayPreview = await fetchClassDay(savedId);
        if (savedDayPreview?.date) {
          const period = parseClassDayPeriod(savedDayPreview.date);
          if (
            period &&
            (period.year !== year ||
              period.month !== month ||
              savedDayPreview.date < dateFrom ||
              savedDayPreview.date > dateTo)
          ) {
            periodSyncRef.current = true;
            setYear(period.year);
            setMonth(period.month);
            return;
          }
        }
      }

      periodSyncRef.current = false;

      let days = await fetchClassDays(dateFrom, dateTo);
      let savedDay = savedId
        ? days.find((day) => day.id === savedId) ?? null
        : null;

      if (savedId && !savedDay) {
        const fetchedDay = await fetchClassDay(savedId);
        if (fetchedDay) {
          savedDay = fetchedDay;
          if (!days.some((day) => day.id === fetchedDay.id)) {
            days = [...days, fetchedDay].sort((left, right) =>
              left.date.localeCompare(right.date),
            );
          }
        }
      }

      const autoDay =
        savedDay ?? days.find((day) => day.date === todayIsoDate()) ?? null;

      setClassDays(days);

      if (autoDay) {
        setSelectedDay(autoDay);
        saveSelectedScanDayId(autoDay.id);
      } else {
        setSelectedDay(null);
        saveSelectedScanDayId(null);
      }
    } catch {
      setClassDays([]);
      setSelectedDay(null);
    } finally {
      setDaysLoading(false);
    }
  }, [dateFrom, dateTo, month, year]);

  useEffect(() => {
    setScanHistory(loadScanHistory());
  }, []);

  useEffect(() => {
    if (!selectedDay) {
      markedStudentIdsRef.current = new Set();
      return;
    }

    let cancelled = false;
    void fetchClassDayAttendance(selectedDay.id).then((items) => {
      if (cancelled) return;
      markedStudentIdsRef.current = new Set(items.map((item) => item.student_id));
    });

    return () => {
      cancelled = true;
    };
  }, [selectedDay]);

  const showToast = useCallback((nextToast: { message: string; tone: ToastTone }) => {
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast(nextToast);
    toastTimerRef.current = window.setTimeout(
      () => {
        setToast(null);
        toastTimerRef.current = null;
      },
      nextToast.tone === "warning" ? 4200 : nextToast.tone === "error" ? 5000 : 2200,
    );
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current != null) {
        window.clearTimeout(toastTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    void loadDays();
  }, [loadDays]);

  useEffect(() => {
    function handleScanDayChanged() {
      periodSyncRef.current = false;
      void loadDays();
    }

    window.addEventListener("cpm-scan-day-changed", handleScanDayChanged);
    return () =>
      window.removeEventListener("cpm-scan-day-changed", handleScanDayChanged);
  }, [loadDays]);

  useEffect(() => {
    if (!selectedDay || submitting) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [selectedDay, submitting]);

  const pushHistory = useCallback(
    async (rawStudentId: string, classDayId: number) => {
      const brief = await fetchStudentBrief(rawStudentId);
      if (!brief) return;
      setScanHistory(
        upsertScanHistory({
          id: brief.id,
          name: brief.name,
          class: brief.class,
          studentId: String(brief.id),
          classDayId,
          date: new Date().toLocaleString("ru-RU"),
          scanAt: Date.now(),
        }),
      );
    },
    [],
  );

  const handleScanResult = useCallback(
    (
      normalized: string,
      classDayId: number,
      action: AttendanceSetAction,
      studentNumericId: number,
    ) => {
      const nextToast = scanResultToast(action);
      showToast(nextToast);
      setStudentId("");

      if (action === "created") {
        markedStudentIdsRef.current.add(studentNumericId);
        void pushHistory(normalized, classDayId);
      } else if (action === "updated") {
        markedStudentIdsRef.current.add(studentNumericId);
        void pushHistory(normalized, classDayId);
      }

      window.setTimeout(() => inputRef.current?.focus(), 50);
    },
    [pushHistory, showToast],
  );

  const submitStudentId = useCallback(
    async (rawValue?: string) => {
      const normalized = normalizeScannedStudentId(rawValue ?? studentId);
      if (!normalized || !selectedDay || submitting) return;

      const studentNumericId = Number(normalized);
      if (!Number.isFinite(studentNumericId)) {
        showToast({ message: "Некорректный ID ученика", tone: "error" });
        return;
      }

      const alreadyMarked = markedStudentIdsRef.current.has(studentNumericId);

      setSubmitting(true);
      try {
        const result = await markInPersonAttendance(selectedDay.id, normalized);
        if (result.status) {
          const action = resolveScanAction(result.action, alreadyMarked);
          handleScanResult(normalized, selectedDay.id, action, studentNumericId);
        } else {
          showToast({
            message: result.error ?? "Не удалось отметить",
            tone: "error",
          });
        }
      } catch (err) {
        showToast({
          message: err instanceof Error ? err.message : "Ошибка сети",
          tone: "error",
        });
      } finally {
        setSubmitting(false);
      }
    },
    [handleScanResult, selectedDay, showToast, studentId, submitting],
  );

  const chooseDay = (day: ClassDay) => {
    setSelectedDay(day);
    saveSelectedScanDayId(day.id);
    setStudentId("");
    setToast(null);
  };

  const clearDay = () => {
    setSelectedDay(null);
    saveSelectedScanDayId(null);
    setStudentId("");
  };

  const toastClassName =
    toast?.tone === "warning"
      ? `${styles.toast} ${styles.toastWarning}`
      : toast?.tone === "error"
        ? `${styles.toast} ${styles.toastError}`
        : `${styles.toast} ${styles.toastSuccess}`;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Сканирование</h1>
        <p className={styles.subtitle}>
          Выберите день один раз — дальше только ввод ID или скан QR. Повторный
          скан того же ученика не создаёт дубликат в списке посещаемости.
        </p>
      </header>

      <div className={styles.periodBar}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="scan-year">
            Год
          </label>
          <select
            id="scan-year"
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
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="scan-month">
            Месяц
          </label>
          <select
            id="scan-month"
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
        <button
          type="button"
          className={styles.todayBtn}
          disabled={!todayDay || daysLoading}
          onClick={() => todayDay && chooseDay(todayDay)}
        >
          Сегодня
        </button>
      </div>

      {daysLoading ? (
        <LoadingState label="Загрузка дней…" variant="panel" />
      ) : selectedDay ? (
        <section className={styles.scanPanel}>
          <p className={styles.selectedDay}>
            Активный день
            <strong>{formatClassDayLong(selectedDay)}</strong>
          </p>
          <button type="button" className={styles.changeDayBtn} onClick={clearDay}>
            ← Выбрать другой день
          </button>

          <input
            ref={inputRef}
            className={styles.scanInput}
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitStudentId();
              }
            }}
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="ID ученика"
            disabled={submitting}
            aria-label="ID ученика"
          />
          <p className={styles.scanHint}>
            Сканер штрих-кода или QR: после считывания нажмите Enter. С
            телефона можно открыть камеру ниже.
          </p>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={submitting || !studentId.trim()}
              onClick={() => void submitStudentId()}
            >
              {submitting ? "Отправка…" : "Отметить (Enter)"}
            </button>
            <button
              type="button"
              className={styles.cameraBtn}
              disabled={submitting}
              onClick={() => setCameraOpen(true)}
            >
              Камера
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={submitting}
              onClick={() => {
                setStudentId("");
                inputRef.current?.focus();
              }}
            >
              Очистить
            </button>
          </div>

          {toast ? (
            <div
              className={toastClassName}
              role="status"
              aria-live="polite"
            >
              {toast.message}
            </div>
          ) : null}
        </section>
      ) : classDays.length === 0 ? (
        <div className={styles.empty}>
          В этом месяце нет дней занятий. Создайте день в разделе «Посещаемость».
        </div>
      ) : (
        <div className={styles.daysList}>
          {classDays.map((day) => (
            <button
              key={day.id}
              type="button"
              className={`${styles.dayBtn} ${
                day.date === todayIsoDate() ? styles.dayBtnToday : ""
              }`}
              onClick={() => chooseDay(day)}
            >
              {formatClassDayLabel(day)}
            </button>
          ))}
        </div>
      )}

      <section className={styles.history}>
        <div className={styles.historyHead}>
          <h2 className={styles.historyTitle}>Последние отметки</h2>
          {scanHistory.length > 0 ? (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                clearScanHistory();
                setScanHistory([]);
              }}
            >
              Очистить
            </button>
          ) : null}
        </div>
        {scanHistory.length === 0 ? (
          <div className={styles.empty}>История пуста</div>
        ) : (
          <ul className={styles.historyList}>
            {scanHistory.map((item) => (
              <li key={getScanHistoryItemKey(item)} className={styles.historyItem}>
                <div className={styles.historyTop}>
                  <span className={styles.historyName}>{item.name}</span>
                  <span className={styles.historyClass}>{item.class} класс</span>
                </div>
                <div className={styles.historyMeta}>
                  <span>ID {item.studentId}</span>
                  <span>{item.date}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CameraScanModal
        open={cameraOpen}
        classDayId={selectedDay?.id ?? null}
        onClose={() => setCameraOpen(false)}
        onSuccess={(sid, action) => {
          if (!selectedDay) return;
          const studentNumericId = Number(normalizeScannedStudentId(sid));
          if (!Number.isFinite(studentNumericId)) return;
          const alreadyMarked = markedStudentIdsRef.current.has(studentNumericId);
          const resolvedAction = resolveScanAction(action, alreadyMarked);
          handleScanResult(
            normalizeScannedStudentId(sid),
            selectedDay.id,
            resolvedAction,
            studentNumericId,
          );
        }}
      />
    </div>
  );
}
