import { bffBlobRequest, domain, getIdentity } from "./client";
import { ApiError } from "@/lib/api/client";
import type { ExamCommand, Query } from "@/lib/exams-v2/api";
import type { AdminAttempt, AdminCurrentResult, Commission, Grade, ImportCommit, ImportKind, ImportSession, Privilege, Scoring } from "@/lib/exams-v2/types";
import { clientPage, ownerPage, examOwnerPage, mappedExamPage, examPageQuery, examsDirections, number, nullableString, ownerAssignment, ownerConfig, ownerExam, ownerOutsideResult, ownerPerson, ownerQuestion, ownerReadiness, ownerResult, ownerValidation, record, records, string, type OwnerRecord } from "./exams-shared";
const previews = new Map<string, OwnerRecord>();
function pathParts(path: string, params: Query = {}) { const url = new URL(path, "http://bff.invalid"); const query: Record<string, string> = Object.fromEntries(url.searchParams); return { path: url.pathname, params: { ...query, ...params } as Query }; }
function headers(command: ExamCommand) { return { "Idempotency-Key": command.key, ...(command.confirmationToken ? { "X-Exam-Confirmation": command.confirmationToken } : {}) }; }
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
    const [raw, dirs] = await Promise.all([
        examOwnerPage("/exams", params, { scope: string(params.scope, "division"), type: params.type === "all" ? undefined : params.type, direction_id: params.directionId, date_from: params.dateFrom, date_to: params.dateTo, sort: string(params.sort, "date_desc"), q: params.search }, signal),
        examsDirections(signal),
    ]);
    return mappedExamPage(raw, row => ownerExam(row, dirs));
}
async function overview(id: number, signal?: AbortSignal) {
    const [raw, dirs] = await Promise.all([domain(`/exams/${id}/overview`, { signal }), examsDirections(signal)]);
    const value = record(raw), e = record(value.exam), counts = record(value.counts), exam = ownerExam(e, dirs), base = { exam, canEditContent: canManageContent(e) };
    if (e.connected === false) return { ...base, bankOnly: true };
    if (exam.examType === "outside_lms") return { ...base, outsideLms: { resultsCount: number(counts.results), averageGrade: typeof value.average_grade === "number" ? value.average_grade : null } };
    return { ...base, classic: { partsCount: number(counts.parts), questionsCount: number(counts.questions), commissionsCount: number(counts.commissions), assignmentsCount: number(counts.assignments), resultsCount: number(counts.results), attempts: { pending: number(counts.pending), inProgress: number(counts.in_progress), completed: number(counts.completed) } } };
}
function ownerCommission(row: OwnerRecord): Commission { return { id: number(row.id), name: string(row.name), members: records(row.members).map(ownerPerson), assignedStudentsCount: number(row.assigned_students_count), version: number(row.revision) }; }
function adminAttempt(row: OwnerRecord): AdminAttempt { const result = row.result === null || row.result === undefined ? null : ownerResult(row.result); return { id: number(row.id), attemptId: number(row.id), student: ownerPerson(row.student), attemptNo: number(row.attempt_no, 1) as 1 | 2, status: string(row.status) as AdminAttempt["status"], phase: string(row.phase), grade: result?.grade ?? null, result, historyGeneration: number(row.history_generation), resultVersion: number(row.result_version), members: records(row.members).map(ownerPerson) }; }
function ownerPrivilege(row: OwnerRecord): Privilege { const student = record(row.student); return { student: ownerPerson({ ...student, account_id: number(student.account_id, number(row.student_account_id)), full_name: string(student.full_name) || undefined }), replacementLimit: number(row.replacement_limit), version: number(row.revision) }; }
function invalidPreview(): never { throw new ApiError("Некорректный предпросмотр импорта. Обновите данные.", 502, undefined, "invalid_response"); }
async function importRead(id: number, kind: string, session: string, params: Query, signal?: AbortSignal) {
    const contextRevision = getIdentity()?.context_revision, user = getIdentity()?.user ? { ...getIdentity()!.user } : undefined;
    const query = examPageQuery(params, { only_errors: params.onlyErrors === true || params.onlyErrors === "true" ? true : undefined });
    const requested = new URLSearchParams(query), limit = Number(requested.get("limit")), offset = Number(requested.get("offset"));
    const meta = record(await domain(`/exams/${id}/imports/${kind}/${session}?${query}`, { signal }));
    if (contextRevision !== getIdentity()?.context_revision) throw new ApiError("Кабинет изменился. Обновите страницу.", 409, undefined, "context_changed");
    const summary = record(meta.summary), counts = [summary.total_rows, summary.included_rows, summary.excluded_rows, summary.error_rows, summary.valid_rows];
    if (meta.id !== session || meta.exam_id !== id || meta.kind !== kind || !Number.isSafeInteger(meta.revision) || number(meta.revision) < 1 ||
        !Number.isSafeInteger(meta.total) || number(meta.total) < 0 || number(meta.total) > 5000 || !["editable", "committed"].includes(string(meta.state)) ||
        !Array.isArray(meta.rows) || meta.offset !== Math.min(offset, number(meta.total)) || meta.limit !== limit ||
        typeof meta.filename !== "string" || typeof meta.source_hash !== "string" || meta.source_hash !== "" && !/^[a-f\d]{64}$/i.test(meta.source_hash) || !/^[a-f\d]{64}$/i.test(string(meta.validation_hash)) ||
        !Number.isFinite(Date.parse(string(meta.expires_at))) || counts.some(n => !Number.isSafeInteger(n) || number(n) < 0) ||
        number(summary.total_rows) < number(meta.total) || number(summary.included_rows) + number(summary.excluded_rows) !== summary.total_rows || number(summary.error_rows) + number(summary.valid_rows) !== summary.included_rows ||
        (user && (meta.organization_id !== user.organization_id || meta.division_id !== user.division_id || meta.account_id !== user.account_id))) invalidPreview();
    const rows = records(meta.rows), total = number(meta.total), end = number(meta.offset) + rows.length;
    if (rows.length !== Math.min(limit, Math.max(0, total - offset)) || meta.has_more !== (end < total) || meta.next_offset !== (end < total ? end : null)) invalidPreview();
    const seen = new Set<string>();
    for (const row of rows) {
        if (!string(row.row_id) || seen.has(string(row.row_id)) || !Number.isSafeInteger(row.source_row) || number(row.source_row) < 2 ||
            typeof row.excluded !== "boolean" || !row.input || typeof row.input !== "object" || Array.isArray(row.input) || !Array.isArray(row.errors)) invalidPreview();
        seen.add(string(row.row_id));
    }
    return { session: mapImport(meta, id, params) };
}
export async function examsDownloadTemplate(examId: number, kind: ImportKind, signal?: AbortSignal): Promise<Blob> {
    if (!Number.isSafeInteger(examId) || examId < 1 || !["questions", "assignments", "outside"].includes(kind)) throw new ApiError("Недопустимый адрес шаблона", 400);
    const blob = await bffBlobRequest(`/exams/${examId}/imports/${kind}/template`, { signal });
    if (!blob.size || blob.type.split(";")[0].toLowerCase() !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") throw new ApiError("Сервис вернул несовместимый шаблон Excel", 502, undefined, "invalid_response");
    return blob;
}
export function mapImport(raw: unknown, examId: number, params: Query = {}): ImportSession {
    const v = record(raw), rows = records(v.rows).map(r => ({ rowId: string(r.row_id), sourceRow: number(r.source_row), excluded: r.excluded === true, input: record(r.input), resolved: {}, action: "create", errors: ownerValidation(r.errors), warnings: [] }));
    const serverPage = Number.isSafeInteger(v.total) && Number.isSafeInteger(v.limit) && Number.isSafeInteger(v.offset);
    const visible = !serverPage && (params.onlyErrors === true || params.onlyErrors === "true") ? rows.filter(r => r.errors.length) : rows, paged = serverPage ? ownerPage(rows, number(v.total), number(v.limit, 20), number(v.offset)) : clientPage(visible, params), included = rows.filter(r => !r.excluded), s = record(v.summary);
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
        const raw = await examOwnerPage(`/exams/${id}/privileges`, { limit: 1 }, { student_account_id: privilege[1] }, signal);
        return records(raw.items).map(ownerPrivilege)[0] ?? { replacementLimit: 0, version: 0 };
    }
    if (suffix === "classic/privileges") return mappedExamPage(await examOwnerPage(`/exams/${id}/privileges`, params, { q: params.search }, signal), ownerPrivilege);
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
        const [parts, questions] = await Promise.all([examOwnerPage(`/exams/${id}/parts`, { limit: 1 }, { part_id: partPreview[1] }, signal), examOwnerPage(`/exams/${id}/questions`, { limit: 1 }, { part_id: partPreview[1] }, signal)]);
        return { confirmationToken: "", expiresAt: null, version: number(records(parts.items)[0]?.revision), counts: { questions: number(questions.total) } };
    }
    if (suffix === "classic/parts") return mappedExamPage(await examOwnerPage(`/exams/${id}/parts`, params, {}, signal), p => ({ id: number(p.id), code: string(p.code), questionWeight: number(p.weight), questionCount: number(p.quota), bankSize: number(p.bank_size), version: number(p.revision) }));
    if (suffix === "classic/questions") return mappedExamPage(await examOwnerPage(`/exams/${id}/questions`, params, { part_id: params.partId, q: params.search }, signal), r => ownerQuestion(r));
    if (suffix === "classic/commissions") return mappedExamPage(await examOwnerPage(`/exams/${id}/commissions`, params, { q: params.search }, signal), ownerCommission);
    if (suffix === "classic/assignments") return mappedExamPage(await examOwnerPage(`/exams/${id}/assignments`, params, { q: params.search, status: params.status }, signal), ownerAssignment);
    if (suffix === "classic/attempts") return mappedExamPage(await examOwnerPage(`/exams/${id}/attempts`, params, { q: params.search, status: params.status, attempt_no: params.attemptNo }, signal), adminAttempt);
    if (suffix === "outside-lms/results") return mappedExamPage(await examOwnerPage(`/exams/${id}/results`, params, { q: params.search, sort: params.sort }, signal), ownerOutsideResult);
    if (suffix === "classic/results") {
        const raw = await examOwnerPage(`/exams/${id}/results`, params, { q: params.search, grade: params.grade, has_appeal: params.hasAppeal, completed_only: true }, signal);
        return mappedExamPage(raw, (r): AdminCurrentResult => ({ student: ownerPerson(r.student), currentAttemptId: number(r.id), currentAttemptNo: number(r.attempt_no, 1) as 1 | 2, rawTotal: number(r.raw_total), roundedTotal: number(r.rounded_total), maxScore: number(r.max_score), calculatedGrade: number(r.calculated_grade) as Grade, effectiveGrade: number(r.effective_grade) as Grade, hasAppeal: r.has_appeal === true, resultVersion: number(r.result_version), firstAttemptId: number(r.first_attempt_id, number(r.id)), retakeAssignmentId: number(r.retake_assignment_id) || null, retakeStatus: r.retake_status ? string(r.retake_status) as AdminCurrentResult["retakeStatus"] : null, historyGeneration: number(r.history_generation) }));
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
