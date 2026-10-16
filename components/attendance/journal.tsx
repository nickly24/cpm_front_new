"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import Image from "next/image";
import { StudentMonthlyAttendance } from "@/components/student/attendance/student-monthly-attendance";
import { ExcelAttendanceJournal } from "./excel-journal";
import { PeriodModal, type ReportPeriodSelection } from "@/components/admin/attendance/report/period-modal";
import QRCode from "qrcode";
import { useAuth } from "@/contexts/AuthContext";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { domain } from "@/lib/bff/client";
import { attendanceError, command, filterJournalStudents, journalExportHeaders, journalExportRows, journalRoster, journalTypeOptions, ownDivisions, permitted, readAttendance, studentGroupLabel, studentSchoolLabel, type AttendanceType, type Day, type Entry, type Journal, type JournalFilters, type Revision, type Student, typeInput } from "@/lib/bff/attendance";
import { todayISO } from "@/lib/schedule/utils";
import { AttendanceCamera } from "./camera";
import { ActionNotice, Range, styles, useAction } from "./shared";
const emptyType = (): AttendanceType => ({ id: 0, division_id: 0, version: 0, code: "", name: "", color: "#23884c", mark: "", sort_order: 10, is_active: true, counts_as_present: false, counts_as_absent: false, is_excused: false, scan_default: false, zap_default: false });
export function resolveJournalDay(days: Day[], selectedDay: number): number {
    return days.some(day => day.id === selectedDay) ? selectedDay : days[0]?.id ?? 0;
}
export function displayedJournal(journal: Journal | null, scan: boolean, loadedDay: number): Journal | null {
    if (!journal || !scan)
        return journal;
    return {
        ...journal,
        days: journal.days.filter(day => day.id === loadedDay),
        entries: journal.entries.filter(entry => entry.class_day_id === loadedDay),
    };
}
export function AttendanceJournal({ scan = false }: { scan?: boolean }) {
    const { user } = useAuth();
    return user?.role === "student" && !scan ? <StudentMonthlyAttendance /> : scan ? <StaffAttendanceJournal scan /> : <StaffJournalWithReport key={`${user?.account_id}:${user?.organization_id}:${user?.division_id}`} />;
}
function StaffJournalWithReport() {
    const [report, setReport] = useState<{ division: number; period: ReportPeriodSelection } | null>(null);
    const { user } = useAuth();
    const [lastDivision, setLastDivision] = useState(user?.division_id ?? ownDivisions(user)[0]?.id ?? 0);
    return report ? <ExcelAttendanceJournal division={report.division} divisionName={ownDivisions(user).find(d => d.id === report.division)?.name ?? "Подразделение"} period={report.period} onBack={() => setReport(null)} /> : <StaffAttendanceJournal initialDivision={lastDivision} onReport={(division, period) => { setLastDivision(division); setReport({ division, period }); }} />;
}
function StaffAttendanceJournal({ scan = false, onReport, initialDivision }: {
    scan?: boolean;
    onReport?: (division: number, period: ReportPeriodSelection) => void;
    initialDivision?: number;
}) {
    const { user } = useAuth();
    const organizationID = user?.organization_id ?? 0;
    const loadSequence = useRef(0);
    const divisions = ownDivisions(user);
    const [division, setDivision] = useState(initialDivision ?? user?.division_id ?? divisions[0]?.id ?? 0);
    const [from, setFrom] = useState(() => todayISO().slice(0, 7) + "-01");
    const [to, setTo] = useState(todayISO);
    const [journal, setJournal] = useState<Journal | null>(null);
    const [types, setTypes] = useState<AttendanceType[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [filters, setFilters] = useState<JournalFilters>({ class: "all", group: "all", school: "all" });
    const [revision, setRevision] = useState(0);
    const [error, setError] = useState("");
    const [dayEditor, setDayEditor] = useState<Day | null>(null);
    const [typeEditor, setTypeEditor] = useState<AttendanceType | null>(null);
    const [editRevision, setEditRevision] = useState(0);
    const [selectedDay, setSelectedDay] = useState<number>(0);
    const [loadedScanDay, setLoadedScanDay] = useState(0);
    const [qr, setQR] = useState("");
    const [qrDay, setQRDay] = useState(0);
    const [qrExpiry, setQRExpiry] = useState(0);
    const [scanToken, setScanToken] = useState("");
    const [camera, setCamera] = useState(false);
    const [loading, setLoading] = useState(true);
    const [periodModal, setPeriodModal] = useState(false);
    const reload = useCallback(async (signal?: AbortSignal) => { if (!division)
        return; const sequence = ++loadSequence.current; setLoading(true); setError(""); try {
        const prefix = `/divisions/${division}`;
        const ts = await readAttendance<AttendanceType[]>(prefix + "/attendance-types", signal);
        const roster = await readAttendance<Student[]>(prefix + "/students", signal);
        let res: Revision<Journal>;
        let loadedDay = 0;
        if (scan) {
            const ds = await readAttendance<Day[]>(prefix + `/class-days?date_from=${from}&date_to=${to}`, signal);
            const id = resolveJournalDay(ds.value, selectedDay);
            if (id) {
                res = await readAttendance<Journal>(prefix + `/class-days/${id}/attendance`, signal);
                res.value = { ...res.value, days: ds.value };
                loadedDay = id;
            }
            else {
                res = { revision: ds.revision, value: { organization_id: organizationID, division_id: division, days: [], entries: [], counts_by_type_code: {}, unmarked_is_absent: false } };
            }
        }
        else {
            res = await readAttendance<Journal>(prefix + `/attendance-report?date_from=${from}&date_to=${to}`, signal);
        }
        ;
        if (signal?.aborted || sequence !== loadSequence.current)
            return;
        setTypes(ts.value);
        setStudents(roster.value);
        setJournal(res.value);
        setLoadedScanDay(loadedDay);
        setRevision(res.revision);
    }
    catch (e) {
        if (!signal?.aborted && sequence === loadSequence.current) {
            setError(attendanceError(e));
            setJournal(null);
            setLoadedScanDay(0);
        }
    }
    finally {
        if (sequence === loadSequence.current)
            setLoading(false);
    } }, [division, from, to, selectedDay, scan, organizationID]);
    const action = useAction(reload);
    useContextGuard(Boolean(dayEditor) || Boolean(typeEditor) || camera || periodModal);
    useEffect(() => { const controller = new AbortController(); void Promise.resolve().then(() => { if (!controller.signal.aborted)
        return reload(controller.signal); }); return () => controller.abort(); }, [reload]);
    const edit = permitted(user, division, "attendance", true);
    const mark = edit || user?.role === "proctor";
    const scanEdit = mark || permitted(user, division, "scan", true);
    const actualDay = scan ? loadedScanDay : resolveJournalDay(journal?.days ?? [], selectedDay);
    const display = displayedJournal(journal, scan, actualDay);
    const roster = journalRoster(students, display?.entries ?? []);
    const visibleStudents = filterJournalStudents(roster, filters);
    const classes = Array.from(new Set(roster.flatMap(student => student.class == null ? [] : [student.class]))).sort((a, b) => a - b);
    const groups = new Map<number, Student>();
    const schools = new Map<number, Student>();
    for (const student of roster) {
        if (student.group_id != null && (!groups.has(student.group_id) || student.group_name))
            groups.set(student.group_id, student);
        if (student.school_id != null && (!schools.has(student.school_id) || student.school_name || student.school_short_name))
            schools.set(student.school_id, student);
    }
    const entry = (day: number, account: number) => display?.entries.find(e => e.class_day_id === day && e.account_id === account);
    async function exportReport() { if (!display || loading || scan && !actualDay)
        return; const XLSX = await import("xlsx"); const rows = journalExportRows(display, visibleStudents); const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows, { header: journalExportHeaders(display) }), "Посещаемость"); const exportFrom = scan ? display.days[0]?.date ?? from : from; const exportTo = scan ? exportFrom : to; XLSX.writeFile(book, `Посещаемость_${display.organization_id}_${display.division_id}_${exportFrom}_${exportTo}.xlsx`); }
    async function generateQR() { if (loading || !actualDay) return; setError(""); try {
        const result = await domain<Revision<{
            qr: string;
            expires_at: number;
        }>>(`/attendance/divisions/${division}/class-days/${actualDay}/qr`, { method: "POST", body: "{}" });
        const url = await QRCode.toDataURL(result.value.qr, { width: 220, margin: 2 });
        setQR(url);
        setQRDay(actualDay);
        setQRExpiry(result.value.expires_at);
    }
    catch (e) {
        setError(attendanceError(e));
    } }
    function dayForm(day?: Day) { setEditRevision(revision); setDayEditor(day ?? { id: 0, division_id: division, date: todayISO(), comment: "", lesson_ids: [], has_history: false }); }
    function typeForm(t?: AttendanceType) { setEditRevision(revision); setTypeEditor(t ?? emptyType()); }
    async function setEntry(day: number, account: number, type: number) { const path = `/divisions/${division}/class-days/${day}/attendance`; await action.execute(command(type ? path : path + `/${account}`, type ? "POST" : "DELETE", revision, type ? { account_id: account, attendance_type_id: type } : {})); }
    return <section className={styles.workspace}><header><h1>{scan ? "Сканирование посещаемости" : "Посещаемость"}</h1><p className={styles.muted}>Журнал каждого подразделения хранится отдельно. Пустая ячейка означает «не отмечен».</p></header><div className={styles.toolbar}><label>Подразделение журнала<select value={division} disabled={!!action.pending || !!dayEditor || !!typeEditor} onChange={e => { if (Number(e.target.value) === division) return; setLoading(true); setJournal(null); setTypes([]); setStudents([]); setFilters({ class: "all", group: "all", school: "all" }); setDivision(Number(e.target.value)); setSelectedDay(0); setLoadedScanDay(0); setQR(""); }}>{divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>{onReport && <button className={styles.primary} disabled={loading || action.busy || !!action.pending} onClick={() => setPeriodModal(true)}>Отчёт</button>}<Range from={from} to={to} setFrom={setFrom} setTo={setTo}/><button onClick={() => void reload()} disabled={loading}>Обновить</button><button disabled={!journal || loading || scan && !actualDay} onClick={() => void exportReport()}>Экспорт XLSX</button>{edit && <button className={styles.primary} disabled={loading || action.busy || !!action.pending} onClick={() => dayForm()}>Создать день занятий</button>}{edit && <button disabled={loading || action.busy || !!action.pending} onClick={() => typeForm()}>Добавить тип посещения</button>}</div>
 <div className={styles.toolbar}>
 <label>Класс<select value={filters.class} onChange={e => setFilters({ ...filters, class: e.target.value })}><option value="all">Все классы</option><option value="none">Класс не указан</option>{classes.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
 <label>Группа<select value={filters.group} onChange={e => setFilters({ ...filters, group: e.target.value })}><option value="all">Все группы</option><option value="none">Без группы</option>{Array.from(groups.values()).sort((a, b) => studentGroupLabel(a).localeCompare(studentGroupLabel(b), "ru") || (a.group_id ?? 0) - (b.group_id ?? 0)).map(student => <option key={student.group_id} value={student.group_id ?? "none"}>{studentGroupLabel(student)}</option>)}</select></label>
 <label>Школа<select value={filters.school} onChange={e => setFilters({ ...filters, school: e.target.value })}><option value="all">Все школы</option><option value="none">Школа не указана</option>{Array.from(schools.values()).sort((a, b) => studentSchoolLabel(a).localeCompare(studentSchoolLabel(b), "ru") || (a.school_id ?? 0) - (b.school_id ?? 0)).map(student => <option key={student.school_id} value={student.school_id ?? "none"}>{studentSchoolLabel(student)}</option>)}</select></label>
 <button onClick={() => setFilters({ class: "all", group: "all", school: "all" })}>Сбросить фильтры</button>{journal && <span className={styles.muted}>Показано {visibleStudents.length} из {roster.length} учеников</span>}
 </div>
 {error && <p className={styles.error} role="alert">{error}</p>}<ActionNotice action={action}/>{loading && <p>Загрузка журнала…</p>}
 {(scan || user?.role === "student") && <div className={styles.panel}><label>День посещения<select value={actualDay} disabled={loading} onChange={e => { if (Number(e.target.value) === actualDay) return; setLoading(true); setSelectedDay(Number(e.target.value)); setQR(""); }}>{journal?.days.map(d => <option key={d.id} value={d.id}>{d.date}</option>)}</select></label>{user?.role === "student" && <><button disabled={loading || !actualDay} onClick={() => void generateQR()}>Обновить мой QR-код</button>{qr && qrDay === actualDay && <><Image unoptimized width={220} height={220} className={styles.qr} src={qr} alt="QR-код для посещения выбранного дня"/><p className={styles.muted}>Действует до {new Date(qrExpiry * 1000).toLocaleTimeString("ru-RU")}. Покажите сотруднику код для выбранного дня.</p></>}</>}{scan && scanEdit && <><button disabled={loading || !actualDay} onClick={() => setCamera(true)}>Сканировать камерой</button><form className={styles.form} onSubmit={async (e) => { e.preventDefault(); if (loading || !actualDay) return; await action.execute<Entry>(command(`/divisions/${division}/class-days/${actualDay}/scan`, "POST", revision, { qr: scanToken.trim() }), () => setScanToken("")); }}><label>QR-код ученика<textarea required value={scanToken} onChange={e => setScanToken(e.target.value)} placeholder="Вставьте содержимое отсканированного кода"/></label><button className={styles.primary} disabled={loading || !actualDay || action.busy || !!action.pending}>Отметить по QR</button></form></>}</div>}
 <div className={`${styles.panel} ${styles.tableWrap}`}><table className={styles.table}><thead><tr><th>Ученик</th><th>Класс</th><th>Группа</th><th>Школа</th>{display?.days.map(d => <th key={d.id}>{d.date}{edit && <div className={styles.actions}><button onClick={() => dayForm(d)} disabled={loading || action.busy || !!action.pending}>Изменить день</button><button disabled={d.has_history || action.busy || !!action.pending} title={d.has_history ? "У дня сохранена история" : "Удалить пустой день"} onClick={() => void action.execute(command(`/divisions/${division}/class-days/${d.id}`, "DELETE", revision, {}))}>Удалить день</button></div>}</th>)}</tr></thead><tbody>{visibleStudents.map(student => <tr key={student.account_id}><th scope="row">{student.full_name}</th><td>{student.class ?? "—"}</td><td>{studentGroupLabel(student)}</td><td title={student.school_name ?? undefined}>{studentSchoolLabel(student)}</td>{display?.days.map(d => { const e = entry(d.id, student.account_id); return <td key={d.id}>{mark && !scan ? <select aria-label={`Отметка ${student.full_name} ${d.date}`} value={e?.type.id ?? ""} disabled={loading || e?.zap_id != null || action.busy || !!action.pending} onChange={event => void setEntry(d.id, student.account_id, Number(event.target.value))}><option value="">Не отмечен</option>{journalTypeOptions(types, e).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select> : <span style={e ? { color: e.type.color } : undefined}>{e?.type.mark || e?.type.name || "Не отмечен"}</span>}{e && <p className={styles.muted}>{e.type.name}{e.zap_id != null ? " · отгул" : ""}</p>}</td>; })}</tr>)}</tbody></table>{journal && !journal.days.length && <p>В выбранном периоде нет дней занятий.</p>}{journal && journal.days.length > 0 && !roster.length && <p>Доступных учеников пока нет.</p>}{journal && roster.length > 0 && !visibleStudents.length && <p>По выбранным фильтрам учеников нет.</p>}</div>
 <div className={styles.panel}><h2>Типы посещения</h2><div className={styles.cards}>{types.map(t => <div key={t.id} className={styles.event} style={{ borderLeftColor: t.color }}><strong>{t.mark && `${t.mark} · `}{t.name} {!t.is_active && "· архив"}</strong><span className={styles.muted}>{t.counts_as_present ? "Присутствие" : t.counts_as_absent ? "Отсутствие" : "Без подсчёта присутствия"}{t.is_excused ? " · уважительная причина" : ""}{t.scan_default ? " · для сканирования" : ""}{t.zap_default ? " · для отгулов" : ""}</span>{edit && <div className={styles.actions}><button disabled={loading || action.busy || !!action.pending} onClick={() => typeForm(t)}>Изменить тип</button>{t.is_active && <button disabled={loading || action.busy || !!action.pending} onClick={() => void action.execute(command(`/divisions/${division}/attendance-types/${t.id}`, "DELETE", revision, {}))}>Архивировать тип</button>}</div>}</div>)}</div></div>
 {periodModal && <PeriodModal onClose={() => setPeriodModal(false)} onCreate={period => { setPeriodModal(false); onReport?.(division, period); }} />}
 {dayEditor && <div className={styles.modal}><form role="dialog" aria-modal="true" aria-label="День занятий" className={styles.dialog} onSubmit={async (e) => { e.preventDefault(); const input = { date: dayEditor.date, comment: dayEditor.comment, lesson_ids: dayEditor.lesson_ids }; await action.execute(command(`/divisions/${division}/class-days${dayEditor.id ? `/${dayEditor.id}` : ""}`, dayEditor.id ? "PUT" : "POST", editRevision, input), () => setDayEditor(null)); }}><h2>{dayEditor.id ? "Изменить день занятий" : "Новый день занятий"}</h2><label>Дата дня занятий<input type="date" required disabled={dayEditor.has_history} value={dayEditor.date} onChange={e => setDayEditor({ ...dayEditor, date: e.target.value })}/></label><label>Комментарий<textarea maxLength={500} value={dayEditor.comment} onChange={e => setDayEditor({ ...dayEditor, comment: e.target.value })}/></label>{dayEditor.has_history && <p className={styles.muted}>Дата защищена историей посещений.</p>}<ActionNotice action={action}/><div className={styles.actions}><button className={styles.primary} disabled={loading || action.busy || !!action.pending}>Сохранить день</button><button type="button" disabled={loading || action.busy || !!action.pending} onClick={() => setDayEditor(null)}>Закрыть</button></div></form></div>}
 {typeEditor && <div className={styles.modal}><form role="dialog" aria-modal="true" aria-label="Тип посещения" className={styles.dialog} onSubmit={async (e) => { e.preventDefault(); await action.execute(command(`/divisions/${division}/attendance-types${typeEditor.id ? `/${typeEditor.id}` : ""}`, typeEditor.id ? "PUT" : "POST", editRevision, typeInput(typeEditor)), () => setTypeEditor(null)); }}><h2>{typeEditor.id ? "Изменить тип посещения" : "Новый тип посещения"}</h2><div className={styles.grid}><label>Название типа<input required maxLength={100} value={typeEditor.name} onChange={e => setTypeEditor({ ...typeEditor, name: e.target.value })}/></label><label>Код типа<input required pattern="[a-z][a-z0-9_]{0,63}" disabled={!!typeEditor.id} value={typeEditor.code} onChange={e => setTypeEditor({ ...typeEditor, code: e.target.value })}/></label><label>Обозначение<input maxLength={8} value={typeEditor.mark} onChange={e => setTypeEditor({ ...typeEditor, mark: e.target.value })}/></label><label>Цвет типа<input type="color" value={typeEditor.color} onChange={e => setTypeEditor({ ...typeEditor, color: e.target.value })}/></label><label>Порядок<input type="number" min={0} max={10000} value={typeEditor.sort_order} onChange={e => setTypeEditor({ ...typeEditor, sort_order: Number(e.target.value) })}/></label></div><div className={styles.checks}>{(["is_active", "counts_as_present", "counts_as_absent", "is_excused", "scan_default", "zap_default"] as const).map((key, i) => <label key={key}><input type="checkbox" checked={typeEditor[key]} onChange={e => setTypeEditor({ ...typeEditor, [key]: e.target.checked, ...(key === "counts_as_present" && e.target.checked ? { counts_as_absent: false } : {}), ...(key === "counts_as_absent" && e.target.checked ? { counts_as_present: false } : {}) })}/>{["Активен", "Присутствовал", "Отсутствовал", "Уважительная причина", "Для сканирования", "Для отгулов"][i]}</label>)}</div><p className={styles.muted}>Изменения применятся к новым отметкам. Ранее записанные название и свойства сохранятся.</p><ActionNotice action={action}/><div className={styles.actions}><button className={styles.primary} disabled={loading || action.busy || !!action.pending}>Сохранить тип</button><button type="button" disabled={loading || action.busy || !!action.pending} onClick={() => setTypeEditor(null)}>Закрыть</button></div></form></div>}
 {camera && <AttendanceCamera onRead={code => { setScanToken(code); setCamera(false); }} onClose={() => setCamera(false)}/>}
 </section>;
}
