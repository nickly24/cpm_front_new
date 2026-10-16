"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCabinetChrome } from "@/contexts/cabinet-chrome-context";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { attendanceError, command, permitted, readAttendance, type AttendanceType, type Journal, type Student } from "@/lib/bff/attendance";
import { excelReport, excelTypes } from "@/lib/attendance/excel-report";
import { buildCellMap, cellMapKey, filterReportStudents, sortReportStudents, uniqueFilterOptions } from "@/lib/attendance/attendance-report-utils";
import type { AttendanceReportData, CellUiState, ReportSortDir, ReportSortKey, ReportTool } from "@/lib/attendance/attendance-report-types";
import type { ReportPeriodSelection } from "@/components/admin/attendance/report/period-modal";
import { ReportToolbar } from "@/components/admin/attendance/report/report-toolbar";
import { ReportGrid } from "@/components/admin/attendance/report/report-grid";
import reportStyles from "@/components/admin/attendance/report/report.module.css";
import { ActionNotice, useAction } from "./shared";

type CellIntent = { account: number; day: number; type: number };
export function ExcelAttendanceJournal({ division, divisionName, period, onBack }: {
  division: number; divisionName: string; period: ReportPeriodSelection; onBack: () => void;
}) {
  const { user } = useAuth();
  const { setImmersive } = useCabinetChrome();
  const [report, setReport] = useState<AttendanceReportData | null>(null);
  const [types, setTypes] = useState<AttendanceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tool, setTool] = useState<ReportTool>("cursor");
  const [typeId, setTypeId] = useState(0);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [sortKey, setSortKey] = useState<ReportSortKey>("fio");
  const [sortDir, setSortDir] = useState<ReportSortDir>("asc");
  const [cellUi, setCellUi] = useState<Map<string, CellUiState>>(new Map());
  const [selected, setSelected] = useState<{ account: number; day: number; x: number; y: number } | null>(null);
  const [selectionType, setSelectionType] = useState(0);
  const [queueBusy, setQueueBusy] = useState(false);
  const revision = useRef(0), sequence = useRef(0);
  const alive = useRef(true), painting = useRef(false), running = useRef(false);
  const fresh = useRef(false);
  const queue = useRef<CellIntent[]>([]), gesture = useRef(new Set<string>());
  const reportRef = useRef(report);
  const prefix = `/divisions/${division}`;
  const canEdit = permitted(user, division, "attendance", true) || user?.role === "proctor";
  const reload = useCallback(async (signal?: AbortSignal) => {
    const id = ++sequence.current; fresh.current = false; setLoading(true); setError("");
    try {
      const response = await readAttendance<Journal>(`${prefix}/attendance-report?date_from=${period.dateFrom}&date_to=${period.dateTo}`, signal);
      const roster = await readAttendance<Student[]>(`${prefix}/students`, signal);
      const ts = await readAttendance<AttendanceType[]>(`${prefix}/attendance-types`, signal);
      if (!alive.current || signal?.aborted || id !== sequence.current) return;
      revision.current = response.revision;
      // All three reads must describe the same organization revision.
      if (roster.revision !== response.revision || ts.revision !== response.revision) throw new Error("Журнал изменился во время загрузки. Обновите данные.");
      const data = excelReport(response.value, roster.value, period.dateFrom, period.dateTo);
      reportRef.current = data; setReport(data); setTypes(ts.value);
      fresh.current = true;
      setTypeId(current => ts.value.some(t => t.id === current && t.is_active) ? current : (ts.value.find(t => t.is_active && t.scan_default) ?? ts.value.find(t => t.is_active))?.id ?? 0);
    } catch (e) { if (alive.current && !signal?.aborted && id === sequence.current) setError(attendanceError(e)); }
    finally { if (alive.current && !signal?.aborted && id === sequence.current) setLoading(false); }
  }, [prefix, period.dateFrom, period.dateTo]);
  const action = useAction(reload);
  const blocked = loading || Boolean(error) || action.busy || Boolean(action.pending);
  useContextGuard(queueBusy || selected !== null);
  useEffect(() => { setImmersive(true); return () => setImmersive(false); }, [setImmersive]);
  useEffect(() => {
    alive.current = true; const controller = new AbortController();
    void Promise.resolve().then(() => { if (!controller.signal.aborted) return reload(controller.signal); });
    return () => { alive.current = false; controller.abort(); queue.current = []; };
  }, [reload]);
  useEffect(() => { const stop = () => { painting.current = false; }; window.addEventListener("mouseup", stop); return () => window.removeEventListener("mouseup", stop); }, []);
  const cellMap = useMemo(() => buildCellMap(report?.entries ?? []), [report]);
  const rows = useMemo(() => sortReportStudents(filterReportStudents(report?.students ?? [], search, classFilter, schoolFilter, groupFilter), sortKey, sortDir), [report, search, classFilter, schoolFilter, groupFilter, sortKey, sortDir]);
  const options = useMemo(() => report ? uniqueFilterOptions(report.students) : null, [report]);
  const activeTypes = excelTypes(types);
  const setPhase = (key: string, phase: CellUiState["phase"]) => setCellUi(current => new Map(current).set(key, { phase }));
  async function drain() {
    if (running.current) return;
    running.current = true; setQueueBusy(true);
    try {
      while (alive.current && queue.current.length) {
        const intent = queue.current.shift()!;
        const key = cellMapKey(intent.account, intent.day);
        const entry = reportRef.current?.entries.find(e => e.student_id === intent.account && e.class_day_id === intent.day);
        if (entry?.zap_id != null || (!intent.type && !entry)) continue;
        setPhase(key, "pending");
        const path = `${prefix}/class-days/${intent.day}/attendance`;
        const result = await action.execute(command(intent.type ? path : `${path}/${intent.account}`, intent.type ? "POST" : "DELETE", revision.current, intent.type ? { account_id: intent.account, attendance_type_id: intent.type } : {}));
        if (!alive.current) return;
        setPhase(key, result ? "success" : "error");
        if (!result || !fresh.current) { queue.current = []; break; }
        if (revision.current !== result.revision) {
          queue.current = []; setError("Журнал изменился параллельно. Сохранённая отметка подтверждена; проверьте данные перед продолжением."); break;
        }
      }
    } finally { running.current = false; if (alive.current) setQueueBusy(false); }
  }
  function enqueue(account: number, day: number, type: number) {
    if (!canEdit || (blocked && !running.current)) return;
    const key = cellMapKey(account, day);
    if (gesture.current.has(key)) return;
    gesture.current.add(key); queue.current.push({ account, day, type }); void drain();
  }
  function pointerDown(account: number, day: number, event?: React.MouseEvent<HTMLButtonElement>) {
    if (blocked || queueBusy) return;
    gesture.current.clear();
    if (tool === "cursor" || !canEdit) {
      setSelectionType(cellMap.get(cellMapKey(account, day))?.attendance_type_id ?? typeId);
      setSelected({ account, day, x: Math.max(8, Math.min(event?.clientX ?? 120, window.innerWidth - 340)), y: Math.max(8, Math.min(event?.clientY ?? 120, window.innerHeight - 310)) }); return;
    }
    painting.current = tool === "brush" || tool === "eraser";
    if (tool !== "eraser" && !typeId) { setError("Сначала добавьте активный тип посещения в подразделении."); painting.current = false; return; }
    enqueue(account, day, tool === "eraser" ? 0 : typeId);
  }
  async function exportFile() {
    if (!report) return;
    const XLSX = await import("xlsx");
    const header = ["Организация ID", "Подразделение ID", "Группа", "Класс", "Школа", "ФИО", ...report.class_days.map(day => day.date)];
    const body = rows.map(student => [user?.organization_id ?? "", division, student.group_name ?? "", student.class ?? "", student.school_short_name ?? "", student.full_name, ...report.class_days.map(day => cellMap.get(cellMapKey(student.student_id, day.id))?.type_name ?? "Не отмечен")]);
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([header, ...body]), "Посещаемость");
    XLSX.writeFile(workbook, `Посещаемость_${user?.organization_id}_${division}_${period.dateFrom}_${period.dateTo}.xlsx`);
  }
  const entry = selected ? cellMap.get(cellMapKey(selected.account, selected.day)) : null;
  const close = () => { if (!queueBusy && !action.busy && !action.pending) onBack(); };
  return <div className={reportStyles.workspace} style={{ position: "fixed", inset: 0, zIndex: 70 }} aria-label="Excel-журнал посещаемости">
    <ReportToolbar onBack={close} periodLabel={`${divisionName} · ${period.dateFrom} — ${period.dateTo}`} fileName={`Посещаемость_${period.dateFrom}_${period.dateTo}.xlsx`} rowCountLabel={`${rows.length} / ${report?.students.length ?? 0}`} tool={tool} onToolChange={value => { if (!queueBusy && !blocked) setTool(value); }} typeId={typeId} onTypeIdChange={setTypeId} types={activeTypes} onExport={() => void exportFile()} onRefresh={() => { if (!queueBusy && !action.pending) void reload(); }} refreshing={loading || queueBusy} readOnly={!canEdit} />
    <div role="status" style={{ padding: "4px 14px" }}><ActionNotice action={action} />{error && <p role="alert">{error}</p>}{loading && <span>Загрузка журнала…</span>}{queueBusy && <span>Сохраняем отметки…</span>}{!loading && report && !report.class_days.length && <span>В выбранном периоде нет дней занятий. Создать день можно после закрытия отчёта.</span>}</div>
    <ReportGrid students={rows} classDays={report?.class_days ?? []} cellMap={cellMap} cellUi={cellUi} tool={tool} sortKey={sortKey} sortDir={sortDir} onSort={key => { if (sortKey === key) setSortDir(value => value === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDir("asc"); } }} searchFio={search} onSearchFioChange={setSearch} classFilter={classFilter} onClassFilterChange={setClassFilter} schoolFilter={schoolFilter} onSchoolFilterChange={setSchoolFilter} groupFilter={groupFilter} onGroupFilterChange={setGroupFilter} filterOptions={options} disabled={blocked && !queueBusy} onCellPointerDown={pointerDown} onCellPointerEnter={(account, day) => { if (painting.current) enqueue(account, day, tool === "eraser" ? 0 : typeId); }} />
    {selected && <div className={reportStyles.popover} role="dialog" aria-label="Ячейка посещаемости" style={{ left: selected.x, top: selected.y }}>
      <h4 className={reportStyles.popoverTitle}>{report?.students.find(student => student.student_id === selected.account)?.full_name}</h4>
      <p>{report?.class_days.find(day => day.id === selected.day)?.date}</p><p>{entry?.type_name ?? "Не отмечен"}</p>
      {entry?.zap_id != null ? <p>Отметка связана с отгулом №{entry.zap_id}. Изменить решение можно в разделе «Запросы на отгул».</p> : canEdit && <label>Тип посещения<select aria-label="Тип посещения" value={selectionType} disabled={blocked || queueBusy} onChange={event => setSelectionType(Number(event.target.value))}>{entry && !activeTypes.some(type => type.id === entry.attendance_type_id) && <option value={entry.attendance_type_id} disabled>{entry.type_name} · архив</option>}{activeTypes.map(type => <option value={type.id} key={type.id}>{type.name_ru}</option>)}</select></label>}
      <div className={reportStyles.popoverActions}>{canEdit && entry?.zap_id == null && <><button disabled={blocked || queueBusy || !activeTypes.some(type => type.id === selectionType)} onClick={() => { gesture.current.clear(); enqueue(selected.account, selected.day, selectionType); setSelected(null); }}>Сохранить</button>{entry && <button disabled={blocked || queueBusy} onClick={() => { gesture.current.clear(); enqueue(selected.account, selected.day, 0); setSelected(null); }}>Удалить отметку</button>}</>}<button onClick={() => setSelected(null)}>Закрыть</button></div>
    </div>}
  </div>;
}
