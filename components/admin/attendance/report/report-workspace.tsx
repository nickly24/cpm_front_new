"use client";

import { ReportGrid } from "@/components/admin/attendance/report/report-grid";
import { ReportMacClose } from "@/components/admin/attendance/report/report-mac-close";
import reportStyles from "@/components/admin/attendance/report/report.module.css";
import type { ReportPeriodSelection } from "@/components/admin/attendance/report/period-modal";
import { ReportToolbar } from "@/components/admin/attendance/report/report-toolbar";
import { ReportZapModal } from "@/components/admin/attendance/report/report-zap-modal";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { OptionSelect } from "@/components/ui/option-select";
import { useCabinetChrome } from "@/contexts/cabinet-chrome-context";
import {
  fetchAttendanceTypes,
  fetchClassDayAttendance,
} from "@/lib/attendance/attendance-api";
import {
  buildAttendanceTypeOptions,
  getDefaultAttendanceTypeId,
} from "@/lib/attendance/attendance-type-options";
import {
  deleteClassDayAttendance,
  fetchAttendanceReport,
  setClassDayAttendance,
} from "@/lib/attendance/attendance-report-api";
import type {
  AttendanceReportData,
  AttendanceReportEntry,
  CellUiState,
  ReportSortDir,
  ReportSortKey,
  ReportTool,
} from "@/lib/attendance/attendance-report-types";
import { summarizeStudentAttendance } from "@/lib/attendance/attendance-report-summary";
import {
  buildCellMap,
  cellMapKey,
  filterReportStudents,
  sortReportStudents,
  uniqueFilterOptions,
} from "@/lib/attendance/attendance-report-utils";
import type { AttendanceType } from "@/lib/attendance/attendance-types";
import { formatClassDayLabel } from "@/lib/attendance/attendance-utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

interface PopoverState {
  studentId: number;
  classDayId: number;
  studentName: string;
  dayLabel: string;
  entry: AttendanceReportEntry | null;
  x: number;
  y: number;
}

interface ReportWorkspaceProps {
  period: ReportPeriodSelection;
  onBack: () => void;
  readOnly?: boolean;
  title?: string;
}

export function ReportWorkspace({
  period,
  onBack,
  readOnly = false,
  title,
}: ReportWorkspaceProps) {
  const { setImmersive } = useCabinetChrome();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AttendanceReportData | null>(null);
  const [cellMap, setCellMap] = useState<Map<string, AttendanceReportEntry>>(
    new Map(),
  );
  const [cellUi, setCellUi] = useState<Map<string, CellUiState>>(new Map());
  const [types, setTypes] = useState<AttendanceType[]>([]);
  const [tool, setTool] = useState<ReportTool>("cursor");
  const [typeId, setTypeId] = useState(1);
  const [searchFio, setSearchFio] = useState("");
  /** Синхронно с полем ввода (без debounce). */
  const debouncedSearch = searchFio;
  const [classFilter, setClassFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [sortKey, setSortKey] = useState<ReportSortKey>("fio");
  const [sortDir, setSortDir] = useState<ReportSortDir>("asc");
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [popoverTypeId, setPopoverTypeId] = useState<number | null>(null);
  const [popoverAdding, setPopoverAdding] = useState(false);
  const [popoverSaving, setPopoverSaving] = useState(false);
  const [zapModal, setZapModal] = useState<{
    zapId: number;
    zapDateId: number | null;
  } | null>(null);

  const paintingRef = useRef(false);
  const brushQueueRef = useRef<Set<string>>(new Set());
  const brushTimerRef = useRef<number | null>(null);
  const inFlightRef = useRef<Set<string>>(new Set());
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setImmersive(true);
    return () => setImmersive(false);
  }, [setImmersive]);

  useEffect(() => {
    void fetchAttendanceTypes().then((list) => {
      setTypes(list);
      const defaultId = getDefaultAttendanceTypeId(list);
      if (defaultId != null) {
        setTypeId(defaultId);
      }
    });
  }, []);

  const applyReportResponse = useCallback((data: AttendanceReportData) => {
    setReport(data);
    setCellMap(buildCellMap(data.entries));
  }, []);

  const loadReport = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const response = await fetchAttendanceReport(
          period.dateFrom,
          period.dateTo,
        );
        if (
          !response.status ||
          !response.period ||
          !response.class_days ||
          !response.students
        ) {
          setReport(null);
          setCellMap(new Map());
          setError(response.error ?? "Не удалось загрузить отчёт");
          return;
        }
        applyReportResponse({
          period: response.period,
          class_days: response.class_days,
          students: response.students,
          entries: response.entries ?? [],
        });
      } catch (err) {
        setReport(null);
        setCellMap(new Map());
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applyReportResponse, period.dateFrom, period.dateTo],
  );

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const refreshEntries = useCallback(async () => {
    try {
      const response = await fetchAttendanceReport(
        period.dateFrom,
        period.dateTo,
      );
      if (response.status && response.entries) {
        setCellMap(buildCellMap(response.entries));
      }
    } catch {
      /* keep local state */
    }
  }, [period.dateFrom, period.dateTo]);

  const setCellPhase = useCallback((key: string, phase: CellUiState["phase"]) => {
    setCellUi((prev) => {
      const next = new Map(prev);
      if (phase === "idle") {
        next.delete(key);
      } else {
        next.set(key, { phase });
      }
      return next;
    });
    if (phase === "success" || phase === "error") {
      window.setTimeout(() => {
        setCellUi((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      }, phase === "success" ? 480 : 380);
    }
  }, []);

  const typeById = useMemo(() => {
    const map = new Map<number, AttendanceType>();
    for (const type of types) map.set(type.id, type);
    return map;
  }, [types]);

  const buildEntryFromType = useCallback(
    (
      base: AttendanceReportEntry | null,
      studentId: number,
      classDayId: number,
      attendanceTypeId: number,
    ): AttendanceReportEntry => {
      const type = typeById.get(attendanceTypeId);
      return {
        id: base?.id ?? 0,
        student_id: studentId,
        class_day_id: classDayId,
        attendance_type_id: attendanceTypeId,
        type_code: type?.code ?? base?.type_code ?? "",
        type_name: type?.name_ru ?? base?.type_name ?? "",
        zap_id: base?.zap_id ?? null,
        zap_date_id: base?.zap_date_id ?? null,
      };
    },
    [typeById],
  );

  const syncCellFromServer = useCallback(
    async (studentId: number, classDayId: number) => {
      const key = cellMapKey(studentId, classDayId);
      const list = await fetchClassDayAttendance(classDayId);
      const found = list.find((item) => item.student_id === studentId);
      setCellMap((map) => {
        const next = new Map(map);
        if (found) {
          next.set(key, {
            id: found.id,
            student_id: found.student_id,
            class_day_id: classDayId,
            attendance_type_id: found.attendance_type_id,
            type_code: found.type_code,
            type_name: found.type_name,
            zap_id: found.zap_id,
            zap_date_id: null,
          });
        } else {
          next.delete(key);
        }
        return next;
      });
    },
    [],
  );

  const resolveAttendanceId = useCallback(
    async (
      studentId: number,
      classDayId: number,
      entry: AttendanceReportEntry | null | undefined,
    ): Promise<number | null> => {
      if (entry && entry.id > 0) {
        return entry.id;
      }
      const list = await fetchClassDayAttendance(classDayId);
      const found = list.find((item) => item.student_id === studentId);
      return found?.id ?? null;
    },
    [],
  );

  const applySet = useCallback(
    async (
      studentId: number,
      classDayId: number,
      attendanceTypeId: number,
    ) => {
      const key = cellMapKey(studentId, classDayId);
      const previous = cellMap.get(key) ?? null;
      setCellPhase(key, "pending");
      try {
        const result = await setClassDayAttendance(classDayId, {
          student_id: studentId,
          attendance_type_id: attendanceTypeId,
          zap_id: previous?.zap_id ?? null,
        });
        if (!result.status) {
          setCellPhase(key, "error");
          return;
        }
        await syncCellFromServer(studentId, classDayId);
        setCellPhase(key, "success");
      } catch {
        setCellPhase(key, "error");
      }
    },
    [setCellPhase, syncCellFromServer],
  );

  const applyErase = useCallback(
    async (studentId: number, classDayId: number) => {
      const key = cellMapKey(studentId, classDayId);
      const previous = cellMap.get(key);
      if (!previous || inFlightRef.current.has(key)) return;

      inFlightRef.current.add(key);
      setCellPhase(key, "pending");
      try {
        const attendanceId = await resolveAttendanceId(
          studentId,
          classDayId,
          previous,
        );
        if (!attendanceId) {
          setCellMap((map) => {
            const next = new Map(map);
            next.delete(key);
            return next;
          });
          setCellPhase(key, "success");
          return;
        }
        const result = await deleteClassDayAttendance(classDayId, attendanceId);
        if (!result.status) {
          setCellPhase(key, "error");
          window.alert(result.error ?? "Не удалось удалить отметку");
          return;
        }
        setCellMap((map) => {
          const next = new Map(map);
          next.delete(key);
          return next;
        });
        setCellPhase(key, "success");
      } catch (err) {
        setCellPhase(key, "error");
        window.alert(err instanceof Error ? err.message : "Ошибка удаления");
      } finally {
        inFlightRef.current.delete(key);
      }
    },
    [cellMap, resolveAttendanceId, setCellPhase],
  );

  const flushBrushQueue = useCallback(async () => {
    const keys = [...brushQueueRef.current];
    brushQueueRef.current.clear();
    if (keys.length === 0) return;

    await Promise.all(
      keys.map((key) => {
        const [studentIdRaw, classDayIdRaw] = key.split(":");
        const studentId = Number(studentIdRaw);
        const classDayId = Number(classDayIdRaw);
        return applySet(studentId, classDayId, typeId);
      }),
    );
    await refreshEntries();
  }, [applySet, refreshEntries, typeId]);

  const queueBrush = useCallback(
    (studentId: number, classDayId: number) => {
      const key = cellMapKey(studentId, classDayId);
      brushQueueRef.current.add(key);
      if (brushTimerRef.current === null) {
        brushTimerRef.current = window.setTimeout(() => {
          brushTimerRef.current = null;
          void flushBrushQueue();
        }, 300);
      }
    },
    [flushBrushQueue],
  );

  useEffect(() => {
    const stopPainting = () => {
      paintingRef.current = false;
    };
    window.addEventListener("mouseup", stopPainting);
    return () => window.removeEventListener("mouseup", stopPainting);
  }, []);

  useEffect(() => {
    if (!popover) return;
    function handleClick(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setPopover(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [popover]);

  const filterOptions = useMemo(
    () => (report ? uniqueFilterOptions(report.students) : null),
    [report],
  );

  const filteredStudents = useMemo(() => {
    if (!report) return [];
    const filtered = filterReportStudents(
      report.students,
      debouncedSearch,
      classFilter,
      schoolFilter,
      groupFilter,
    );
    return sortReportStudents(filtered, sortKey, sortDir);
  }, [
    report,
    debouncedSearch,
    classFilter,
    schoolFilter,
    groupFilter,
    sortKey,
    sortDir,
  ]);

  const handleSort = (key: ReportSortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };

  const openPopover = (
    studentId: number,
    classDayId: number,
    clientX: number,
    clientY: number,
  ) => {
    if (!report) return;
    const student = report.students.find((item) => item.student_id === studentId);
    const day = report.class_days.find((item) => item.id === classDayId);
    const entry = cellMap.get(cellMapKey(studentId, classDayId)) ?? null;
    const defaultTypeId = getDefaultAttendanceTypeId(types);
    setPopoverAdding(false);
    setPopoverTypeId(
      entry?.attendance_type_id ?? defaultTypeId,
    );
    setPopover({
      studentId,
      classDayId,
      studentName: student?.full_name ?? `ID ${studentId}`,
      dayLabel: day ? formatClassDayLabel(day) : "",
      entry,
      x: Math.min(clientX, window.innerWidth - 340),
      y: Math.min(clientY, window.innerHeight - 280),
    });
  };

  const handleCellPointerDown = (
    studentId: number,
    classDayId: number,
    event?: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (readOnly) {
      return;
    }
    if (tool === "cursor") {
      openPopover(
        studentId,
        classDayId,
        event?.clientX ?? 120,
        event?.clientY ?? 120,
      );
      return;
    }
    if (tool === "brush") {
      paintingRef.current = true;
      queueBrush(studentId, classDayId);
      return;
    }
    if (tool === "eraser") {
      paintingRef.current = true;
      void applyErase(studentId, classDayId);
      return;
    }
    if (tool === "pencil") {
      void applySet(studentId, classDayId, typeId);
    }
  };

  const handleCellPointerEnter = (studentId: number, classDayId: number) => {
    if (readOnly) return;
    if (!paintingRef.current) return;
    if (tool === "brush") {
      queueBrush(studentId, classDayId);
      return;
    }
    if (tool === "eraser") {
      void applyErase(studentId, classDayId);
    }
  };

  const popoverTypeOptions = useMemo(
    () => buildAttendanceTypeOptions(types),
    [types],
  );

  const handleExport = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const header = [
        "Группа",
        "Класс",
        "Школа",
        "ФИО",
        ...report.class_days.map((day) => day.date),
        "Сводка (отмечено/всего)",
      ];
      const body = filteredStudents.map((student) => {
        const row: (string | number)[] = [
          student.group_name ?? "",
          student.class ?? "",
          student.school_short_name ?? "",
          student.full_name,
        ];
        for (const day of report.class_days) {
          const entry =
            cellMap.get(cellMapKey(student.student_id, day.id)) ?? null;
          row.push(entry?.type_name ?? "");
        }
        const summary = summarizeStudentAttendance(
          student.student_id,
          report.class_days,
          cellMap,
        );
        row.push(`${summary.marked}/${summary.total}`);
        return row;
      });
      const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Посещаемость");
      XLSX.writeFile(
        workbook,
        `poseshchaemost_${period.dateFrom}_${period.dateTo}.xlsx`,
      );
    } finally {
      setExporting(false);
    }
  };

  const periodLabel = `${period.dateFrom} — ${period.dateTo}`;
  const fileName = `poseshchaemost_${period.dateFrom}_${period.dateTo}.xlsx`;

  if (loading) {
    return (
      <div className={reportStyles.workspace}>
        <LoadingState label="Загрузка журнала…" variant="panel" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className={reportStyles.workspace}>
        <header className={reportStyles.excelRibbon}>
          <div className={reportStyles.excelRow}>
            <section
              className={`${reportStyles.excelZone} ${reportStyles.excelZoneInfo}`}
            >
              <span className={reportStyles.excelZoneLabel}>Информация</span>
              <div className={reportStyles.excelZoneInfoRow}>
                <ReportMacClose onClose={onBack} />
              </div>
            </section>
          </div>
        </header>
        <p className={styles.errorText}>{error ?? "Нет данных"}</p>
        <Button type="button" onClick={() => void loadReport()}>
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <div className={reportStyles.workspace}>
      <ReportToolbar
        onBack={onBack}
        periodLabel={periodLabel}
        fileName={fileName}
        rowCountLabel={`${filteredStudents.length} / ${report.students.length}`}
        title={title}
        tool={tool}
        onToolChange={setTool}
        typeId={typeId}
        onTypeIdChange={setTypeId}
        types={types}
        onExport={() => void handleExport()}
        onRefresh={() => void loadReport(true)}
        exporting={exporting}
        refreshing={refreshing}
        readOnly={readOnly}
      />

      <ReportGrid
        students={filteredStudents}
        classDays={report.class_days}
        cellMap={cellMap}
        cellUi={cellUi}
        tool={tool}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        searchFio={searchFio}
        onSearchFioChange={setSearchFio}
        classFilter={classFilter}
        onClassFilterChange={setClassFilter}
        schoolFilter={schoolFilter}
        onSchoolFilterChange={setSchoolFilter}
        groupFilter={groupFilter}
        onGroupFilterChange={setGroupFilter}
        filterOptions={filterOptions}
        onCellPointerDown={handleCellPointerDown}
        onCellPointerEnter={handleCellPointerEnter}
      />

      {!readOnly && popover ? (
        <div
          ref={popoverRef}
          className={reportStyles.popover}
          style={{ left: popover.x, top: popover.y }}
          role="dialog"
          aria-label="Ячейка посещаемости"
        >
          <h4 className={reportStyles.popoverTitle}>{popover.studentName}</h4>
          <p className={reportStyles.popoverMeta}>{popover.dayLabel}</p>
          {popover.entry ? (
            <p className={reportStyles.popoverMeta}>
              Текущий тип: <strong>{popover.entry.type_name}</strong>
              {popover.entry.zap_id ? ` · отгул #${popover.entry.zap_id}` : ""}
            </p>
          ) : (
            <p className={reportStyles.popoverMeta}>
              Посещение не отмечено
            </p>
          )}
          {popover.entry || popoverAdding ? (
            <OptionSelect
              label={popover.entry ? "Изменить тип" : "Тип посещения"}
              value={popoverTypeId ?? popoverTypeOptions[0]?.value ?? 0}
              options={popoverTypeOptions}
              onChange={setPopoverTypeId}
              disabled={popoverSaving || popoverTypeOptions.length === 0}
            />
          ) : null}
          <div className={reportStyles.popoverActions}>
            {popover.entry || popoverAdding ? (
              <Button
                type="button"
                size="sm"
                disabled={
                  popoverSaving ||
                  popoverTypeId == null ||
                  popoverTypeOptions.length === 0
                }
                onClick={() => {
                  if (popoverTypeId == null) return;
                  setPopoverSaving(true);
                  void applySet(
                    popover.studentId,
                    popover.classDayId,
                    popoverTypeId,
                  ).finally(() => {
                    setPopoverSaving(false);
                    setPopover(null);
                    setPopoverAdding(false);
                  });
                }}
              >
                {popoverSaving
                  ? "…"
                  : popover.entry
                    ? "Сохранить"
                    : "Добавить"}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setPopoverAdding(true);
                  if (popoverTypeId == null) {
                    const defaultId = getDefaultAttendanceTypeId(types);
                    if (defaultId != null) setPopoverTypeId(defaultId);
                  }
                }}
              >
                Добавить посещение
              </Button>
            )}
            {popover.entry?.zap_id ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setZapModal({
                    zapId: popover.entry!.zap_id!,
                    zapDateId: popover.entry?.zap_date_id ?? null,
                  });
                }}
              >
                Отгул
              </Button>
            ) : null}
            {popover.entry ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={styles.actionBtnDanger}
                onClick={() => {
                  void applyErase(popover.studentId, popover.classDayId).then(
                    () => setPopover(null),
                  );
                }}
              >
                Удалить
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPopover(null)}
            >
              Закрыть
            </Button>
          </div>
        </div>
      ) : null}

      {!readOnly && zapModal ? (
        <ReportZapModal
          zapId={zapModal.zapId}
          zapDateId={zapModal.zapDateId}
          onClose={() => setZapModal(null)}
          onUnlinked={async () => {
            await loadReport(true);
            setPopover(null);
            setZapModal(null);
          }}
        />
      ) : null}
    </div>
  );
}
