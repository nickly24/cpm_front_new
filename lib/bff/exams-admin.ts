import { bffBlobRequest, domain, getIdentity } from "./client";
import { ApiError } from "@/lib/api/client";
import type { ExamCommand, Query } from "@/lib/exams-v2/api";
import type { AdminAttempt, AdminCurrentResult, Commission, Grade, ImportCommit, ImportKind, ImportSession, Part, Privilege, Scoring } from "@/lib/exams-v2/types";
import { clientPage, examDetail, examsAllPages, examsDirections, number, nullableString, ownerAssignment, ownerConfig, ownerExam, ownerOutsideResult, ownerPerson, ownerQuestion, ownerReadiness, ownerResult, ownerValidation, record, records, string, type OwnerRecord } from "./exams-shared";
const previews = new Map<string, OwnerRecord>();
function pathParts(path: string, params: Query = {}) { const url = new URL(path, "http://bff.invalid"); const query: Record<string, string> = Object.fromEntries(url.searchParams); return { path: url.pathname, params: { ...query, ...params } as Query }; }
function headers(command: ExamCommand) { return { "Idempotency-Key": command.key, ...(command.confirmationToken ? { "X-Exam-Confirmation": command.confirmationToken } : {}) }; }
function qs(params: Record<string, unknown>) { const q = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "")
    q.set(k, String(v)); }); return q.size ? `?${q}` : ""; }
function filterText(rows: OwnerRecord[], query: unknown) { const q = string(query).trim().toLocaleLowerCase(); return q ? rows.filter(v => JSON.stringify(v).toLocaleLowerCase().includes(q)) : rows; }
function scopedPreviewKey(path: string) { const i = getIdentity(); return `${i?.context_revision}:${path}`; }
function canManageContent(exam: OwnerRecord) {
    const identity = getIdentity(), u = identity?.user;
    if (u?.organization_admin) return true;
    const connected = Array.isArray(exam.connected_division_ids) ? exam.connected_division_ids : [];
    return u?.role === "staff_admin" && u.permissions?.exams?.edit === true && number(exam.owner_division_id) === u.division_id && connected.length > 0 &&
        connected.every(id => id === u.division_id || identity?.organizations.find(o => o.id === u.organization_id)?.divisions.some(d => d.id === id && d.permissions?.exams?.edit === true));
}
export function examsCapabilities() { const u = getIdentity()?.user, edit = u?.organization_admin === true || u?.role === "staff_admin" && u.permissions?.exams?.edit === true, view = edit || u?.role === "staff_admin" && u.permissions?.exams?.view === true; return { apiVersion: "v2" as const, canManageOutside: edit, canCreateClassic: edit, canConductClassic: u?.role === "examinator", canReadStudentResults: u?.role === "student", canReadAdminExams: view }; }
async function catalogue(params: Query, signal?: AbortSignal) {
    const scope = string(params.scope, "division"), dirs = await examsDirections(signal);
    const sort = string(params.sort, "date_desc");
    const rows = await examsAllPages(`/exams${qs({ scope, type: params.type === "all" ? undefined : params.type, direction_id: params.directionId, date_from: params.dateFrom, date_to: params.dateTo, sort })}`, signal);
    const filtered = rows.map(r => ownerExam(r, dirs)).filter(e => !params.search || `${e.directionName} ${e.name}`.toLocaleLowerCase().includes(string(params.search).toLocaleLowerCase()));
    // Keep the owner's direction collation and private creation timestamp ordering.
    if (sort !== "created_desc" && sort !== "direction_asc") filtered.sort((a, b) => (sort === "date_asc" ? String(a.examDate ?? "").localeCompare(String(b.examDate ?? "")) : String(b.examDate ?? "").localeCompare(String(a.examDate ?? ""))) || (sort === "date_asc" ? a.id - b.id : b.id - a.id));
    return clientPage(filtered, params);
}
async function overview(id: number, signal?: AbortSignal) { const e = await examDetail(id, signal), dirs = await examsDirections(signal), exam = ownerExam(e, dirs), base = { exam, canEditContent: canManageContent(e) }; if (e.connected === false)
    return { ...base, bankOnly: true }; if (exam.examType === "outside_lms") {
    const results = await examsAllPages(`/exams/${id}/results`, signal);
    return { ...base, outsideLms: { resultsCount: results.length, averageGrade: results.length ? results.reduce((sum, r) => sum + number(r.grade), 0) / results.length : 0 } };
} const [parts, questions, commissions, assignments, attempts, results] = await Promise.all(["parts", "questions", "commissions", "assignments", "attempts", "results"].map(s => examsAllPages(`/exams/${id}/${s}`, signal))); return { ...base, classic: { partsCount: parts.length, questionsCount: questions.length, commissionsCount: commissions.length, assignmentsCount: assignments.length, resultsCount: results.filter(r => r.result !== null).length, attempts: { pending: attempts.filter(a => a.status === "pending_ready").length, inProgress: attempts.filter(a => a.status === "in_progress").length, completed: attempts.filter(a => a.status === "completed").length } } }; }
function ownerCommission(row: OwnerRecord, assignments: OwnerRecord[]): Commission { return { id: number(row.id), name: string(row.name), members: records(row.members).map(ownerPerson), assignedStudentsCount: assignments.filter(a => a.commission_id === row.id).length, version: number(row.revision) }; }
function adminAttempt(row: OwnerRecord): AdminAttempt { const result = row.result === null || row.result === undefined ? null : ownerResult(row.result); return { id: number(row.id), attemptId: number(row.id), student: ownerPerson(row.student), attemptNo: number(row.attempt_no, 1) as 1 | 2, status: string(row.status) as AdminAttempt["status"], phase: string(row.phase), grade: result?.grade ?? null, result, historyGeneration: number(row.history_generation), resultVersion: number(row.result_version), members: records(row.members).map(ownerPerson) }; }
async function privileges(id: number, signal?: AbortSignal): Promise<Privilege[]> { const [rows, assignments] = await Promise.all([examsAllPages(`/exams/${id}/privileges`, signal), examsAllPages(`/exams/${id}/assignments`, signal)]); return rows.map(r => ({ student: ownerPerson(assignments.find(a => record(a.student).account_id === r.student_account_id)?.student ?? { account_id: r.student_account_id }), replacementLimit: number(r.replacement_limit), version: number(r.revision) })); }
function invalidPreview(): never { throw new ApiError("Некорректный предпросмотр импорта. Обновите данные.", 502, undefined, "invalid_response"); }
function importSignature(v: OwnerRecord): string {
    const summary = record(v.summary);
    return JSON.stringify([v.id, v.revision, v.state, v.total, v.kind, v.exam_id, v.organization_id, v.division_id, v.account_id, v.filename, v.source_hash, v.validation_hash, v.expires_at, summary.total_rows, summary.included_rows, summary.excluded_rows, summary.error_rows, summary.valid_rows, v.result]);
}
async function importRead(id: number, kind: string, session: string, params: Query, signal?: AbortSignal) {
    const all: OwnerRecord[] = [], seen = new Set<string>();
    const contextRevision = getIdentity()?.context_revision, user = getIdentity()?.user ? { ...getIdentity()!.user } : undefined;
    let first: OwnerRecord | undefined;
    for (let offset = 0; offset < 5000; offset += 200) {
        const meta = record(await domain(`/exams/${id}/imports/${kind}/${session}${qs({ limit: 200, offset, expected_revision: first?.revision })}`, { signal }));
        if (contextRevision !== getIdentity()?.context_revision) throw new ApiError("Кабинет изменился. Обновите страницу.", 409, undefined, "context_changed");
        if (first && importSignature(meta) !== importSignature(first)) throw new ApiError("Предпросмотр изменился. Обновите данные перед применением.", 409, undefined, "preview_modified");
        const summary = record(meta.summary), counts = [summary.total_rows, summary.included_rows, summary.excluded_rows, summary.error_rows, summary.valid_rows];
        if (meta.id !== session || meta.exam_id !== id || meta.kind !== kind || !Number.isSafeInteger(meta.revision) || number(meta.revision) < 1 ||
            !Number.isSafeInteger(meta.total) || number(meta.total) < 0 || number(meta.total) > 5000 || !["editable", "committed"].includes(string(meta.state)) ||
            !Array.isArray(meta.rows) || meta.offset !== offset || meta.limit !== 200 ||
            typeof meta.filename !== "string" || typeof meta.source_hash !== "string" || meta.source_hash !== "" && !/^[a-f\d]{64}$/i.test(meta.source_hash) || !/^[a-f\d]{64}$/i.test(string(meta.validation_hash)) ||
            !Number.isFinite(Date.parse(string(meta.expires_at))) || counts.some(n => !Number.isSafeInteger(n) || number(n) < 0) ||
            summary.total_rows !== meta.total || number(summary.included_rows) + number(summary.excluded_rows) !== meta.total || number(summary.error_rows) + number(summary.valid_rows) !== summary.included_rows ||
            (user && (meta.organization_id !== user.organization_id || meta.division_id !== user.division_id || meta.account_id !== user.account_id))) invalidPreview();
        first ??= meta;
        const rows = records(meta.rows), total = number(first.total), end = offset + rows.length;
        if (rows.length !== Math.min(200, total - offset) || meta.has_more !== (end < total) || meta.next_offset !== (end < total ? end : null)) invalidPreview();
        for (const row of rows) {
            if (!string(row.row_id) || seen.has(string(row.row_id)) || !Number.isSafeInteger(row.source_row) || number(row.source_row) < 2 ||
                typeof row.excluded !== "boolean" || !row.input || typeof row.input !== "object" || Array.isArray(row.input) || !Array.isArray(row.errors)) invalidPreview();
            seen.add(string(row.row_id));
        }
        all.push(...rows);
        if (end === total) return { session: mapImport({ ...first, rows: all }, id, params) };
    }
    return invalidPreview();
}
export async function examsDownloadTemplate(examId: number, kind: ImportKind, signal?: AbortSignal): Promise<Blob> {
    if (!Number.isSafeInteger(examId) || examId < 1 || !["questions", "assignments", "outside"].includes(kind)) throw new ApiError("Недопустимый адрес шаблона", 400);
    const blob = await bffBlobRequest(`/exams/${examId}/imports/${kind}/template`, { signal });
    if (!blob.size || blob.type.split(";")[0].toLowerCase() !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") throw new ApiError("Сервис вернул несовместимый шаблон Excel", 502, undefined, "invalid_response");
    return blob;
}
export function mapImport(raw: unknown, examId: number, params: Query = {}): ImportSession {
    const v = record(raw), rows = records(v.rows).map(r => ({ rowId: string(r.row_id), sourceRow: number(r.source_row), excluded: r.excluded === true, input: record(r.input), resolved: {}, action: "create", errors: ownerValidation(r.errors), warnings: [] }));
    const visible = params.onlyErrors === true || params.onlyErrors === "true" ? rows.filter(r => r.errors.length) : rows, paged = clientPage(visible, params), included = rows.filter(r => !r.excluded), s = record(v.summary);
    const ownerSummary = [s.total_rows, s.included_rows, s.excluded_rows, s.valid_rows, s.error_rows].every(n => Number.isSafeInteger(n) && number(n) >= 0) ? { total_rows: number(s.total_rows), included_rows: number(s.included_rows), excluded_rows: number(s.excluded_rows), valid_rows: number(s.valid_rows), error_rows: number(s.error_rows) } : undefined;
    return { id: string(v.id), examId, previewVersion: number(v.revision), status: v.state === "committed" ? "committed" : "editable", expiresAt: string(v.expires_at), filename: typeof v.filename === "string" ? v.filename : undefined, sourceHash: typeof v.source_hash === "string" ? v.source_hash : undefined, validationHash: nullableString(v.validation_hash) ?? undefined, ownerSummary, rows: paged.items, pagination: paged.pagination,
        summary: { total: ownerSummary?.total_rows ?? rows.length, included: ownerSummary?.included_rows ?? included.length, excluded: ownerSummary?.excluded_rows ?? rows.length - included.length, creatable: ownerSummary?.valid_rows ?? included.filter(r => !r.errors.length).length, conflicts: included.filter(r => r.errors.some(e => /conflict|exists|duplicate/.test(e.code))).length, errors: ownerSummary?.error_rows ?? included.filter(r => r.errors.length).length }, commitResult: v.result ? mapImportCommit(v.result, string(v.id)) : undefined };
}
function mapImportCommit(raw: unknown, id: string): ImportCommit { const v = record(raw); return { sessionId: id, committed: v.committed === true, counts: Object.fromEntries(Object.entries(record(v.counts)).map(([k, n]) => [k, number(n)])), replayed: v.replayed === true }; }
export async function examsAdminGet(rawPath: string, rawParams: Query = {}, signal?: AbortSignal): Promise<unknown> {
    const { path, params } = pathParts(rawPath, rawParams);
    if (path === "/api/exams/capabilities")
        return domain("/exams/capabilities", { signal });
    if (path === "/api/exams")
        return catalogue(params, signal);
    const match = path.match(/^\/api\/exams\/(\d+)(?:\/(.*))?$/);
    if (!match)
        throw new Error("Маршрут экзаменов ещё не подключён");
    const id = Number(match[1]), suffix = match[2] ?? "";
    if (suffix === "overview" || suffix === "")
        return overview(id, signal);
    const imp = suffix.match(/^imports\/(questions|assignments|outside)\/sessions\/([a-f\d-]+)$/);
    if (imp)
        return importRead(id, imp[1], imp[2], params, signal);
    if (suffix === "delete-preview") {
        const v = record(await domain(`/exams/${id}/delete-preview`, { signal }));
        previews.set(scopedPreviewKey(path), v);
        return { confirmationToken: string(v.confirmation), expiresAt: null, version: number(v.revision), counts: record(v.counts) };
    }
    if (suffix === "classic/config" || suffix === "classic/scoring") {
        const raw = record(await domain(`/exams/${id}/config`, { signal })), c = record(raw.config), config = ownerConfig(c, id), validation = ownerValidation(raw.local_validation);
        if (suffix.endsWith("config"))
            return { config, localValidation: validation };
        const thresholds = records(c.thresholds).map(t => ({ grade: number(t.grade) as Grade, minScore: number(t.min_score) }));
        const max = number(raw.max_score);
        const scoring: Scoring = { ...config, minScore: 0, maxScore: max, thresholds, ranges: thresholds.map((t, i) => ({ grade: t.grade, from: t.minScore, to: thresholds[i + 1]?.minScore === undefined ? max : thresholds[i + 1].minScore - 1 })) };
        return { scoring, validation };
    }
    if (suffix === "classic/readiness")
        return { readiness: ownerReadiness(await domain(`/exams/${id}/readiness`, { signal })) };
    const ready = suffix.match(/^classic\/assignments\/(\d+)\/readiness$/);
    if (ready)
        return ownerReadiness(await domain(`/exams/${id}/readiness?assignment_id=${ready[1]}`, { signal }));
    const privilege = suffix.match(/^classic\/students\/(\d+)\/privilege$/);
    if (privilege) {
        return (await privileges(id, signal)).find(v => v.student?.id === Number(privilege[1])) ?? { replacementLimit: 0, version: 0 };
    }
    if (suffix === "classic/privileges")
        return clientPage((await privileges(id, signal)).filter(v => !params.search || `${v.student?.fullName} ${v.student?.id}`.toLocaleLowerCase().includes(string(params.search).toLocaleLowerCase())), params);
    const hist = suffix.match(/^classic\/students\/(\d+)\/delete-preview$/);
    if (hist) {
        const v = record(await domain(`/exams/${id}/history/${hist[1]}/delete-preview`, { signal }));
        previews.set(scopedPreviewKey(path), v);
        return { confirmationToken: string(v.confirmation), expiresAt: null, historyGeneration: number(v.history_generation), counts: record(v.counts) };
    }
    const attempt = suffix.match(/^classic\/attempts\/(\d+)(?:\/(appeals))?$/);
    if (attempt) {
        const v = record(await domain(`/exams/${id}/attempts/${attempt[1]}`, { signal }));
        if (attempt[2])
            return clientPage(records(record(v.result).appeals).map(r => ({ id: number(r.id), previousGrade: number(r.previous_grade), newGrade: number(r.new_grade), createdAt: nullableString(r.created_at) })), params);
        return { attempt: adminAttempt(v) };
    }
    const partPreview = suffix.match(/^classic\/parts\/(\d+)\/delete-preview$/);
    if (partPreview) {
        const parts = await examsAllPages(`/exams/${id}/parts`, signal), part = parts.find(p => p.id === Number(partPreview[1]));
        return { confirmationToken: "", expiresAt: null, version: number(part?.revision), counts: { questions: (await examsAllPages(`/exams/${id}/questions?part_id=${partPreview[1]}`, signal)).length } };
    }
    if (suffix === "classic/parts")
        return clientPage((await examsAllPages(`/exams/${id}/parts`, signal)).map(p => ({ id: number(p.id), code: string(p.code), questionWeight: number(p.weight), questionCount: number(p.quota), bankSize: number(p.bank_size), version: number(p.revision) })), params);
    if (suffix === "classic/questions") {
        const [rows, parts] = await Promise.all([examsAllPages(`/exams/${id}/questions${qs({ part_id: params.partId })}`, signal), examsAllPages(`/exams/${id}/parts`, signal)]);
        return clientPage(filterText(rows, params.search).map(r => ownerQuestion(r, parts.map(p => ({ id: number(p.id), code: string(p.code) } as Part)))), params);
    }
    if (suffix === "classic/commissions") {
        const [rows, assignments] = await Promise.all([examsAllPages(`/exams/${id}/commissions`, signal), examsAllPages(`/exams/${id}/assignments`, signal)]);
        return clientPage(rows.map(r => ownerCommission(r, assignments)), params);
    }
    if (suffix === "classic/assignments") {
        let rows = filterText(await examsAllPages(`/exams/${id}/assignments`, signal), params.search);
        if (params.status)
            rows = rows.filter(r => r.status === params.status);
        return clientPage(rows.map(ownerAssignment), params);
    }
    if (suffix === "classic/attempts") {
        let rows = filterText(await examsAllPages(`/exams/${id}/attempts${qs({ status: params.status })}`, signal), params.search);
        if (params.attemptNo)
            rows = rows.filter(r => r.attempt_no === Number(params.attemptNo));
        return clientPage(rows.map(adminAttempt), params);
    }
    if (suffix === "outside-lms/results") {
        const rows = filterText(await examsAllPages(`/exams/${id}/results`, signal), params.search).map(ownerOutsideResult);
        rows.sort((a, b) => params.sort === "grade_desc" ? b.grade - a.grade : params.sort === "points_desc" ? b.points - a.points : params.sort === "updated_desc" ? b.version - a.version : params.sort === "created_desc" ? b.id - a.id : a.studentName.localeCompare(b.studentName, "ru"));
        return clientPage(rows, params);
    }
    if (suffix === "classic/results") {
        const [results, assignments, attempts] = await Promise.all(["results", "assignments", "attempts"].map(p => examsAllPages(`/exams/${id}/${p}`, signal)));
        const rows: AdminCurrentResult[] = filterText(results, params.search).filter(r => r.result !== null).map(r => { const student = ownerPerson(r.student), retake = assignments.find(a => record(a.student).account_id === student.id && a.attempt_no === 2), first = attempts.find(a => record(a.student).account_id === student.id && a.attempt_no === 1); return { student, currentAttemptId: number(r.id), currentAttemptNo: number(r.attempt_no, 1) as 1 | 2, rawTotal: number(r.raw_total), roundedTotal: number(r.rounded_total), maxScore: number(r.max_score), calculatedGrade: number(r.calculated_grade) as Grade, effectiveGrade: number(r.effective_grade) as Grade, hasAppeal: r.has_appeal === true, resultVersion: number(r.result_version), firstAttemptId: number(first?.id, number(r.id)), retakeAssignmentId: number(retake?.id) || null, retakeStatus: retake ? string(retake.status) as AdminCurrentResult["retakeStatus"] : null, historyGeneration: number(r.history_generation) }; });
        return clientPage(rows.filter(r => (params.grade === undefined || params.grade === "" || r.effectiveGrade === Number(params.grade)) && (params.hasAppeal === undefined || params.hasAppeal === "" || r.hasAppeal === (params.hasAppeal === true || params.hasAppeal === "true"))), params);
    }
    throw new Error(`Маршрут экзаменов ещё не подключён: ${suffix}`);
}
export async function examsAdminMutate(command: ExamCommand): Promise<unknown> {
    const { path, params } = pathParts(command.path), b = record(command.body);
    let target = "", body: OwnerRecord = {}, method: string = command.method;
    const match = path.match(/^\/api\/exams\/(\d+)(?:\/(.*))?$/);
    if (path === "/api/exams") {
        const dirs = await examsDirections();
        target = "/exams";
        body = { name: b.name ?? dirs.find(d => d.id === b.directionId)?.name ?? "Экзамен", exam_type: b.examType, direction_id: b.directionId, ...(b.date ? { date: b.date } : {}) };
    }
    else if (match) {
        const id = Number(match[1]), s = match[2] ?? "", prefix = `/exams/${id}`;
        const imp = s.match(/^imports\/(questions|assignments|outside)\/sessions\/([a-f\d-]+)(\/commit)?$/);
        if (imp) {
            target = `${prefix}/imports/${imp[1]}/${imp[2]}${imp[3] ?? ""}`;
            body = { expected_revision: b.expectedPreviewVersion, ...(b.changes ? { changes: records(b.changes).map(c => ({ row_id: c.rowId, input: c.input, excluded: c.excluded })) } : {}) };
            const raw = await domain<unknown>(target, { method, headers: headers(command), body: JSON.stringify(body) });
            return imp[3] ? { result: mapImportCommit(raw, imp[2]) } : { session: mapImport(raw, id) };
        }
        if (s === "classic/config" || s === "classic/scoring") {
            target = `${prefix}/config`;
            method = "PUT";
            body = { expected_revision: b.expectedConfigVersion };
            for (const [from, to] of Object.entries({ startAt: "start_at", endAt: "end_at", fractionalMode: "fractional_mode", tieBreakerSourceMode: "tie_breaker_source_mode", tieBreakerPartId: "tie_breaker_part_id", tieBreakerHalfMode: "tie_breaker_half_mode" })) {
                if (b[from] !== undefined)
                    body[to] = b[from] === null && from === "tieBreakerPartId" ? 0 : b[from];
            }
            if (b.thresholds)
                body.thresholds = records(b.thresholds).map(t => ({ grade: t.grade, min_score: t.minScore }));
        }
        else if (s === "direction") {
            target = `${prefix}/direction`;
            method = "PUT";
            body = { direction_id: b.directionId, expected_revision: b.expectedVersion };
        }
        else if (s === "outside-lms") {
            target = `${prefix}/metadata`;
            method = "PUT";
            body = { date: b.date, expected_revision: b.expectedVersion };
        }
        else if (s === "metadata" || s === "bank" || s === "connections" || s === "copy" || s.startsWith("connections/")) {
            target = `${prefix}/${s}`;
            body = b;
        }
        else if (s === "") {
            target = prefix;
            const p = previews.get(scopedPreviewKey(`${path}/delete-preview`));
            body = { expected_revision: b.expectedVersion ?? params.expectedVersion ?? p?.revision };
        }
        else {
            const resource = s.match(/^classic\/(parts|questions|commissions|assignments)(?:\/(\d+))?$/);
            const outside = s.match(/^outside-lms\/results(?:\/(\d+))?$/);
            const privilege = s.match(/^classic\/students\/(\d+)\/privilege$/);
            const appeal = s.match(/^classic\/attempts\/(\d+)\/appeals$/);
            const retake = s.match(/^classic\/students\/(\d+)\/retake$/);
            const history = s.match(/^classic\/students\/(\d+)\/history$/);
            if (resource) {
                target = `${prefix}/${resource[1]}${resource[2] ? `/${resource[2]}` : ""}`;
                if (method === "PATCH")
                    method = "PUT";
                const rev = b.expectedVersion ?? params.expectedVersion;
                if (rev !== undefined)
                    body.expected_revision = Number(rev);
                const maps: Record<string, Record<string, string>> = { parts: { code: "code", questionWeight: "weight", questionCount: "quota" }, questions: { partId: "part_id", questionText: "question_text", answerText: "answer_text" }, commissions: { name: "name", examinatorIds: "examinator_ids" }, assignments: { studentId: "student_account_id", commissionId: "commission_id" } };
                for (const [from, to] of Object.entries(maps[resource[1]])) {
                    if (b[from] !== undefined)
                        body[to] = b[from];
                }
                if (b.replacementLimit !== undefined)
                    throw new Error("Сохраните лимит замен во вкладке «Привилегии», затем назначьте комиссию.");
            }
            else if (outside) {
                target = `${prefix}/outside-results${outside[1] ? `/${outside[1]}` : ""}`;
                if (method === "PATCH")
                    method = "PUT";
                const rev = b.expectedVersion ?? params.expectedVersion;
                if (rev !== undefined)
                    body.expected_revision = Number(rev);
                for (const [from, to] of Object.entries({ studentId: "student_account_id", points: "points", grade: "grade", examinator: "examinator" })) {
                    if (b[from] !== undefined)
                        body[to] = b[from];
                }
            }
            else if (privilege) {
                target = `${prefix}/privileges/${privilege[1]}`;
                if (method !== "DELETE")
                    method = "PUT";
                body = { expected_revision: Number(b.expectedPrivilegeVersion ?? b.expectedVersion ?? params.expectedVersion ?? 0), ...(b.replacementLimit !== undefined ? { replacement_limit: b.replacementLimit } : {}) };
            }
            else if (appeal) {
                target = `${prefix}/attempts/${appeal[1]}/appeals`;
                body = { grade: b.grade, expected_result_version: b.expectedResultVersion };
            }
            else if (retake) {
                target = `${prefix}/retakes/${retake[1]}`;
                body = { commission_id: b.commissionId, expected_history_generation: b.expectedHistoryGeneration };
            }
            else if (history) {
                target = `${prefix}/history/${history[1]}`;
                const p = previews.get(scopedPreviewKey(path.replace(/history$/, "delete-preview")));
                body = { expected_history_generation: b.expectedHistoryGeneration ?? p?.history_generation };
            }
        }
    }
    if (!target)
        throw new Error("Маршрут изменения экзамена ещё не подключён");
    const raw = await domain<unknown>(target, { method, headers: headers(command), body: JSON.stringify(body) });
    if (command.method === "DELETE")
        return undefined;
    if (path === "/api/exams" || match?.[2] === "copy")
        return { exam: ownerExam(raw, await examsDirections()) };
    return raw;
}
export async function examsParseImport(examId: number, kind: ImportKind, file: File, key: string): Promise<{
    session: ImportSession;
}> { const form = new FormData(); form.append("file", file); const raw = await domain(`/exams/${examId}/imports/${kind}`, { method: "POST", headers: { "Idempotency-Key": key }, body: form }); return { session: mapImport(raw, examId) }; }
