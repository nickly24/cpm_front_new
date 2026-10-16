"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import { StudentCalendar } from "@/components/student/schedule/student-calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { attendanceError, command, groupOverlaps, ownDivisions, permitted, readAttendance, type AvailableCalendar, type Event, type Lesson, type Schedule } from "@/lib/bff/attendance";
import { todayISO, getFetchRange } from "@/lib/schedule/utils";
import { ActionNotice, Range, styles, useAction } from "./shared";
type Batch = {
    creates: Lesson[];
    updates: Lesson[];
    deletes: {
        id: number;
        division_id: number;
    }[];
};
const emptyBatch = (): Batch => ({ creates: [], updates: [], deletes: [] });
interface References {
    groups: {
        id: number;
        name: string;
    }[];
    teachers: {
        account_id: number;
        full_name: string;
    }[];
    schools: {
        id: number;
        name: string;
    }[];
    rooms: {
        id: number;
        name: string;
    }[];
}
const blank = (division: number, date: string): Lesson => ({ id: 0, division_id: division, date, start_time: "09:00", end_time: "10:00", lesson_name: "", teacher_name: "", location: "", classroom: "", color: "#23884c", is_changed: false, is_in_person: true, is_for_all: true, is_public: true, school_id: null, target_group_ids: [], teacher_account_id: null, room_resource_id: null });
export function AttendanceCalendar() {
    const { user } = useAuth();
    return user?.role === "student" ? <StudentCalendar /> : <StaffAttendanceCalendar />;
}
function StaffAttendanceCalendar() {
    const { user } = useAuth();
    const organizationID = user?.organization_id ?? 0;
    const loadSequence = useRef(0);
    const [date, setDate] = useState(todayISO);
    const [view, setView] = useState<"day" | "week" | "month">("week");
    const initial = getFetchRange(todayISO(), "week");
    const [from, setFrom] = useState(initial.dateFrom);
    const [to, setTo] = useState(initial.dateTo);
    const [mode, setMode] = useState(user?.role === "student" ? "personal" : "overlay");
    const [selected, setSelected] = useState<number[] | null>(user?.division_id ? [user.division_id] : null);
    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [revision, setRevision] = useState(0);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [draft, setDraft] = useState<Lesson | null>(null);
    const [batch, setBatch] = useState<Batch>(emptyBatch);
    const [draftRevision, setDraftRevision] = useState<number | null>(null);
    const [config, setConfig] = useState(false);
    const [configRevision, setConfigRevision] = useState(0);
    const [configDivision, setConfigDivision] = useState(user?.division_id ?? ownDivisions(user)[0]?.id ?? 0);
    const [visibility, setVisibility] = useState("closed");
    const [timezone, setTimezone] = useState("Europe/Moscow");
    const [refs, setRefs] = useState<References | null>(null);
    const total = batch.creates.length + batch.updates.length + batch.deletes.length;
    const reload = useCallback(async (signal?: AbortSignal) => { const sequence = ++loadSequence.current; setLoading(true); setError(""); try {
        const c = await readAttendance<AvailableCalendar[]>("/calendars", signal);
        if (signal?.aborted || sequence !== loadSequence.current)
            return;
        const chosen = (selected ?? c.value.slice(0, 1).map(c => c.division_id)).filter(id => c.value.some(c => c.division_id === id));
        setSchedule(prev => ({ organization_id: organizationID, calendars: c.value, events: prev?.events ?? [], overlap_clusters: prev?.overlap_clusters ?? [] }));
        const path = mode === "personal" ? "/me/schedule" : `/schedule?division_ids=${chosen.join(",")}`;
        if (mode !== "personal" && !chosen.length) {
            setSchedule({ organization_id: organizationID, calendars: c.value, events: [], overlap_clusters: [] });
            setRevision(c.revision);
            return;
        }
        ;
        const res = await readAttendance<Schedule>(`${path}${path.includes("?") ? "&" : "?"}date_from=${from}&date_to=${to}`, signal);
        if (signal?.aborted || sequence !== loadSequence.current)
            return;
        setSchedule(res.value);
        setRevision(res.revision);
    }
    catch (e) {
        if (!signal?.aborted && sequence === loadSequence.current)
            setError(attendanceError(e));
    }
    finally {
        if (sequence === loadSequence.current)
            setLoading(false);
    } }, [selected, mode, from, to, organizationID]);
    const action = useAction(reload);
    useContextGuard(draft !== null || config || total > 0);
    useEffect(() => { const controller = new AbortController(); void Promise.resolve().then(() => { if (!controller.signal.aborted)
        return reload(controller.signal); }); return () => controller.abort(); }, [reload]);
    const editorDivision = draft?.division_id;
    useEffect(() => { if (!editorDivision)
        return; let active = true; void readAttendance<References>(`/divisions/${editorDivision}/schedule-references`).then(r => { if (active)
        setRefs(r.value); }).catch(e => { if (active)
        setError(attendanceError(e)); }); return () => { active = false; }; }, [editorDivision]);
    const editable = (schedule?.calendars ?? []).filter(c => c.can_edit);
    const configureDivisions = ownDivisions(user).filter(d => permitted(user, d.id, "schedule", true));
    function openDraft(lesson: Lesson) { if (draftRevision === null)
        setDraftRevision(revision); setDraft(lesson); setRefs(null); }
    function chooseConfig(division: number) { const current = schedule?.calendars.find(c => c.division_id === division); setConfigDivision(division); setVisibility(current?.visibility ?? "closed"); setTimezone(current?.timezone ?? "Europe/Moscow"); }
    function stage(lesson: Lesson) { if (draftRevision === null)
        setDraftRevision(revision); setBatch(b => lesson.id ? { ...b, updates: [...b.updates.filter(l => l.id !== lesson.id), lesson], deletes: b.deletes.filter(l => l.id !== lesson.id) } : { ...b, creates: [...b.creates, lesson] }); setDraft(null); setRefs(null); }
    function remove(event: Event) { if (draftRevision === null)
        setDraftRevision(revision); setBatch(b => ({ ...b, updates: b.updates.filter(l => l.id !== event.id), deletes: [...b.deletes.filter(l => l.id !== event.id), { id: event.id, division_id: event.division_id }] })); }
    function shiftDate(v: string, kind: "day" | "week" | "month") { setDate(v); setView(kind); const range = getFetchRange(v, kind); setFrom(range.dateFrom); setTo(range.dateTo); }
    async function save() { const clean = { ...batch, creates: batch.creates.map(({ id, ...l }) => { void id; return l; }) }; await action.execute(command("/schedule/bulk", "POST", draftRevision ?? revision, clean), () => { setBatch(emptyBatch()); setDraftRevision(null); }); }
    const card = (event: Event) => <article key={event.id} className={styles.event} style={{ borderLeftColor: event.color }}><div className={styles.eventHeader}><strong>{event.start_time}–{event.end_time} · {event.lesson_name}</strong><span className={styles.badge}>{event.division_name || `Подразделение ${event.division_id}`}</span></div><span>{event.date} · {event.teacher_name}</span><span className={styles.muted}>{event.location} · {event.classroom} · {event.is_in_person ? "Очно" : "Дистанционно"} · {event.timezone}</span>{event.is_changed && <span className={styles.muted}>Расписание изменено</span>}{permitted(user, event.division_id, "schedule", true) && <div className={styles.actions}><button disabled={loading || action.busy || !!action.pending} onClick={() => { const { organization_id, division_name, timezone, starts_at, ends_at, ...l } = event; void organization_id; void division_name; void timezone; void starts_at; void ends_at; openDraft(l); }}>Изменить занятие</button><button disabled={loading || action.busy || !!action.pending} onClick={() => remove(event)}>Убрать из расписания</button></div>}</article>;
    return <section className={styles.workspace}><header><h1>Расписание</h1><p className={styles.muted}>Организация: {user?.organizations?.find(o => o.id === user.organization_id)?.name}. Календари можно выбирать независимо от кабинета.</p></header><div className={styles.toolbar}><label>Дата<input type="date" value={date} onChange={e => e.target.value && shiftDate(e.target.value, view)}/></label><label>Вид<select value={view} onChange={e => shiftDate(date, e.target.value as typeof view)}><option value="day">День</option><option value="week">Неделя</option><option value="month">Месяц</option></select></label><Range from={from} to={to} setFrom={setFrom} setTo={setTo}/><button onClick={() => void reload()} disabled={loading}>Обновить</button>{editable.length > 0 && <button className={styles.primary} disabled={loading || action.busy || !!action.pending} onClick={() => { openDraft(blank(editable[0].division_id, date)); }}>Добавить занятие</button>}{configureDivisions.length > 0 && <button disabled={loading || total > 0 || action.busy || !!action.pending} onClick={() => { chooseConfig(configureDivisions.some(d => d.id === configDivision) ? configDivision : configureDivisions[0].id); setConfigRevision(revision); setConfig(true); }}>Настроить календарь</button>}</div>
 <div className={styles.panel}>{user?.role === "student" && <div className={styles.tabs}><button aria-pressed={mode === "personal"} onClick={() => setMode("personal")}>Моё общее расписание</button><button aria-pressed={mode === "overlay"} onClick={() => setMode("overlay")}>Выбранные календари</button></div>}<div className={styles.checks}>{schedule?.calendars.map(c => <label key={c.division_id}><input type="checkbox" disabled={mode === "personal"} checked={mode === "personal" ? c.is_member : (selected === null ? schedule.calendars[0]?.division_id === c.division_id : selected.includes(c.division_id))} onChange={e => { setMode("overlay"); setSelected(old => { const current = old ?? schedule.calendars.slice(0, 1).map(c => c.division_id); return e.target.checked ? [...current, c.division_id] : current.filter(id => id !== c.division_id); }); }}/>{c.division_name || `Подразделение ${c.division_id}`} {!c.is_member && <span className={styles.muted}>Доступный календарь</span>}</label>)}</div>{!schedule?.calendars.length && !loading && <p>Календари ещё не настроены.</p>}</div>
 {total > 0 && <div className={styles.panel}><h2>Изменения к сохранению · {total}</h2><p>Добавлений: {batch.creates.length}, изменений: {batch.updates.length}, удалений: {batch.deletes.length}. Все изменения сохранятся вместе.</p><div className={styles.actions}><button className={styles.primary} disabled={loading || action.busy || !!action.pending} onClick={() => void save()}>Сохранить пакет</button><button disabled={loading || action.busy || !!action.pending} onClick={() => { setBatch(emptyBatch()); setDraftRevision(null); }}>Отменить пакет</button></div></div>}
 {error && <p role="alert" className={styles.error}>{error}</p>}<ActionNotice action={action}/>{loading && <p aria-live="polite">Загрузка расписания…</p>}<div className={styles.cards}>{schedule && groupOverlaps(schedule).map(group => group.events.length > 1 ? <details key={group.ids.join("-")} className={styles.cluster}><summary>Пересечение · {group.events.length} занятия · {group.events[0].date} · {group.events[0].start_time}</summary><div className={styles.cards}>{group.events.map(card)}</div></details> : group.events.map(card))}{schedule && !loading && !schedule.events.length && <p>В выбранном периоде нет доступных занятий.</p>}</div>
 {draft && <div className={styles.modal}><form className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="lesson-title" onSubmit={e => { e.preventDefault(); stage(draft); }}><h2 id="lesson-title">{draft.id ? "Изменить занятие" : "Новое занятие"}</h2><div className={styles.grid}><label>Подразделение<select value={draft.division_id} disabled={!!draft.id} onChange={e => { setDraft({ ...draft, division_id: Number(e.target.value), target_group_ids: [], teacher_account_id: null }); setRefs(null); }}>{editable.map(c => <option key={c.division_id} value={c.division_id}>{c.division_name}</option>)}</select></label><label>Название<input required maxLength={200} value={draft.lesson_name} onChange={e => setDraft({ ...draft, lesson_name: e.target.value })}/></label><label>Дата занятия<input required type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })}/></label><label>Начало<input required type="time" value={draft.start_time} onChange={e => setDraft({ ...draft, start_time: e.target.value })}/></label><label>Окончание<input required type="time" value={draft.end_time} onChange={e => setDraft({ ...draft, end_time: e.target.value })}/></label><label>Преподаватель<input required maxLength={200} value={draft.teacher_name} onChange={e => setDraft({ ...draft, teacher_name: e.target.value })}/></label><label>Сотрудник<select value={draft.teacher_account_id ?? ""} onChange={e => setDraft({ ...draft, teacher_account_id: e.target.value ? Number(e.target.value) : null })}><option value="">Только отображаемое имя</option>{refs?.teachers.map(t => <option key={t.account_id} value={t.account_id}>{t.full_name}</option>)}</select></label><label>Место<input required maxLength={200} value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })}/></label><label>Аудитория<input required maxLength={50} value={draft.classroom} onChange={e => setDraft({ ...draft, classroom: e.target.value })}/></label><label>Помещение<select value={draft.room_resource_id ?? ""} onChange={e => setDraft({ ...draft, room_resource_id: e.target.value ? Number(e.target.value) : null })}><option value="">Только отображаемая аудитория</option>{refs?.rooms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Цвет<input type="color" value={draft.color} onChange={e => setDraft({ ...draft, color: e.target.value })}/></label></div><div className={styles.checks}>{(["is_in_person", "is_changed", "is_public", "is_for_all"] as const).map((k, i) => <label key={k}><input type="checkbox" checked={draft[k]} onChange={e => setDraft({ ...draft, [k]: e.target.checked, ...(k === "is_public" && e.target.checked ? { school_id: null } : {}), ...(k === "is_for_all" && e.target.checked ? { target_group_ids: [] } : {}) })}/>{["Очно", "Изменено", "Для любой школы", "Для всех групп"][i]}</label>)}</div>{!draft.is_public && <label>Школа<select required value={draft.school_id ?? ""} onChange={e => setDraft({ ...draft, school_id: Number(e.target.value) })}><option value="">Выберите школу</option>{refs?.schools.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}{!draft.is_for_all && <div className={styles.checks}>{refs?.groups.map(g => <label key={g.id}><input type="checkbox" checked={draft.target_group_ids.includes(g.id)} onChange={e => setDraft({ ...draft, target_group_ids: e.target.checked ? [...draft.target_group_ids, g.id] : draft.target_group_ids.filter(id => id !== g.id) })}/>{g.name}</label>)}</div>}<div className={styles.actions}><button className={styles.primary} disabled={!refs || !draft.is_for_all && !draft.target_group_ids.length}>Добавить в пакет</button><button type="button" onClick={() => { setDraft(null); if (!total)
        setDraftRevision(null); }}>Закрыть</button></div></form></div>}
 {config && <div className={styles.modal}><form role="dialog" aria-modal="true" className={styles.dialog} aria-label="Настройка календаря" onSubmit={async (e) => { e.preventDefault(); await action.execute(command(`/divisions/${configDivision}/calendar`, "PUT", configRevision, { visibility, timezone }), () => setConfig(false)); }}><h2>Настройка календаря</h2><label>Подразделение<select value={configDivision} onChange={e => chooseConfig(Number(e.target.value))}>{configureDivisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Доступ к календарю<select value={visibility} onChange={e => setVisibility(e.target.value)}><option value="closed">Участники подразделения</option><option value="organization">Участники организации</option></select></label><label>Часовой пояс<select value={timezone} onChange={e => setTimezone(e.target.value)}>{["Europe/Moscow", "Asia/Yekaterinburg", "Asia/Novosibirsk", "Asia/Vladivostok", "UTC"].map(z => <option key={z}>{z}</option>)}</select></label><p className={styles.muted}>Доступ к календарю не открывает журнал посещаемости. Пересечения занятий разрешены.</p><ActionNotice action={action}/><div className={styles.actions}><button className={styles.primary} disabled={loading || action.busy || !!action.pending}>Сохранить календарь</button><button type="button" disabled={loading || action.busy || !!action.pending} onClick={() => setConfig(false)}>Закрыть</button></div></form></div>}
 </section>;
}
