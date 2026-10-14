import { domain } from "./client";
import type { User } from "@/lib/auth/types";
export interface Revision<T> {
    revision: number;
    value: T;
}
export interface AvailableCalendar {
    division_id: number;
    division_name: string;
    visibility: "closed" | "organization";
    timezone: string;
    is_member: boolean;
    can_edit: boolean;
}
export interface Lesson {
    id: number;
    division_id: number;
    date: string;
    start_time: string;
    end_time: string;
    lesson_name: string;
    teacher_name: string;
    location: string;
    classroom: string;
    color: string;
    is_changed: boolean;
    is_in_person: boolean;
    is_for_all: boolean;
    is_public: boolean;
    school_id: number | null;
    target_group_ids: number[];
    teacher_account_id: number | null;
    room_resource_id: number | null;
}
export interface Event extends Lesson {
    organization_id: number;
    division_name: string;
    timezone: string;
    starts_at: string;
    ends_at: string;
}
export interface Schedule {
    organization_id: number;
    calendars: AvailableCalendar[];
    events: Event[];
    overlap_clusters: {
        lesson_ids: number[];
        resource_kinds: string[];
    }[];
}
export interface AttendanceType {
    id: number;
    division_id: number;
    version: number;
    code: string;
    name: string;
    color: string;
    mark: string;
    sort_order: number;
    is_active: boolean;
    counts_as_present: boolean;
    counts_as_absent: boolean;
    is_excused: boolean;
    scan_default: boolean;
    zap_default: boolean;
}
export interface Day {
    id: number;
    division_id: number;
    date: string;
    comment: string;
    lesson_ids: number[];
    has_history: boolean;
}
export interface Entry {
    id: number;
    division_id: number;
    class_day_id: number;
    account_id: number;
    group_id: number | null;
    full_name: string;
    type: AttendanceType;
    zap_id: number | null;
    is_deleted: boolean;
    updated_at: string;
}
export interface Journal {
    organization_id: number;
    division_id: number;
    days: Day[];
    entries: Entry[];
    counts_by_type_code: Record<string, number>;
    unmarked_is_absent: false;
}
export interface Student {
    account_id: number;
    profile_id: number;
    role: string;
    full_name: string;
    group_id: number | null;
    group_name: string | null;
    class: number | null;
    school_id: number | null;
    school_name: string | null;
    school_short_name: string | null;
}
export interface JournalFilters {
    class: string;
    group: string;
    school: string;
}
export function journalRoster(students: Student[], entries: Entry[]): Student[] {
    const known = new Map(students.map(student => [student.account_id, student]));
    for (const entry of entries) {
        if (!known.has(entry.account_id)) {
            // Entries contain historical identity and type snapshots, not profile metadata.
            known.set(entry.account_id, {
                account_id: entry.account_id, profile_id: 0, role: "student",
                full_name: entry.full_name, group_id: entry.group_id, group_name: null,
                class: null, school_id: null, school_name: null, school_short_name: null,
            });
        }
    }
    return Array.from(known.values());
}
export function filterJournalStudents(students: Student[], filters: JournalFilters): Student[] {
    const matches = (value: number | null, filter: string) => filter === "all" || (value == null ? "none" : String(value)) === filter;
    return students.filter(student => matches(student.class, filters.class) && matches(student.group_id, filters.group) && matches(student.school_id, filters.school));
}
export function studentGroupLabel(student: Student): string {
    return student.group_name || (student.group_id == null ? "—" : `Группа #${student.group_id}`);
}
export function studentSchoolLabel(student: Student): string {
    return student.school_short_name || student.school_name || (student.school_id == null ? "—" : `Школа #${student.school_id}`);
}
export function journalExportHeaders(journal: Journal): string[] {
    return ["Организация ID", "Подразделение ID", "Ученик", "Класс", "Группа", "Школа", "Краткое название школы", ...journal.days.map(day => day.date)];
}
export function journalExportRows(journal: Journal, visibleStudents: Student[]): Record<string, string | number>[] {
    const entries = new Map(journal.entries.map(entry => [`${entry.class_day_id}:${entry.account_id}`, entry]));
    return visibleStudents.map(student => ({
        "Организация ID": journal.organization_id,
        "Подразделение ID": journal.division_id,
        "Ученик": student.full_name,
        "Класс": student.class ?? "—",
        "Группа": studentGroupLabel(student),
        "Школа": student.school_name || studentSchoolLabel(student),
        "Краткое название школы": student.school_short_name || "—",
        ...Object.fromEntries(journal.days.map(day => [day.date, entries.get(`${day.id}:${student.account_id}`)?.type.name ?? "Не отмечен"])),
    }));
}
export function journalTypeOptions(types: AttendanceType[], entry?: Entry): { id: number; name: string }[] {
    const options = types.filter(type => type.is_active).map(type => ({
        id: type.id,
        name: entry?.type.id === type.id ? entry.type.name : type.name,
    }));
    if (entry && !options.some(option => option.id === entry.type.id))
        options.unshift({ id: entry.type.id, name: `${entry.type.name} · архив` });
    return options;
}
export interface Zap {
    id: number;
    division_id: number;
    account_id: number;
    text: string;
    status: "pending" | "approved" | "rejected";
    answer: string;
    dates: {
        date: string;
        status: string;
        class_day_id: number | null;
    }[];
}
export interface OwnDivision {
    id: number;
    name: string;
    group_id?: number | null;
    permissions?: Record<string, {
        view: boolean;
        edit: boolean;
    }>;
}
export function ownDivisions(user: User | null): OwnDivision[] { return (user?.organizations?.find(o => o.id === user.organization_id)?.divisions ?? []) as OwnDivision[]; }
export function permitted(user: User | null, division: number, section: string, edit = false): boolean { if (user?.role === "admin" && user.organization_admin)
    return true; const d = ownDivisions(user).find(d => d.id === division); if (user?.role !== "staff_admin" || !d)
    return false; const p = d.permissions?.[section]; return p?.view === true && (!edit || p.edit === true); }
export async function readAttendance<T>(path: string, signal?: AbortSignal): Promise<Revision<T>> { return domain<Revision<T>>(`/attendance${path}`, { signal }); }
export interface Command {
    path: string;
    method: string;
    revision: number;
    data: unknown;
    key: string;
}
export function command(path: string, method: string, revision: number, data: unknown): Command { return { path, method, revision, data, key: crypto.randomUUID() }; }
export async function sendAttendance<T>(c: Command): Promise<Revision<T>> { return domain<Revision<T>>(`/attendance${c.path}`, { method: c.method, headers: { "Idempotency-Key": c.key }, body: JSON.stringify({ expected_revision: c.revision, data: c.data }) }); }
export function attendanceError(error: unknown): string { const e = error as {
    code?: string;
    message?: string;
}; const labels: Record<string, string> = { core_history_guard_required: "Сохранение посещений и отгулов пока недоступно.", revision_conflict: "Данные изменились. Обновите список и проверьте свои изменения.", day_has_history: "У дня есть история посещений: его нельзя удалить или перенести.", attendance_linked_to_zap: "Отметка связана с отгулом. Сначала отвяжите дату в заявке.", type_code_immutable: "Код типа нельзя менять после создания.", default_type_exists: "Для сканирования или отгулов уже выбран другой активный тип.", attendance_already_marked: "Дата связана с другим отгулом. Сначала отвяжите её в той заявке.", class_day_exists: "День занятий с этой датой уже существует.", forbidden: "Недостаточно прав в этом подразделении.", not_found: "Запись недоступна или отсутствует.", transport_error: "Ответ не получен. Повторите ту же команду, чтобы проверить результат.", dependency_unavailable: "Сервис временно недоступен. Повторите ту же команду.", invalid_lesson: "Проверьте поля занятия, время и адресные группы.", invalid_type: "Проверьте название, код и свойства типа.", scan_default_type_required: "Выберите активный тип для сканирования.", expired_or_invalid_qr: "QR-код истёк или недействителен. Попросите ученика обновить его.", invalid_qr: "QR-код недействителен.", qr_scope_mismatch: "QR-код относится к другому дню или подразделению." }; return e?.code && labels[e.code] || e?.message || "Не удалось выполнить действие"; }
export function groupOverlaps(schedule: Schedule): {
    ids: number[];
    events: Event[];
}[] { const used = new Set<number>(); const groups = schedule.overlap_clusters.map(c => ({ ids: c.lesson_ids, events: schedule.events.filter(e => c.lesson_ids.includes(e.id)) })); for (const g of groups)
    for (const id of g.ids)
        used.add(id); for (const e of schedule.events)
    if (!used.has(e.id))
        groups.push({ ids: [e.id], events: [e] }); return groups.sort((a, b) => (a.events[0]?.starts_at ?? "").localeCompare(b.events[0]?.starts_at ?? "")); }
export function typeInput(t: AttendanceType) { const { id: unusedId, division_id: unusedDivision, version: unusedVersion, ...input } = t; void unusedId; void unusedDivision; void unusedVersion; return input; }
export function lessonInput(l: Lesson) { const { id: unused, ...input } = l; void unused; return input; }
