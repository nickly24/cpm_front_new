"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCabinetChrome } from "@/contexts/cabinet-chrome-context";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { attendanceError, command, permitted, type AttendanceType } from "@/lib/bff/attendance";
import { excelTypes } from "@/lib/attendance/excel-report";
import { buildCellMap, cellMapKey, filterReportStudents, sortReportStudents, uniqueFilterOptions } from "@/lib/attendance/attendance-report-utils";
import type { AttendanceReportData, CellUiState, ReportSortDir, ReportSortKey, ReportTool } from "@/lib/attendance/attendance-report-types";
import type { ReportPeriodSelection } from "@/components/admin/attendance/report/period-modal";
import { ReportToolbar } from "@/components/admin/attendance/report/report-toolbar";
import { ReportGrid } from "@/components/admin/attendance/report/report-grid";
import reportStyles from "@/components/admin/attendance/report/report.module.css";
import { ActionNotice, useAction } from "./shared";

import { applyConfirmedCell, type CellIntent } from "@/lib/attendance/confirmed-cell";
import { prepareJournal, journalLoadError, type PreparedJournal } from "@/lib/attendance/journal-workspace";
import { AttendanceActivity } from "./activity";
import adminStyles from "./attendance-admin.module.css";
export function ExcelAttendanceJournal({ division, divisionName, period, onBack, initialData }: {
  division: number; divisionName: string; period: ReportPeriodSelection; onBack: () => void; initialData?: PreparedJournal;
}) {
  const { user } = useAuth();
  const { setImmersive } = useCabinetChrome();
  const [report, setReport] = useState<AttendanceReportData | null>(initialData?.report ?? null);
  const [types, setTypes] = useState<AttendanceType[]>(initialData?.value.types ?? []);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState("");
  const [tool, setTool] = useState<ReportTool>("cursor");
  const [typeId, setTypeId] = useState(initialData?.value.types.find(t=>t.is_active&&t.scan_default)?.id??initialData?.value.types.find(t=>t.is_active)?.id??0);
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
  const revision = useRef(initialData?.revision ?? 0), sequence = useRef(0);
  const skipRefresh=useRef(false), paused=useRef(false);
  const [queueLength,setQueueLength]=useState(0),[queuePaused,setQueuePaused]=useState(false);
  const alive = useRef(true), painting = useRef(false), running = useRef(false);
  const fresh = useRef(Boolean(initialData));
  const [readReady,setReadReady]=useState(Boolean(initialData));
  const queue = useRef<CellIntent[]>([]), gesture = useRef(new Set<string>());
  const reportRef = useRef(report);
  const chooseType = (ts:AttendanceType[],current:number) => ts.some(t=>t.id===current&&t.is_active)?current:(ts.find(t=>t.is_active&&t.scan_default)??ts.find(t=>t.is_active))?.id??0;
  const prefix = `/divisions/${division}`;
  const canEdit = permitted(user, division, "attendance", true) || user?.role === "proctor";
  const reload = useCallback(async (signal?: AbortSignal) => {
    const id = ++sequence.current; fresh.current = false; setReadReady(false); setLoading(true); setError("");
    try {
      const prepared=await prepareJournal(division,period.dateFrom,period.dateTo,signal);
      if (!alive.current || signal?.aborted || id !== sequence.current) return;
      revision.current=prepared.revision;
      reportRef.current=prepared.report;setReport(prepared.report);setTypes(prepared.value.types);
      fresh.current=true;setReadReady(true);
      setTypeId(current=>chooseType(prepared.value.types,current));
    } catch (e) { if (alive.current && !signal?.aborted && id === sequence.current) setError(journalLoadError(e)); }
    finally { if (alive.current && !signal?.aborted && id === sequence.current) setLoading(false); }
  }, [division, period.dateFrom, period.dateTo]);
  const refreshAfterCommand=useCallback(async()=>{if(skipRefresh.current){skipRefresh.current=false;return;}await reload();},[reload]);
  const action = useAction(refreshAfterCommand);
  const blocked = loading || !readReady || Boolean(error) || action.busy || Boolean(action.pending);
  useContextGuard(queueLength>0 || queueBusy || selected !== null);
  const immersive=report!==null;
  useEffect(() => { setImmersive(immersive); return () => setImmersive(false); }, [setImmersive,immersive]);
  useEffect(() => {
    alive.current = true; const controller = new AbortController();
    void Promise.resolve().then(() => { if (!controller.signal.aborted) {if(initialData) {setTypeId(current=>chooseType(initialData.value.types,current));return;}return reload(controller.signal);} });
    return () => { alive.current = false; controller.abort(); queue.current = []; };
  }, [reload,initialData]);
  useEffect(()=>{if(!queueLength)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[queueLength]);
  useEffect(() => { const stop = () => { painting.current = false; }; window.addEventListener("mouseup", stop); return () => window.removeEventListener("mouseup", stop); }, []);
  const cellMap = useMemo(() => buildCellMap(report?.entries ?? []), [report]);
  const rows = useMemo(() => sortReportStudents(filterReportStudents(report?.students ?? [], search, classFilter, schoolFilter, groupFilter), sortKey, sortDir), [report, search, classFilter, schoolFilter, groupFilter, sortKey, sortDir]);
  const options = useMemo(() => report ? uniqueFilterOptions(report.students) : null, [report]);
  const activeTypes = excelTypes(types);
  const setPhase = (key: string, phase: CellUiState["phase"]) => setCellUi(current => new Map(current).set(key, { phase }));
  const pauseQueue=()=>{paused.current=true;painting.current=false;setQueuePaused(true);};
  async function drain() {
    if (running.current || paused.current || !fresh.current) return;
    running.current=true;setQueueBusy(true);
    try {
      while(alive.current && queue.current.length && !paused.current) {
        const intent=queue.current[0];const key=cellMapKey(intent.account,intent.day);
        const entry=reportRef.current?.entries.find(e=>e.student_id===intent.account&&e.class_day_id===intent.day);
        if(entry?.zap_id!=null||(!intent.type&&!entry)){queue.current.shift();setQueueLength(queue.current.length);continue;}
        setPhase(key,"pending");const expected=revision.current;
        const path=`${prefix}/class-days/${intent.day}/attendance`;
        const result=await action.execute(command(intent.type?path:`${path}/${intent.account}`,intent.type?"POST":"DELETE",expected,intent.type?{account_id:intent.account,attendance_type_id:intent.type}:{}),confirmed=>{
          // A successful HTTP response is committed even if its projection cannot
          // be applied. Never submit that intent under a new command UUID.
          if(queue.current[0]===intent){queue.current.shift();setQueueLength(queue.current.length);}
          try {
            if(!reportRef.current||revision.current!==expected)throw new Error("Журнал изменился параллельно. Обновите данные перед продолжением.");
            const data=applyConfirmedCell(reportRef.current,confirmed,expected,division,intent);
            revision.current=confirmed.revision;reportRef.current=data;setReport(data);fresh.current=true;setReadReady(true);skipRefresh.current=true;setPhase(key,"success");
          }catch(e){fresh.current=false;setReadReady(false);pauseQueue();setError(attendanceError(e));setPhase(key,"error");throw e;}
        });
        if(!alive.current)return;
        if(!result){fresh.current=false;setReadReady(false);setPhase(key,"error");pauseQueue();break;}
        if(!fresh.current){pauseQueue();break;}
      }
    } finally {running.current=false;if(alive.current)setQueueBusy(false);}
  }
  function enqueue(account:number,day:number,type:number) {
    if(!canEdit||paused.current||!fresh.current||(blocked&&!running.current))return;
    const key=cellMapKey(account,day);if(gesture.current.has(key))return;
    gesture.current.add(key);queue.current.push({account,day,type});setQueueLength(queue.current.length);void drain();
  }
  async function recoverQueue() {
    const head=queue.current[0];
    const recovered=await action.recover();
    if(recovered) {
      if(head&&queue.current[0]===head){queue.current.shift();setQueueLength(queue.current.length);setPhase(cellMapKey(head.account,head.day),"success");}
    }
    return recovered;
  }
  const noticeAction={...action,recover:recoverQueue};
  function resumeQueue(){if(!fresh.current||action.pending||action.busy||action.recovery==="committed")return;paused.current=false;setQueuePaused(false);setError("");void drain();}
  function pointerDown(account: number, day: number, event?: React.MouseEvent<HTMLButtonElement>) {
    if (paused.current || (blocked && !running.current)) return;
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
  const close = () => { if (!queueLength && !queueBusy && !action.busy && !action.pending) onBack(); };
  return <div className={reportStyles.workspace} style={{ position: "fixed", inset: 0, zIndex: 70 }} aria-label="Excel-журнал посещаемости">
    <ReportToolbar onBack={close} periodLabel={`${divisionName} · ${period.dateFrom} — ${period.dateTo}`} fileName={`Посещаемость_${period.dateFrom}_${period.dateTo}.xlsx`} rowCountLabel={`${rows.length} / ${report?.students.length ?? 0}`} tool={tool} onToolChange={value => { if (!queueBusy && !blocked) setTool(value); }} typeId={typeId} onTypeIdChange={setTypeId} types={activeTypes} onExport={() => void exportFile()} onRefresh={() => { if (!queueBusy && !action.pending) void reload(); }} refreshing={loading} readOnly={!canEdit} />
    <div className={adminStyles.statusRow}><ActionNotice action={noticeAction}/>{error&&<p role="alert">{error}</p>}{loading&&<AttendanceActivity label="Обновление журнала"/>}{queueBusy&&<AttendanceActivity label="Сохранение отметок"/>}</div>
    {(queueLength>0||queuePaused)&&<div className={adminStyles.queue}>{queueBusy?<AttendanceActivity label="Отправка очереди отметок"/>:null}<span>{queuePaused?"Очередь приостановлена":"В очереди"}: {queueLength}</span>{queuePaused&&<><span>Неотправленные отметки сохранены в этом окне.</span><button disabled={!!action.pending||action.busy||action.recovery==="committed"||!readReady} onClick={resumeQueue}>Продолжить очередь</button><button disabled={!!action.pending||action.busy} onClick={()=>{queue.current=[];setQueueLength(0);setQueuePaused(false);paused.current=false;setCellUi(new Map());}}>Отменить неотправленные</button></>}</div>}
    {loading && !report ? <AttendanceActivity large label="Подготовка журнала"/> : report ? <ReportGrid students={rows} classDays={report?.class_days ?? []} cellMap={cellMap} cellUi={cellUi} tool={tool} sortKey={sortKey} sortDir={sortDir} onSort={key => { if (sortKey === key) setSortDir(value => value === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDir("asc"); } }} searchFio={search} onSearchFioChange={setSearch} classFilter={classFilter} onClassFilterChange={setClassFilter} schoolFilter={schoolFilter} onSchoolFilterChange={setSchoolFilter} groupFilter={groupFilter} onGroupFilterChange={setGroupFilter} filterOptions={options} disabled={queuePaused || (blocked && !queueBusy)} onCellPointerDown={pointerDown} onCellPointerEnter={(account, day) => { if (painting.current) enqueue(account, day, tool === "eraser" ? 0 : typeId); }} /> : null}
    {selected && <div className={reportStyles.popover} role="dialog" aria-label="Ячейка посещаемости" style={{ left: selected.x, top: selected.y }}>
      <h4 className={reportStyles.popoverTitle}>{report?.students.find(student => student.student_id === selected.account)?.full_name}</h4>
      <p>{report?.class_days.find(day => day.id === selected.day)?.date}</p><p>{entry?.type_name ?? "Не отмечен"}</p>
      {entry?.zap_id != null ? <p>Отметка связана с отгулом №{entry.zap_id}. Изменить решение можно в разделе «Запросы на отгул».</p> : canEdit && <label>Тип посещения<select aria-label="Тип посещения" value={selectionType} disabled={blocked || queueBusy} onChange={event => setSelectionType(Number(event.target.value))}>{entry && !activeTypes.some(type => type.id === entry.attendance_type_id) && <option value={entry.attendance_type_id} disabled>{entry.type_name} · архив</option>}{activeTypes.map(type => <option value={type.id} key={type.id}>{type.name_ru}</option>)}</select></label>}
      <div className={reportStyles.popoverActions}>{canEdit && entry?.zap_id == null && <><button disabled={blocked || queueBusy || !activeTypes.some(type => type.id === selectionType)} onClick={() => { gesture.current.clear(); enqueue(selected.account, selected.day, selectionType); setSelected(null); }}>Сохранить</button>{entry && <button disabled={blocked || queueBusy} onClick={() => { gesture.current.clear(); enqueue(selected.account, selected.day, 0); setSelected(null); }}>Удалить отметку</button>}</>}<button onClick={() => setSelected(null)}>Закрыть</button></div>
    </div>}
  </div>;
}
