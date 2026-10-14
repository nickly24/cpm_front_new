/** Student exams use only the account and cabinet from the cookie session. */
import { ApiError } from "@/lib/api/client";
import type { ExamCommand } from "@/lib/exams-v2/api";
import type { AttemptStatus, ExamSummary, OutsideStudentResult, Page, PresentedQuestion, StudentResult, StudentResultDetail } from "@/lib/exams-v2/types";
import type { MarkCardLearnedPayload, SectionBatchResponse, SectionStudyViewResponse, StudyFilter, StudySettings, StudySettingsPayload, TrainingCard, TrainingDirection, TrainingSectionNode, TrainingSectionsResponse } from "@/lib/training/training-types";
import { filterStudyCards } from "@/lib/training/exam-training";
import { domain, getIdentity } from "./client";
import { adequateExamSummary, clientPage, examCalendarDate, examContextKey, examDetail, examsAllPages, examsDirections, nullableString, number, ownerExam, ownerOutsideResult, ownerPage, ownerResult, record, records, string, type OwnerRecord } from "./exams-shared";

type Query = Record<string, string | number | boolean | null | undefined>;
const pendingKeys = new Map<string, string>();
const notices: Record<string, string> = {
  training_disabled: "Подготовка по этому экзамену сейчас недоступна",
  exam_empty: "В экзамене пока нет карточек для подготовки",
  content_changed: "Содержание карточки изменилось. Ознакомьтесь с обновлённым вопросом и ответом",
  not_found: "Экзамен или карточка больше недоступны. Обновите данные",
  wrong_exam_type: "Для этого экзамена нет подготовки по карточкам",
  version_conflict: "Настройка изменена другим пользователем. Обновите данные и повторите действие",
};
function errorForUi(error: unknown): unknown {
  if (error instanceof ApiError || !(error instanceof Error)) return error;
  const value = record(error), code = string(value.code);
  return new ApiError(notices[code] ?? error.message, number(value.status) || undefined, undefined, code || undefined);
}
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  try { return await domain<T>(path, options); } catch (error) { throw errorForUi(error); }
}
function splitPath(path: string, params: Query = {}) {
  const [pathname, query = ""] = path.split("?");
  const merged: Query = Object.fromEntries(new URLSearchParams(query));
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") merged[key] = value;
  return { pathname, params: merged };
}
function query(values: Query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  return params.size ? `?${params}` : "";
}
function selfAccount(): number {
  const identity = getIdentity();
  const account = identity?.user.account_id;
  if (identity?.user.role !== "student" || !account) throw new ApiError("Этот результат доступен только его владельцу", 403, undefined, "access_denied");
  return account;
}
function sectionScope(ref: string) {
  const match = /^(\d+)(?::(\d+))?$/.exec(ref);
  if (!match || Number(match[1]) < 1 || (match[2] && Number(match[2]) < 1)) throw new ApiError("Адрес подготовки не найден", 404);
  return { examId: Number(match[1]), partId: match[2] ? Number(match[2]) : null };
}
async function mutation(path: string, method: "PUT" | "DELETE", body: unknown, key?: string): Promise<unknown> {
  // A lost response retains the same UUID for a user's explicit retry.
  const logical = `${examContextKey()}:${method}:${path}:${JSON.stringify(body)}`;
  const id = pendingKeys.get(logical) ?? key ?? crypto.randomUUID();
  pendingKeys.set(logical, id);
  try {
    const result = await request(path, { method, body: JSON.stringify(body), headers: { "Idempotency-Key": id } });
    pendingKeys.delete(logical);
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.status && error.status < 500) pendingKeys.delete(logical);
    throw error;
  }
}
function hiddenTraining(error: unknown): boolean {
  const value = record(error);
  return ["training_disabled", "exam_empty", "not_found"].includes(string(value.code)) || number(value.status) === 404;
}
async function availableTraining(examId: number, signal?: AbortSignal): Promise<OwnerRecord | null> {
  try { return record(await request(`/exams/${examId}/training`, { signal })); }
  catch (error) { if (hiddenTraining(error)) return null; throw error; }
}
function outsideStudent(value: unknown, exam: ExamSummary): OutsideStudentResult {
  const row = ownerOutsideResult(value);
  return { examId: exam.id, examName: exam.name || undefined, examType: "outside_lms", directionId: exam.directionId, directionName: exam.directionName, date: exam.date, examDate: exam.examDate, points: row.points, grade: row.grade, examinator: row.examinator, hasAppeal: false };
}
function completedResult(value: unknown): boolean { return record(value).status === "completed"; }
function retakeState(value: OwnerRecord): { hasActiveRetake: boolean; retakeStatus: AttemptStatus | null } {
  const retakeStatus = ["not_started", "pending_ready", "in_progress", "completed"].includes(string(value.retake_status)) ? value.retake_status as AttemptStatus : null;
  return { hasActiveRetake: value.has_active_retake === true && retakeStatus !== "completed", retakeStatus };
}
function classicStudent(value: OwnerRecord, exam: ExamSummary): StudentResult {
  const window = record(value.exam_window_snapshot);
  return { examId: exam.id, examName: exam.name || undefined, examType: "classic", directionId: exam.directionId, directionName: exam.directionName,
    startAt: Object.hasOwn(value, "exam_date") ? exam.startAt : exam.startAt ?? nullableString(window.start_at), endAt: Object.hasOwn(value, "exam_date") ? exam.endAt : exam.endAt ?? nullableString(window.end_at),
    examDate: Object.hasOwn(value, "exam_date") ? nullableString(value.exam_date) : exam.examDate ?? examCalendarDate(nullableString(window.start_at)),
    ...retakeState(value), currentAttempt: ownerResult(value), hasPreviousAttempt: number(value.attempt_no) === 2 };
}
async function studentResults(params: Query, signal?: AbortSignal): Promise<Page<StudentResult>> {
  selfAccount();
  const type = ["classic", "outside_lms"].includes(String(params.type)) ? String(params.type) : undefined;
  const [catalog, directions] = await Promise.all([examsAllPages(`/exams${query({ scope: "division", type, date_from: params.dateFrom, date_to: params.dateTo, sort: params.sort })}`, signal), examsDirections(signal)]);
  const results: StudentResult[] = [];
  for (const item of catalog) {
    signal?.throwIfAborted();
    const id = number(item.id), rows = await examsAllPages(`/exams/${id}/results`, signal);
    const completed = rows.filter(row => item.exam_type === "outside_lms" || completedResult(row));
    if (!completed.length) continue;
    const detail = adequateExamSummary(item) ? item : { ...item, ...await examDetail(id, signal) }, exam = ownerExam(detail, directions);
    for (const row of completed) results.push(exam.examType === "outside_lms" ? outsideStudent(row, exam) : classicStudent(row, exam));
  }
  const filtered = results.filter(row => params.grade === undefined || params.grade === "" || (row.examType === "classic" ? row.currentAttempt.grade : row.grade) === Number(params.grade));
  const date = (row: StudentResult) => row.examDate ?? "";
  if (params.sort !== "direction_asc") filtered.sort((a, b) => (params.sort === "date_asc" ? date(a).localeCompare(date(b)) : date(b).localeCompare(date(a))) || (params.sort === "date_asc" ? a.examId - b.examId : b.examId - a.examId));
  return clientPage(filtered, params);
}
async function studentDetail(id: number, signal?: AbortSignal): Promise<StudentResultDetail> {
  const account = selfAccount();
  const [detail, raw, directions] = await Promise.all([examDetail(id, signal), request<unknown>(`/exams/${id}/results/${account}`, { signal }), examsDirections(signal)]);
  const result = record(raw), exam = ownerExam(detail, directions);
  if (exam.examType === "outside_lms") return { examId: id, examName: exam.name || undefined, examType: "outside_lms", directionName: exam.directionName, examDate: exam.examDate, current: outsideStudent(result.current ?? raw, exam), history: [] };
  const current = record(result.current);
  if (!completedResult(current)) throw new ApiError("Результат появится после завершения экзамена", 404, undefined, "not_found");
  const training = await availableTraining(id, signal);
  return { examId: id, examName: exam.name || undefined, examType: "classic", directionName: exam.directionName, examDate: exam.examDate, ...retakeState(current), current: ownerResult(current), history: records(result.history).filter(completedResult).map(ownerResult), trainingEnabled: Boolean(training) };
}
function studentQuestion(value: unknown): PresentedQuestion {
  const row = record(value);
  return { id: number(row.id), partCode: string(row.part_code), sequenceNo: number(row.sequence_no), purpose: string(row.purpose) as PresentedQuestion["purpose"], status: string(row.status) as PresentedQuestion["status"], questionText: string(row.question_text), answerText: string(row.answer_text), weight: number(row.question_weight), consensus: [0, 0.5, 1].includes(Number(row.consensus)) && typeof row.consensus === "number" ? row.consensus as PresentedQuestion["consensus"] : null, awardedPoints: typeof row.weighted_score === "number" ? row.weighted_score : undefined, cycleNo: number(row.cycle_no, 1), replacesPresentedQuestionId: number(row.replaces_id) || null };
}
export function handlesStudentPath(path: string): boolean {
  const { pathname } = splitPath(path);
  return pathname.startsWith("/api/student/exams/") || /^\/api\/exams\/\d+\/training(?:\/preview)?$/.test(pathname);
}
export async function examsStudentGet(path: string, params: Query = {}, signal?: AbortSignal): Promise<unknown> {
  const route = splitPath(path, params), p = route.params;
  if (route.pathname === "/api/student/exams/results") return studentResults(p, signal);
  if (route.pathname === "/api/student/exams/training") return clientPage((await examTrainingTree(signal)).flatMap(direction => direction.sections), p);
  let match = /^\/api\/student\/exams\/(\d+)\/result$/.exec(route.pathname);
  if (match) return studentDetail(Number(match[1]), signal);
  match = /^\/api\/student\/exams\/(\d+)\/attempts\/(\d+)\/questions$/.exec(route.pathname);
  if (match) {
    selfAccount();
    const limit = Math.max(1, Math.min(200, Number(p.limit) || 10)), offset = (Math.max(1, Number(p.page) || 1) - 1) * limit;
    const raw = record(await request(`/exams/${match[1]}/attempts/${match[2]}/protocol${query({ limit, offset, through_sequence_no: p.throughSequenceNo })}`, { signal }));
    return { ...ownerPage(records(raw.items).map(studentQuestion), number(raw.total), limit, offset), throughSequenceNo: number(raw.through_sequence_no) };
  }
  match = /^\/api\/exams\/(\d+)\/training(\/preview)?$/.exec(route.pathname);
  if (match) {
    const id = Number(match[1]);
    if (match[2]) return examTrainingView(String(id), true, signal);
    const [detail, preview, directions] = await Promise.all([examDetail(id, signal), request<unknown>(`/exams/${id}/training?preview=true`, { signal }), examsDirections(signal)]);
    const view = record(preview), exam = ownerExam(detail, directions);
    return { exam: { ...exam, version: number(detail.division_revision) }, parts_count: records(view.parts).length, cards_count: number(record(view.stats).total) };
  }
  return undefined;
}
export async function examsStudentMutate(command: ExamCommand): Promise<unknown> {
  const match = /^\/api\/exams\/(\d+)\/training$/.exec(command.path);
  if (!match || command.method !== "PATCH") return undefined;
  const body = record(command.body);
  return mutation(`/exams/${match[1]}/training`, "PUT", { training_enabled: body.enabled, expected_revision: body.expectedVersion }, command.key);
}

export async function examTrainingView(ref: string, preview = false, signal?: AbortSignal): Promise<SectionStudyViewResponse> {
  if (!preview) selfAccount();
  const { examId, partId } = sectionScope(ref);
  const [raw, directions, detail] = await Promise.all([request<unknown>(`/exams/${examId}/training${query({ part_id: partId, preview: preview ? true : undefined })}`, { signal }), examsDirections(signal), examDetail(examId, signal)]);
  return adaptTrainingView(raw, directions, detail);
}
function adaptTrainingView(value: unknown, directions: Awaited<ReturnType<typeof examsDirections>>, detail: OwnerRecord): SectionStudyViewResponse {
  const row = record(value), rawExam = record(row.exam), id = number(rawExam.id), exam = ownerExam({ ...detail, ...rawExam, revision: rawExam.version, config: { start_at: rawExam.start_at, end_at: rawExam.end_at } }, directions);
  const cards = records(row.cards) as unknown as TrainingCard[];
  const parts = records(row.parts).map(part => {
    const stats = record(part.stats) as unknown as TrainingSectionNode["stats"];
    return { kind: "exam" as const, refId: string(part.ref_id), name: `Часть ${string(part.part_code)}`, exam_id: id, part_id: number(part.part_id), part_code: string(part.part_code), stats, total_cards: stats.total, learned_cards: stats.learned, answer_changed_cards: stats.answer_changed, progress_percent: stats.progress_percent ?? 0 };
  });
  const selected = parts.find(part => part.part_id === number(row.part_id));
  return { success: true, student_id: number(row.account_id), section_kind: "exam", section_ref_id: string(row.section_ref_id), section_name: selected?.name ?? exam.directionName, exam, parts, part_id: number(row.part_id) || null, cards, stats: record(row.stats) as unknown as SectionStudyViewResponse["stats"], batches: Array.isArray(row.batches) ? row.batches as SectionStudyViewResponse["batches"] : [], settings: record(row.settings) as unknown as StudySettings };
}
export async function examTrainingTree(signal?: AbortSignal): Promise<TrainingDirection[]> {
  selfAccount();
  const [catalog, directions] = await Promise.all([examsAllPages("/exams?scope=division&type=classic", signal), examsDirections(signal)]);
  const groups = new Map<number, TrainingDirection>();
  for (const item of catalog) {
    signal?.throwIfAborted();
    const id = number(item.id), raw = await availableTraining(id, signal);
    if (!raw) continue;
    const view = adaptTrainingView(raw, directions, item), exam = view.exam!, directionId = exam.directionId ?? 0;
    const node: TrainingSectionNode = { kind: "exam", refId: String(id), name: string(item.name, exam.directionName), exam_id: id, parts_count: view.parts?.length, start_at: exam.startAt, end_at: exam.endAt, stats: view.stats, total_cards: view.stats.total, learned_cards: view.stats.learned, answer_changed_cards: view.stats.answer_changed, progress_percent: view.stats.progress_percent ?? 0 };
    const group = groups.get(directionId) ?? { id: directionId, name: exam.directionName, sections: [], total_cards: 0, learned_cards: 0, answer_changed_cards: 0, progress_percent: 0 };
    group.sections.push(node); group.total_cards += node.total_cards; group.learned_cards += node.learned_cards; group.answer_changed_cards = (group.answer_changed_cards ?? 0) + (node.answer_changed_cards ?? 0);
    group.progress_percent = group.total_cards ? Math.round(group.learned_cards * 100 / group.total_cards) : 0;
    groups.set(directionId, group);
  }
  return [...groups.values()];
}
export async function examTrainingSections(directionId: number, params: { page?: number; limit?: number; search?: string; kind?: string; progress?: string } = {}): Promise<TrainingSectionsResponse> {
  const tree = await examTrainingTree(), direction = tree.find(item => item.id === directionId);
  let sections = direction?.sections ?? [];
  if (params.kind && !["all", "exam"].includes(params.kind)) sections = [];
  if (params.search) sections = sections.filter(item => item.name.toLocaleLowerCase("ru").includes(params.search!.toLocaleLowerCase("ru")));
  if (params.progress === "learned") sections = sections.filter(item => item.total_cards > 0 && item.learned_cards === item.total_cards);
  if (params.progress === "in_progress") sections = sections.filter(item => item.learned_cards < item.total_cards);
  const paged = clientPage(sections, params), pagination = paged.pagination;
  return { success: true, student_id: selfAccount(), direction_id: directionId, direction_name: direction?.name ?? "Направление", sections: paged.items, pagination: { page: pagination.page, limit: pagination.limit, total: pagination.total, pages: pagination.totalPages, has_next: pagination.hasNext, has_prev: pagination.hasPrev } };
}
export async function examTrainingBatch(ref: string, batchIndex: number, mode?: StudyFilter): Promise<SectionBatchResponse> {
  const view = await examTrainingView(ref), filter = mode ?? view.settings.study_mode;
  const batch = view.batches.find(item => item.index === batchIndex);
  if (!batch) throw new ApiError("Набор карточек больше недоступен. Обновите подготовку", 404, undefined, "not_found");
  const cards = filterStudyCards(view.cards.slice(batchIndex * view.settings.batch_size, (batchIndex + 1) * view.settings.batch_size), filter);
  return { success: true, student_id: selfAccount(), section_kind: "exam", section_ref_id: ref, batch_index: batchIndex, batch, study_mode: filter, cards, count: cards.length };
}
export async function examTrainingSettings(ref: string, payload: StudySettingsPayload) {
  selfAccount();
  const { examId, partId } = sectionScope(ref);
  const body: StudySettingsPayload = {};
  for (const key of ["batch_size", "last_batch_index", "study_mode", "last_part_id"] as const) if (payload[key] !== undefined) Object.assign(body, { [key]: payload[key] });
  const settings = await mutation(`/exams/${examId}/training/settings${query({ part_id: partId })}`, "PUT", body);
  return { success: true, settings: record(settings) as unknown as StudySettings };
}
export async function examTrainingMark(payload: MarkCardLearnedPayload) {
  selfAccount();
  const { examId, partId } = sectionScope(payload.section_ref_id), match = /^exam:(\d+):(\d+)$/.exec(payload.card_ref);
  if (!match || Number(match[1]) !== examId || Number(match[2]) < 1) throw new ApiError("Карточка не относится к этому экзамену", 404);
  await mutation(`/exams/${examId}/training/progress/${match[2]}${query({ part_id: partId })}`, "PUT", { content_fingerprint: payload.content_fingerprint });
  return { success: true, card_ref: payload.card_ref, status: "learned" as const };
}
export async function examTrainingUnmark(cardRef: string) {
  selfAccount();
  const match = /^exam:(\d+):(\d+)$/.exec(cardRef);
  if (!match || Number(match[1]) < 1 || Number(match[2]) < 1) throw new ApiError("Карточка не найдена", 404);
  await mutation(`/exams/${match[1]}/training/progress/${match[2]}`, "DELETE", {});
  return { success: true, card_ref: cardRef, status: "unlearned" as const };
}
