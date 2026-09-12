"use client";

import { EditOnly } from "@/components/admin/admin-section-access";

import { ReportMacClose } from "@/components/admin/attendance/report/report-mac-close";
import reportStyles from "@/components/admin/attendance/report/report.module.css";
import { ScheduleTableGrid } from "@/components/admin/schedule/table/schedule-table-grid";
import styles from "@/components/admin/schedule/table/schedule-table.module.css";
import {
  calendarLabel,
  filterLessonsByActiveCalendar,
  PUBLIC_CALENDAR_KEY,
  schoolCalendarKey,
  type ActiveCalendarKey,
} from "@/components/schedule/schedule-calendars-panel";
import { LoadingState } from "@/components/ui/loading-state";
import { useCabinetChrome } from "@/contexts/cabinet-chrome-context";
import { fetchAdminSchools } from "@/lib/admin/admin-schools-api";
import type { AdminSchool } from "@/lib/admin/admin-schools-types";
import { ApiError } from "@/lib/api/client";
import {
  bulkSaveSchedule,
  fetchSchedule,
} from "@/lib/schedule/schedule-api";
import {
  buildBulkDiff,
  buildInitialTableRows,
  formatWeekRangeLabel,
  isTableDirty,
  weekDatesFrom,
  type ScheduleTableRow,
} from "@/lib/schedule/schedule-table-utils";
import {
  addDaysISO,
  endOfWeekISO,
  startOfWeekISO,
  todayISO,
} from "@/lib/schedule/utils";
import { Check, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, School, Users } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

interface ScheduleTableWorkspaceProps {
  schools: AdminSchool[];
  initialDate: string;
  initialCalendar: ActiveCalendarKey;
  onClose: (nextCalendar?: ActiveCalendarKey) => void;
  onSaved: () => void;
}

function CalendarPicker({
  schools,
  value,
  onChange,
  disabled,
}: {
  schools: AdminSchool[];
  value: ActiveCalendarKey;
  onChange: (key: ActiveCalendarKey) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const width = Math.max(rect.width, 260);
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < 280 && rect.top > spaceBelow;
      const left = Math.min(
        Math.max(8, rect.left),
        window.innerWidth - width - 8,
      );
      setMenuStyle({
        position: "fixed",
        left,
        width,
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
        zIndex: 200,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const label = calendarLabel(value, schools);

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <ul
            ref={menuRef}
            className={styles.calendarMenu}
            style={menuStyle}
            role="listbox"
            aria-label="Календарь"
          >
            <li>
              <button
                type="button"
                role="option"
                aria-selected={value === PUBLIC_CALENDAR_KEY}
                className={`${styles.calendarMenuItem} ${value === PUBLIC_CALENDAR_KEY ? styles.calendarMenuItemActive : ""}`}
                onClick={() => {
                  onChange(PUBLIC_CALENDAR_KEY);
                  setOpen(false);
                }}
              >
                <Users size={14} />
                <span>Общие</span>
                {value === PUBLIC_CALENDAR_KEY ? <Check size={14} /> : null}
              </button>
            </li>
            {schools.length === 0 ? (
              <li className={styles.calendarMenuEmpty}>Школы не загружены</li>
            ) : (
              schools.map((school) => {
                const key = schoolCalendarKey(school.school_id);
                const selected = value === key;
                return (
                  <li key={school.school_id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`${styles.calendarMenuItem} ${selected ? styles.calendarMenuItemActive : ""}`}
                      onClick={() => {
                        onChange(key);
                        setOpen(false);
                      }}
                    >
                      <School size={14} />
                      <span>{school.short_name || school.name}</span>
                      {selected ? <Check size={14} /> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div className={styles.calendarPicker} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.calendarTrigger} ${open ? styles.calendarTriggerOpen : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.calendarTriggerText}>{label}</span>
        <ChevronDown size={15} />
      </button>
      {menu}
    </div>
  );
}

export function ScheduleTableWorkspace({
  schools: schoolsProp,
  initialDate,
  initialCalendar,
  onClose,
  onSaved,
}: ScheduleTableWorkspaceProps) {
  const { setImmersive } = useCabinetChrome();
  const [schools, setSchools] = useState<AdminSchool[]>(schoolsProp);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [activeCalendar, setActiveCalendar] =
    useState<ActiveCalendarKey>(initialCalendar);
  const [rows, setRows] = useState<ScheduleTableRow[]>([]);
  const [snapshot, setSnapshot] = useState<ScheduleTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekStart = startOfWeekISO(selectedDate);
  const weekEnd = endOfWeekISO(selectedDate);
  const weekDates = useMemo(() => weekDatesFrom(selectedDate), [selectedDate]);
  const weekLabel = formatWeekRangeLabel(weekStart, weekEnd);

  const isPublic = activeCalendar === PUBLIC_CALENDAR_KEY;
  const schoolId = isPublic
    ? null
    : Number(activeCalendar.slice("school:".length));

  const dirty = useMemo(
    () => isTableDirty(snapshot, rows),
    [snapshot, rows],
  );

  useEffect(() => {
    setImmersive(true);
    return () => setImmersive(false);
  }, [setImmersive]);

  useEffect(() => {
    if (schoolsProp.length) {
      setSchools(schoolsProp);
    }
  }, [schoolsProp]);

  useEffect(() => {
    let cancelled = false;
    void fetchAdminSchools(false)
      .then((list) => {
        if (!cancelled) setSchools(list);
      })
      .catch(() => {
        /* keep prop/empty */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadWeek = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchSchedule({
        dateFrom: weekStart,
        dateTo: weekEnd,
      });
      if (!response.status) {
        throw new Error(response.error ?? "Не удалось загрузить расписание");
      }
      const filtered = filterLessonsByActiveCalendar(
        response.schedule ?? [],
        activeCalendar,
      );
      const initial = buildInitialTableRows(filtered, weekDates, 1);
      setRows(initial);
      setSnapshot(
        initial
          .filter((row) => row.lessonId)
          .map((row) => ({ ...row })),
      );
    } catch (err) {
      setRows(buildInitialTableRows([], weekDates, 1));
      setSnapshot([]);
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Ошибка загрузки",
      );
    } finally {
      setLoading(false);
    }
  }, [activeCalendar, weekDates, weekEnd, weekStart]);

  useEffect(() => {
    void loadWeek();
  }, [loadWeek]);

  const confirmIfDirty = () => {
    if (!dirty) return true;
    return window.confirm(
      "Есть несохранённые изменения. Сбросить их и продолжить?",
    );
  };

  const handleClose = () => {
    if (!confirmIfDirty()) return;
    onClose(activeCalendar);
  };

  const handleCalendarChange = (key: ActiveCalendarKey) => {
    if (key === activeCalendar) return;
    if (!confirmIfDirty()) return;
    setActiveCalendar(key);
  };

  const handleNavigate = (direction: -1 | 1) => {
    if (!confirmIfDirty()) return;
    setSelectedDate((prev) => addDaysISO(startOfWeekISO(prev), direction * 7));
  };

  const handleGoToday = () => {
    if (!confirmIfDirty()) return;
    setSelectedDate(todayISO());
  };

  const handleRefresh = () => {
    if (!confirmIfDirty()) return;
    void loadWeek();
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const diff = buildBulkDiff(snapshot, rows, isPublic, schoolId);
      if ("error" in diff) {
        throw new Error(diff.error);
      }
      const response = await bulkSaveSchedule(diff.request);
      if (!response.status) {
        throw new Error(response.error ?? "Не удалось сохранить");
      }
      await loadWeek();
      onSaved();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Ошибка сохранения",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${reportStyles.workspace} ${styles.workspace}`}>
      <header className={`${reportStyles.excelRibbon} ${styles.ribbon}`}>
        <div className={reportStyles.excelRow}>
          <div
            className={`${reportStyles.excelZone} ${reportStyles.excelZoneInfo}`}
          >
            <span className={reportStyles.excelZoneLabel}>Информация</span>
            <div className={reportStyles.excelZoneBody}>
              <ReportMacClose onClose={handleClose} />
              <div className={styles.titleBlock}>
                <h2 className={styles.title}>Расписание · таблица</h2>
                <p className={styles.subtitle}>
                  {calendarLabel(activeCalendar, schools)}
                </p>
              </div>
            </div>
          </div>

          <div className={`${reportStyles.excelZone} ${styles.calendarZone}`}>
            <span className={reportStyles.excelZoneLabel}>Календарь</span>
            <div className={reportStyles.excelZoneBody}>
              <CalendarPicker
                schools={schools}
                value={activeCalendar}
                onChange={handleCalendarChange}
                disabled={saving}
              />
            </div>
          </div>

          <div className={`${reportStyles.excelZone} ${styles.periodZone}`}>
            <span className={reportStyles.excelZoneLabel}>Неделя</span>
            <div className={reportStyles.excelZoneBody}>
              <div className={styles.weekNav}>
                <button
                  type="button"
                  className={styles.weekNavArrow}
                  aria-label="Предыдущая неделя"
                  title="Предыдущая неделя"
                  onClick={() => handleNavigate(-1)}
                  disabled={saving}
                >
                  <ChevronLeft size={18} />
                </button>
                <div className={styles.weekNavCenter}>
                  <span className={styles.weekNavRange}>{weekLabel}</span>
                  <button
                    type="button"
                    className={styles.weekNavToday}
                    onClick={handleGoToday}
                    disabled={saving}
                  >
                    Сегодня
                  </button>
                </div>
                <button
                  type="button"
                  className={styles.weekNavArrow}
                  aria-label="Следующая неделя"
                  title="Следующая неделя"
                  onClick={() => handleNavigate(1)}
                  disabled={saving}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className={reportStyles.excelZone}>
            <span className={reportStyles.excelZoneLabel}>Действия</span>
            <div className={reportStyles.excelZoneBody}>
              <button
                type="button"
                className={styles.navBtn}
                onClick={handleRefresh}
                disabled={loading || saving}
                title="Обновить с сервера"
              >
                <RefreshCw size={14} />
              </button>
              <EditOnly><button
                type="button"
                className={styles.saveBtn}
                onClick={() => void handleSave()}
                disabled={!dirty || saving || loading}
              >
                {saving ? "Сохранение…" : "Сохранить"}
              </button></EditOnly>
            </div>
          </div>
        </div>
      </header>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}

      {loading ? (
        <LoadingState label="Загрузка недели…" />
      ) : (
        <ScheduleTableGrid
          weekDates={weekDates}
          rows={rows}
          onChange={setRows}
        />
      )}
    </div>
  );
}
