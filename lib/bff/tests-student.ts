import { domain, getIdentity } from "./client";
import { BFF_EXTERNAL_TESTS_DEV } from "@/lib/config";
import type { Direction, StudentTestItem, TestSession, TestsDateFilter, TestsWithSessionsResponse, TestStatusFilter } from "@/lib/student/tests-types";
import type { AttemptEnvelope, PracticeFeedback, QuestionType, StoredAttemptAnswer, SubmitAttemptResponse, TestAttempt } from "@/lib/student/test-attempt-types";
import type { CommitSyncResponse, PracticeAnswerResponse } from "@/lib/student/test-attempt-api";
import type { FinalAttemptSnapshot } from "@/lib/student/test-attempt-v2-store";
import type { TestReviewResponse } from "@/lib/student/test-review-types";

interface Page<T> { items: T[]; total: number; limit: number; offset: number }
interface Access { test_id: string; division_id: number; official_access_allowed: boolean; official_reason: string; review_access_allowed: boolean; practice_access_allowed: boolean; attempt_id: string | null; submission_id: string | null; calculation_status: string; server_time: string }
interface Question { question_id: number; type: QuestionType; text: string; points: number; answers?: { id: string; text: string; is_correct?: boolean }[]; correct_answers?: string[] }
interface Answer { question_id: number; value: string | string[] }
interface Grade { score: number; earned_points: number; max_points: number; question_results?: { question_id: number; points: number; is_correct: boolean }[] }
interface Attempt { id: string; account_id: number; organization_id: number; division_id: number; test_id: string; test_version_id: string; practice: boolean; status: string; started_at: string; completed_at: string | null; answer_deadline: string; upload_deadline: string; server_time: string; question_order: number[]; questions: Question[]; answers: Answer[]; commits: { commit_id: string; sequence: number; question_id: number; value: string | string[]; answered_at: string }[]; calculation_status: string; submission_id: string | null; result: Grade | null }
interface Submission { attempt_id: string; submission_id: string; test_id: string; accepted_at: string; submission_status: string; calculation_status: string; result: Grade | null }

export interface StudentTestsFilters { signal?: AbortSignal; search?: string; status?: TestStatusFilter; dates?: TestsDateFilter }

interface CatalogAttemptSummary { id: string; answer_deadline: string; upload_deadline: string; answered_count: number; total_questions: number }
interface CatalogSessionSummary { id: string; completed_at: string | null; score: number | null; calculation_status: string }
interface StudentCatalogRow {
  id: string; organization_id: number; division_id: number; account_id: number; direction_id: number; direction_name: string; title: string;
  start_at: string | null; end_at: string | null; time_limit_minutes: number; status: StudentTestItem["status"];
  access: Access | null; active_attempt: CatalogAttemptSummary | null; session: CatalogSessionSummary | null;
  is_external: boolean; date?: string; has_result: boolean; rate: number | null;
}
interface StudentCatalogPage extends Page<StudentCatalogRow> { server_time: string }

export async function studentDirections(signal?: AbortSignal): Promise<Direction[]> {
  return [{ id: 0, name: "Все направления" }, ...await domain<Direction[]>("/core/directions", { signal })];
}

function storedAnswer(answer: Answer, type: QuestionType): StoredAttemptAnswer {
  return { questionId: answer.question_id, type, ...(type === "single" ? { selectedAnswer: String(answer.value) } : type === "multiple" ? { selectedAnswers: Array.isArray(answer.value) ? answer.value : [] } : { textAnswer: String(answer.value) }) };
}

export function answerValue(answer: StoredAttemptAnswer): Answer {
  return { question_id: answer.questionId, value: answer.type === "single" ? answer.selectedAnswer ?? "" : answer.type === "multiple" ? [...answer.selectedAnswers ?? []].sort() : answer.textAnswer ?? "" };
}

export function adaptAttempt(raw: Attempt): TestAttempt {
  const now = Date.parse(raw.server_time);
  const deadline = Date.parse(raw.answer_deadline);
  const answered = new Set((raw.answers ?? []).map(a => a.question_id));
  return {
    attemptId: raw.id, studentId: raw.account_id, organizationId: raw.organization_id, divisionId: raw.division_id,
    testId: raw.test_id, testVersionId: raw.test_version_id, status: raw.status, isPractice: raw.practice,
    schemaVersion: raw.practice ? 1 : 2, hasTimeLimit: !raw.practice,
    startedAt: raw.started_at, startedAtMoscow: raw.started_at, startedAtEpochMs: Date.parse(raw.started_at),
    expiresAt: raw.answer_deadline, answerDeadlineMoscow: raw.answer_deadline, answerDeadlineEpochMs: deadline,
    uploadDeadlineMoscow: raw.upload_deadline, uploadDeadlineEpochMs: Date.parse(raw.upload_deadline),
    remainingSeconds: raw.practice ? 0 : Math.max(0, Math.floor((deadline - now) / 1000)), timeExpired: !raw.practice && now >= deadline,
    serverNowMoscow: raw.server_time, serverNowEpochMs: now, questionOrder: raw.question_order,
    questions: (raw.questions ?? []).map(q => ({ questionId: q.question_id, type: q.type, text: q.text, points: q.points, answers: q.answers?.map(a => ({ id: a.id, text: a.text })), locked: answered.has(q.question_id) })),
    answers: (raw.answers ?? []).map(a => storedAnswer(a, raw.questions.find(q => q.question_id === a.question_id)?.type ?? "text")),
    serverCommits: raw.commits ?? [], answeredCount: answered.size, totalQuestions: raw.question_order.length,
    submissionId: raw.submission_id ?? undefined, calculationStatus: raw.calculation_status,
  };
}

export async function studentCatalog(directionName: string | null, page: number, limit: number, overview: boolean, filters: StudentTestsFilters = {}): Promise<TestsWithSessionsResponse> {
  const identity = getIdentity();
  const division = identity?.user.division_id;
  const organization = identity?.user.organization_id;
  if (!division || !organization) throw new Error("Выберите подразделение");
  const snapshot = `${identity.context_revision}:${organization}:${division}:${identity.user.account_id}`;
  const assertCurrentContext = () => {
    filters.signal?.throwIfAborted();
    const live = getIdentity();
    if (`${live?.context_revision}:${live?.user.organization_id}:${live?.user.division_id}:${live?.user.account_id}` !== snapshot) throw new Error("Кабинет изменился. Обновите список.");
  };
  assertCurrentContext();
  const directions = directionName && directionName !== "Все направления" ? await studentDirections(filters.signal) : [];
  assertCurrentContext();
  const selected = directions.find(d => d.name === directionName);
  if (directionName && directionName !== "Все направления" && !selected) throw new Error("Направление больше недоступно");
  const params = new URLSearchParams();
  if (selected?.id) params.set("direction_id", String(selected.id));
  if (filters.search?.trim()) params.set("q", filters.search.trim());
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("Некорректная страница тестов");
  params.set("limit", String(limit));
  params.set("offset", String((page - 1) * limit));
  params.set("overview", String(overview));
  params.set("include_external", String(BFF_EXTERNAL_TESTS_DEV));
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.dates?.startDate) params.set("date_from", filters.dates.startDate);
  if (filters.dates?.endDate) params.set("date_to", filters.dates.endDate);
  const catalog = await domain<StudentCatalogPage>(`/tests/student-catalog?${params}`, { signal: filters.signal });
  assertCurrentContext();
  if (!Array.isArray(catalog.items) || !Number.isSafeInteger(catalog.total) || catalog.total < 0 || catalog.limit !== limit || catalog.offset !== (page - 1) * limit || catalog.items.length > limit) throw new Error("Некорректный ответ списка тестов");
  const sessions: TestSession[] = [];
  const seen = new Set<string>();
  const tests = catalog.items.map((row): StudentTestItem => {
    if (row.organization_id !== organization || row.division_id !== division || row.account_id !== identity.user.account_id) throw new Error("Некорректная область каталога тестов");
    if (seen.has(row.id)) throw new Error("Список тестов изменился. Повторите загрузку.");
    seen.add(row.id);
    if (row.is_external) {
      if (!BFF_EXTERNAL_TESTS_DEV || row.status !== "external" || row.access || row.active_attempt || row.session || row.rate !== null && (!Number.isFinite(row.rate) || row.rate < 0 || row.rate > 100)) throw new Error("Некорректный внешний тест");
      return { id: row.id, title: row.title, name: row.title, date: row.date, directionName: row.direction_name,
        isExternal: true, externalTest: true, status: "external", hasResult: row.has_result, rate: row.has_result ? row.rate : null,
        canStart: false, canPractice: false, canResume: false, canViewResults: false };
    }
    const access = row.access;
    if (!access || access.division_id !== division || access.test_id !== row.id || row.active_attempt && row.active_attempt.id !== access.attempt_id || row.session && row.session.id !== access.submission_id) throw new Error("Некорректная область каталога тестов");
    const accepted = Boolean(access.submission_id);
    if (accepted !== Boolean(row.session) || accepted && row.active_attempt) throw new Error("Некорректный результат теста");
    if (row.session) sessions.push({ id: row.session.id, testId: row.id, completedAt: row.session.completed_at ?? undefined,
      score: row.session.calculation_status === "ready" ? row.session.score ?? undefined : undefined, calculationStatus: row.session.calculation_status });
    const attempt = row.active_attempt;
    return {
      id: row.id, title: row.title, directionName: row.direction_name, startDate: row.start_at, endDate: row.end_at,
      timeLimitMinutes: row.time_limit_minutes, status: row.status, isCompleted: accepted,
      canStart: access.official_access_allowed && !access.attempt_id,
      canResume: access.official_reason === "resume_attempt", canSubmitExpired: access.official_reason === "pending_upload",
      canRequestHelp: access.official_reason === "upload_deadline_passed",
      canPractice: access.practice_access_allowed, canViewResults: access.review_access_allowed,
      calculationStatus: access.calculation_status || undefined,
      activeAttempt: attempt ? { id: attempt.id, expiresAt: attempt.answer_deadline, uploadDeadline: attempt.upload_deadline,
        remainingSeconds: Math.max(0, Math.floor((Date.parse(attempt.answer_deadline) - Date.parse(catalog.server_time)) / 1000)),
        answeredCount: attempt.answered_count, totalQuestions: attempt.total_questions } : null,
    };
  });
  return { success: true, tests, sessions, serverTimeMoscow: catalog.server_time,
    pagination: { current_page: page, total_pages: Math.max(1, Math.ceil(catalog.total / limit)), total_items: catalog.total, items_per_page: limit } };
}

export async function studentAttempt(attemptId: string): Promise<AttemptEnvelope> {
  const raw = await domain<Attempt>(`/tests/attempts/${encodeURIComponent(attemptId)}`);
  const attempt = adaptAttempt(raw);
  if (raw.practice && raw.status === "in_progress") {
    const feedback: PracticeFeedback[] = [];
    for (const answer of attempt.answers) {
      const checked = await studentPracticeAnswer(raw.id, answer);
      if (checked.feedback) feedback.push(checked.feedback);
    }
    attempt.practiceFeedback = feedback;
  }
  return { success: true, attempt };
}

export async function studentStart(testId: string, practice = false): Promise<AttemptEnvelope> {
  const raw = await domain<Attempt>(`/tests/${encodeURIComponent(testId)}/attempts`, { method: "POST", body: JSON.stringify({ practice }) });
  // Resume training feedback through the same idempotent owner method.
  return raw.practice && raw.answers.length ? studentAttempt(raw.id) : { success: true, attempt: adaptAttempt(raw) };
}

export async function studentCommits(attemptId: string, commits: (StoredAttemptAnswer & { commitId: string; sequence: number; committedAtMoscow: string })[]): Promise<CommitSyncResponse> {
  const data = await domain<{ acknowledged_commit_ids: string[]; server_answer_count: number; server_time: string }>(`/tests/attempts/${encodeURIComponent(attemptId)}/commits`, { method: "POST", body: JSON.stringify({ commits: commits.map(c => ({ ...answerValue(c), commit_id: c.commitId, sequence: c.sequence, answered_at: c.committedAtMoscow })) }) });
  return { success: true, ackedCommitIds: data.acknowledged_commit_ids, serverAnswerCount: data.server_answer_count, serverNowEpochMs: Date.parse(data.server_time) };
}

export function finalizePayload(snapshot: FinalAttemptSnapshot) {
  // The local integrity hash covers the UI envelope; the owner hashes this contract itself.
  return { test_version_id: snapshot.testVersionId, completed_at: snapshot.completedAtMoscow, reason: snapshot.reason, answers: snapshot.answers.map(answerValue) };
}

function acceptedResult(raw: Submission): SubmitAttemptResponse {
  return { success: true, sessionId: raw.submission_id, submissionStatus: raw.submission_status, calculationStatus: raw.calculation_status };
}

export async function studentFinalize(attemptId: string, snapshot: FinalAttemptSnapshot): Promise<SubmitAttemptResponse> {
  return acceptedResult(await domain<Submission>(`/tests/attempts/${encodeURIComponent(attemptId)}/finalize`, { method: "POST", body: JSON.stringify(finalizePayload(snapshot)) }));
}

export async function studentSubmit(attemptId: string): Promise<SubmitAttemptResponse> {
  const raw = await domain<Submission | Attempt>(`/tests/attempts/${encodeURIComponent(attemptId)}/submit`, { method: "POST", body: JSON.stringify({}) });
  if ("practice" in raw && raw.practice) {
    const totalQuestions = raw.question_order.length;
    const correctAnswers = raw.result?.question_results?.filter(q => q.is_correct).length;
    const accuracy = correctAnswers == null ? undefined : totalQuestions ? Math.round(correctAnswers / totalQuestions * 1000) / 10 : 0;
    return { success: true, isPractice: true, score: raw.result?.score, stats: { totalQuestions, totalPoints: raw.result?.earned_points, accuracy, correctAnswers } };
  }
  return acceptedResult(raw as Submission);
}

export async function studentPracticeAnswer(attemptId: string, answer: StoredAttemptAnswer): Promise<PracticeAnswerResponse> {
  const raw = await domain<{ feedback: { is_correct: boolean; points: number; correct_answer: string | string[] }; answered_count: number; total_questions: number }>(`/tests/attempts/${encodeURIComponent(attemptId)}/practice-answer`, { method: "POST", body: JSON.stringify(answerValue(answer)) });
  const correct = Array.isArray(raw.feedback.correct_answer) ? raw.feedback.correct_answer : [raw.feedback.correct_answer];
  return { success: true, answeredCount: raw.answered_count, totalQuestions: raw.total_questions, feedback: { questionId: answer.questionId, answer, points: raw.feedback.points, isCorrect: raw.feedback.is_correct, correct: answer.type === "text" ? { correctAnswers: correct } : { correctOptionIds: correct } } };
}

export async function studentReview(submissionId: string, signal?: AbortSignal): Promise<TestReviewResponse> {
  const raw = await domain<{ submission: Submission; questions: Question[]; answers: Answer[]; question_order: number[]; question_results: { question_id: number; points: number; is_correct: boolean }[]; excluded_question_ids: number[] }>(`/tests/submissions/${encodeURIComponent(submissionId)}/review`, { signal });
  const excluded = new Set(raw.excluded_question_ids ?? []);
  return { success: true, review: { sessionId: submissionId, testId: raw.submission.test_id, score: raw.submission.result?.score, completedAt: raw.submission.accepted_at, questionOrder: raw.question_order.filter(id => !excluded.has(id)), visible: true, showCorrectAnswers: true, items: raw.question_order.flatMap(id => { const question = raw.questions.find(q => q.question_id === id); return question && !excluded.has(id) ? [question] : []; }).map(q => {
    const result = raw.question_results.find(r => r.question_id === q.question_id);
    const answer = raw.answers.find(a => a.question_id === q.question_id);
    return { questionId: q.question_id, question: { questionId: q.question_id, type: q.type, text: q.text, points: q.points, answers: q.answers?.map(a => ({ id: a.id, text: a.text, isCorrect: a.is_correct })) }, studentAnswer: answer ? storedAnswer(answer, q.type) : null, points: result?.points ?? 0, isCorrect: result?.is_correct ?? false, correct: { correctAnswers: q.correct_answers, correctOptionIds: q.answers?.filter(a => a.is_correct).map(a => a.id) } };
  }) } };
}
