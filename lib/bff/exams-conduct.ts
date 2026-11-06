import { ApiError } from "@/lib/api/client";
import type { ExamCommand, Query } from "@/lib/exams-v2/api";
import type { AttemptState, CommandResult, ExaminerAssignment, ExaminerExam, PresentedQuestion, Receipt, Round, Vote } from "@/lib/exams-v2/types";
import { domain } from "./client";
import { examDetail, examOwnerPage, mappedExamPage, examsDirections, nullableString, number, ownerPage, ownerPerson, ownerResult, ownerValidation, record, records, string } from "./exams-shared";

export function conductRound(value: unknown): Round {
  const v = record(value);
  return { id: number(v.id), roundNo: number(v.round_no), status: string(v.status) as Round["status"], votesReceived: number(v.votes_count), votesRequired: number(v.required_votes), hasVoted: v.has_voted === true, myVote: typeof v.own_vote === "number" ? v.own_vote as Vote : null, consensus: typeof v.consensus === "number" ? v.consensus as Vote : null, ...(Array.isArray(v.votes) ? { votes: records(v.votes).map(r => ({ examinatorId: number(r.examinator_account_id), fullName: string(r.full_name), value: number(r.value) as Vote })) } : {}) };
}
export function conductQuestion(value: unknown): PresentedQuestion {
  const v = record(value), rounds = records(v.rounds).map(conductRound), closed = rounds.filter(r => r.status !== "open");
  return { id: number(v.id), sequenceNo: number(v.sequence_no), purpose: string(v.purpose) as PresentedQuestion["purpose"], partCode: string(v.part_code), questionText: string(v.question_text), answerText: string(v.answer_text), weight: number(v.question_weight), cycleNo: number(v.cycle_no), status: string(v.status) as PresentedQuestion["status"], consensus: typeof v.consensus === "number" ? v.consensus as Vote : null, awardedPoints: typeof v.weighted_score === "number" ? v.weighted_score : undefined, replacesPresentedQuestionId: number(v.replaces_id) || null, canReplace: v.can_replace === true, canGoNext: v.can_go_next === true, round: v.round ? conductRound(v.round) : null, lastCompletedRound: closed.at(-1) ?? null, completedRoundsCount: closed.length };
}
export function conductAttempt(value: unknown, directionName = "Экзамен"): AttemptState {
  const v = record(value), p = record(v.progress), permission = record(v.permissions);
  return { id: number(v.id), examId: number(v.exam_id), directionName, assignmentId: number(v.assignment_id), attemptNo: number(v.attempt_no, 1) as 1 | 2, historyGeneration: number(v.history_generation), student: ownerPerson(v.student), status: string(v.status) as AttemptState["status"], phase: string(v.phase) as AttemptState["phase"], stateVersion: number(v.state_version), members: records(v.members).map(m => ({ ...ownerPerson(m), ready: m.ready === true, readyAt: nullableString(m.ready_at) })), allMembersReady: v.all_members_ready === true, startedAt: nullableString(v.started_at), completedAt: nullableString(v.completed_at), serverNow: string(v.server_now), currentQuestion: v.current_question ? conductQuestion(v.current_question) : null, progress: { regularConsensus: number(p.regular_consensus), regularRequired: number(p.regular_required), replacementUsed: number(p.replacement_used), replacementLimit: number(p.replacement_limit), parts: records(p.parts).map(r => ({ sourcePartId: number(r.part_id), code: string(r.code), consensus: number(r.consensus), required: number(r.required) })) }, result: v.status === "completed" && v.result ? ownerResult(v.result) : null, permissions: { canReady: permission.can_ready === true, canStart: permission.can_start === true, canVote: permission.can_vote === true, canReplace: permission.can_replace === true, canGoNext: permission.can_go_next === true } };
}
function receipt(value: unknown): Receipt {
  const v = record(value);
  return { ...v, commandId: number(v.command_id), outcome: string(v.outcome), appliedStateVersion: number(v.applied_state_version), presentedQuestionId: number(v.presented_question_id) || undefined, resolvedQuestionId: number(v.resolved_question_id) || undefined, ...(typeof v.consensus === "number" ? { consensus: v.consensus as Vote, resolvedQuestion: { id: number(v.resolved_question_id), consensus: v.consensus as Vote } } : {}) };
}

function parse(path: string, params: Query) {
  const u = new URL(path, "http://exam.local");
  const q: Query = { ...Object.fromEntries(u.searchParams), ...params };
  return { path: u.pathname, q };
}
function assignment(v: Record<string, unknown>): ExaminerAssignment {
  const readiness = record(v.readiness), attemptId = number(v.attempt_id) || null;
  return { assignmentId: number(v.id), attemptNo: number(v.attempt_no, 1) as 1 | 2, student: ownerPerson(v.student), commission: records(v.members).map(ownerPerson), replacementLimit: number(v.replacement_limit), status: string(v.status, "not_started") as ExaminerAssignment["status"], attemptId, historyGeneration: number(v.history_generation), canPrepare: readiness.can_prepare === true, canStart: readiness.can_start_now === true, unavailableReasons: ownerValidation(readiness.errors) };
}
export async function examsConductGet(input: string, params: Query = {}, signal?: AbortSignal): Promise<unknown> {
  const { path, q } = parse(input, params);
  if (/^\/api\/exams\/lookups\/(students|examinators)$/.test(path)) {
    const role = path.endsWith("students") ? "student" : "examinator";
    return mappedExamPage(await examOwnerPage("/core/exam-participants", q, { role, q: q.search }, signal), ownerPerson);
  }
  if (path === "/api/examiner/exams") {
    const [page, directions] = await Promise.all([examOwnerPage("/exams", q, { type: "classic", q: q.search }, signal), examsDirections(signal)]);
    return mappedExamPage(page, exam => ({ id: number(exam.id), directionId: number(exam.direction_id), directionName: string(exam.name, directions.find(d => d.id === number(exam.direction_id))?.name), startAt: nullableString(exam.start_at), endAt: nullableString(exam.end_at), readiness: "", assignedStudentsCount: number(exam.assigned_students_count) } satisfies ExaminerExam));
  }
  let m = path.match(/^\/api\/examiner\/exams\/(\d+)\/students$/);
  if (m) return mappedExamPage(await examOwnerPage(`/exams/${m[1]}/assignments`, q, { q: q.search, status: q.status, include_readiness: true }, signal), assignment);
  if (/^\/api\/examiner\/attempts\//.test(path)) throw new ApiError("Выберите экзамен перед открытием сдачи", 400, undefined, "exam_required");
  m = path.match(/^\/api\/examiner\/exams\/(\d+)\/attempts\/(\d+)(?:\/questions(?:\/(\d+)\/rounds)?)?$/) ?? path.match(/^\/api\/exams\/(\d+)\/classic\/attempts\/(\d+)\/questions(?:\/(\d+)\/rounds)?$/);
  if (!m) return undefined;
  const examId = Number(m[1]), attemptId = Number(m[2]);
  if (!path.includes("/questions")) {
    const [raw, detail] = await Promise.all([domain(`/exams/${examId}/attempts/${attemptId}`, { signal }), examDetail(examId, signal)]);
    return { attempt: conductAttempt(raw, string(detail.name, "Экзамен")) };
  }
  const questionId = m[3], limit = Math.max(1, Math.min(200, Number(q.limit) || 10)), offset = (Math.max(1, Number(q.page) || 1) - 1) * limit, query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (q.throughSequenceNo !== undefined) query.set("through_sequence_no", String(q.throughSequenceNo));
  if (q.throughRoundNo !== undefined) query.set("through_round_no", String(q.throughRoundNo));
  const raw = record(await domain(`/exams/${examId}/attempts/${attemptId}/${questionId ? `questions/${questionId}/rounds` : "protocol"}?${query}`, { signal }));
  return { ...ownerPage<Round | PresentedQuestion>(records(raw.items).map(v => questionId ? conductRound(v) : conductQuestion(v)), number(raw.total), limit, offset), throughSequenceNo: number(raw.through_sequence_no), throughRoundNo: number(raw.through_round_no) };
}
export async function examsConductMutate(command: ExamCommand): Promise<unknown> {
  const { path } = parse(command.path, {}), v = record(command.body);
  if (/^\/api\/examiner\/attempts\//.test(path)) throw new ApiError("Выберите экзамен перед изменением сдачи", 400, undefined, "exam_required");
  const ensure = path.match(/^\/api\/examiner\/exams\/(\d+)\/assignments\/(\d+)\/attempts\/ensure$/), action = path.match(/^\/api\/examiner\/exams\/(\d+)\/attempts\/(\d+)\/(ready|start|vote|next-question|replace-question)$/);
  if (!ensure && !action) return undefined;
  const examId = Number(ensure?.[1] ?? action?.[1]);
  const name = action?.[3], body = ensure ? { expected_history_generation: v.expectedHistoryGeneration } : name === "ready" ? {} : name === "vote" ? { presented_question_id: v.presentedQuestionId, round_id: v.roundId, value: v.value } : name === "start" ? { expected_state_version: v.expectedStateVersion } : { presented_question_id: v.presentedQuestionId, expected_state_version: v.expectedStateVersion };
  const response = record(await domain(`/exams/${examId}/${ensure ? `assignments/${ensure[2]}/attempts/ensure` : `attempts/${action![2]}/${name}`}`, { method: "POST", body: JSON.stringify(body), headers: { "Idempotency-Key": command.key } }));
  const attempt = conductAttempt(response.attempt);
  return { attempt, receipt: receipt(response.receipt), replayed: response.replayed === true, created: response.created === true } satisfies CommandResult;
}
