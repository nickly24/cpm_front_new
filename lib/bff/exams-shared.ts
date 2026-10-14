/** Translation at the UI boundary. IDs of people are auth account IDs. */
import { domain, getIdentity } from "./client";
import type { Assignment, AttemptResult, Config, Direction, ExamSummary, Grade, OutsideResult, Page, Part, Person, Readiness, Validation, BankQuestion } from "@/lib/exams-v2/types";
export type OwnerRecord = Record<string, unknown>;
export const record = (value: unknown): OwnerRecord => value && typeof value === "object" && !Array.isArray(value) ? value as OwnerRecord : {};
export const records = (value: unknown): OwnerRecord[] => Array.isArray(value) ? value.map(record) : [];
export const number = (value: unknown, fallback = 0): number => typeof value === "number" && Number.isFinite(value) ? value : fallback;
export const string = (value: unknown, fallback = ""): string => typeof value === "string" ? value : fallback;
export const nullableString = (value: unknown): string | null => typeof value === "string" && value ? value : null;
export function ownerPerson(value: unknown): Person { const v = record(value), id = number(v.account_id); return { id, fullName: string(v.full_name, `Аккаунт ${id}`), login: nullableString(v.login) }; }
export function ownerPage<T>(items: T[], total: number, limit = 20, offset = 0): Page<T> { const page = Math.floor(offset / limit) + 1, totalPages = Math.max(1, Math.ceil(total / limit)); return { items, pagination: { page, limit, total, totalPages, hasNext: offset + limit < total, hasPrev: offset > 0 } }; }
export function clientPage<T>(items: T[], params: Record<string, unknown>): Page<T> { const limit = Math.max(1, Math.min(200, Number(params.limit) || 20)), page = Math.max(1, Number(params.page) || 1), offset = (page - 1) * limit; return ownerPage(items.slice(offset, offset + limit), items.length, limit, offset); }
export async function examsAllPages(path: string, signal?: AbortSignal): Promise<OwnerRecord[]> { const out: OwnerRecord[] = []; for (let offset = 0; offset <= 100000; offset += 200) {
    const page = record(await domain<unknown>(`${path}${path.includes("?") ? "&" : "?"}limit=200&offset=${offset}`, { signal }));
    const items = records(page.items);
    out.push(...items);
    if (out.length >= number(page.total))
        return out;
    if (!items.length)
        throw new Error("Список экзаменов изменился. Обновите страницу.");
} throw new Error("Уточните фильтры: список экзаменов слишком большой."); }
export async function examsDirections(signal?: AbortSignal): Promise<Direction[]> { const result = await domain<unknown>("/core/directions", { signal }); return records(result).filter(v => v.is_active !== false && v.is_active !== 0).map(v => ({ id: number(v.id), name: string(v.name) })); }
export function selectedExamDivision(): number { const id = getIdentity()?.user.division_id; if (!id)
    throw new Error("Выберите подразделение"); return id; }
export function examContextKey(): string { const i = getIdentity(); return `${i?.user.account_id}:${i?.user.organization_id}:${i?.user.division_id}:${i?.context_revision}`; }
export async function examDetail(id: number, signal?: AbortSignal): Promise<OwnerRecord> { return record(await domain<unknown>(`/exams/${id}`, { signal })); }
export function ownerValidation(value: unknown): Validation[] { return Array.isArray(value) ? value.map(v => { const r = record(v), code = typeof v === "string" ? v : string(r.code); return { code, message: string(r.message, code), field: nullableString(r.field) ?? undefined, details: r }; }) : []; }
export function ownerReadiness(value: unknown): Readiness { const v = record(value); return { ...v, ready: v.configured === true || v.is_configured === true, canPrepare: v.can_prepare === true, canStart: v.can_start_now === true, errors: ownerValidation(v.errors ?? v.reasons ?? v.issues), warnings: ownerValidation(v.warnings) }; }
export function ownerConfig(value: unknown, examId: number): Config { const v = record(value); return { examId, startAt: nullableString(v.start_at), endAt: nullableString(v.end_at), fractionalMode: nullableString(v.fractional_mode) as Config["fractionalMode"], tieBreakerSourceMode: nullableString(v.tie_breaker_source_mode) as Config["tieBreakerSourceMode"], tieBreakerPartId: number(v.tie_breaker_part_id) || null, tieBreakerHalfMode: nullableString(v.tie_breaker_half_mode) as Config["tieBreakerHalfMode"], configVersion: number(v.revision) }; }
export function ownerPart(value: unknown): Part { const v = record(value); return { id: number(v.id), code: string(v.code), questionWeight: number(v.weight), questionCount: number(v.quota), bankSize: number(v.bank_size), version: number(v.revision) }; }
export function ownerQuestion(value: unknown, parts: Part[] = []): BankQuestion { const v = record(value); return { id: number(v.id), partId: number(v.part_id), partCode: parts.find(p => p.id === number(v.part_id))?.code ?? string(v.part_code), questionText: string(v.question_text), answerText: string(v.answer_text), version: number(v.revision) }; }
export function examCalendarDate(startAt: string | null): string | null {
    const timestamp = startAt ? Date.parse(startAt) : NaN;
    return Number.isFinite(timestamp) ? new Date(timestamp + 3 * 60 * 60 * 1000).toISOString().slice(0, 10) : null;
}
export function adequateExamSummary(value: OwnerRecord): boolean {
    return typeof value.name === "string" && Object.hasOwn(value, "exam_date") &&
        (value.exam_type === "outside_lms" || Object.hasOwn(value, "start_at") && Object.hasOwn(value, "end_at"));
}
export function ownerExam(value: unknown, directions: Direction[] = []): ExamSummary {
    const v = record(value), c = record(v.config ?? v.exam_window), kind = v.exam_type === "outside_lms" ? "outside_lms" : "classic";
    const startAt = nullableString(Object.hasOwn(v, "start_at") ? v.start_at : c.start_at);
    const endAt = nullableString(Object.hasOwn(v, "end_at") ? v.end_at : c.end_at);
    const date = nullableString(v.date);
    const examDate = Object.hasOwn(v, "exam_date") ? nullableString(v.exam_date) : kind === "outside_lms" ? date : examCalendarDate(startAt);
    const readiness = kind === "outside_lms" ? "not_applicable" : !v.readiness || typeof v.readiness !== "object" ? "unknown" : ownerReadiness(v.readiness).ready ? "ready" : "incomplete";
    return { id: number(v.id), examType: kind, directionId: number(v.direction_id) || null, directionName: directions.find(d => d.id === number(v.direction_id))?.name ?? string(v.name, "Экзамен"), legacyName: null, date, examDate, startAt, endAt, readiness, version: number(v.revision), trainingEnabled: v.training_enabled === true, createdAt: nullableString(v.created_at) ?? undefined, name: string(v.name), ownerDivisionId: number(v.owner_division_id), connectedDivisionIds: Array.isArray(v.connected_division_ids) ? v.connected_division_ids.map(x => number(x)) : [], connected: v.connected === undefined ? Array.isArray(v.connected_division_ids) && v.connected_division_ids.includes(getIdentity()?.user.division_id) : v.connected === true, inBank: v.in_bank === true, originExamId: number(v.origin_exam_id) || null };
}
export function ownerAssignment(value: unknown): Assignment { const v = record(value); return { id: number(v.id), student: ownerPerson(v.student), attemptNo: number(v.attempt_no, 1) as 1 | 2, sourceCommissionId: number(v.commission_id) || null, commissionName: string(v.commission_name), members: records(v.members).map(ownerPerson), replacementLimit: number(v.replacement_limit), privilegeVersion: number(v.privilege_revision), status: string(v.status, "not_started") as Assignment["status"], attemptId: number(v.attempt_id) || null, version: number(v.revision), historyGeneration: number(v.history_generation) }; }
export function ownerResult(value: unknown): AttemptResult { const v = record(value); return { attemptId: number(v.id ?? v.attempt_id), attemptNo: number(v.attempt_no, 1) as 1 | 2, rawTotal: number(v.raw_total), roundedTotal: number(v.rounded_total), maxScore: number(v.max_score), grade: number(v.effective_grade ?? v.grade) as Grade, hasAppeal: v.has_appeal === true, completedAt: string(v.completed_at), commission: records(v.commission).map(ownerPerson), resultVersion: number(v.result_version), questionCount: number(v.question_count) }; }
export function ownerOutsideResult(value: unknown): OutsideResult { const v = record(value), student = ownerPerson(v.student); return { id: number(v.id), studentId: student.id, studentName: student.fullName, points: typeof v.points === "string" ? Number(v.points) : number(v.points), grade: number(v.grade) as Grade, examinator: nullableString(v.examinator), version: number(v.revision) }; }
