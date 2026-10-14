import { ApiError } from "@/lib/api/client";
import type { AdminTrainingCardRow, AdminTrainingDirectionRow, TrainingMutationResponse } from "@/lib/training/admin-training-types";
import type { MarkCardLearnedPayload, SectionBatchResponse, SectionKind, SectionStudyViewResponse, SectionStats, StudyFilter, StudySettings, StudySettingsPayload, TrainingDirection, TrainingSectionNode, TrainingSectionsResponse } from "@/lib/training/training-types";
import { domain, getIdentity } from "./client";
import { examTrainingTree } from "./exams-student";
import { examsAllPages, examsDirections, number, record, records, string } from "./exams-shared";
import { canAccessSection } from "@/lib/auth/admin-access";

const labels: Record<string, string> = {
  conflict: "Данные изменились. Обновите список и откройте редактор заново",
  content_changed: "Содержание карточки изменилось. Изучите обновлённый ответ",
  idempotency_conflict: "Ключ сохранения уже использован для другой команды",
  not_found: "Раздел или карточка больше недоступны",
  draft_answer_limit_1000: "Ответ для теста должен содержать не более 1000 символов",
  pending_command: "Сначала подтвердите результат предыдущего действия кнопкой «Повторить»",
};
export async function cardsRequest<T>(path: string, options?: RequestInit): Promise<T> {
  try { return await domain<T>(`/cards${path}`, options); }
  catch (error) {
    if (!(error instanceof Error) || error instanceof ApiError) throw error;
    const value = record(error), code = string(value.code);
    throw new ApiError(labels[code] ?? error.message, number(value.status), undefined, code);
  }
}
export function cardsUncertain(error: unknown): boolean {
  return error instanceof ApiError && (!error.status || error.status >= 500 || error.details?.command_uncertain === true);
}
export interface CardsCommand { id: string; path: string; method: "POST" | "PUT" | "DELETE"; body: unknown; context: string; intent?: unknown; uncertain?: boolean }
const memory = new Map<string, CardsCommand>();
const executions = new Map<string, Promise<unknown>>();
async function once<T>(key: string, run: () => Promise<T>): Promise<T> {
  const active = executions.get(key);
  if (active) return active as Promise<T>;
  const promise = run(); executions.set(key, promise);
  try { return await promise; } finally { executions.delete(key); }
}
function scope(path = "") {
  const user = getIdentity()?.user;
  if (!user?.account_id || !user.organization_id) throw new ApiError("Выбранный кабинет недоступен", 403);
  return `${user.account_id}:${user.organization_id}${path === "/transforms" || path.startsWith("/sessions/") ? `:${user.division_id}` : ""}`;
}
function storageKey(context: string) { return `cpm-cards-command:${context}`; }
function readCommands(context: string): CardsCommand[] {
  try { const stored = sessionStorage.getItem(storageKey(context)); return stored ? JSON.parse(stored) as CardsCommand[] : [...memory.values()].filter(command => command.context === context); }
  catch { return [...memory.values()].filter(command => command.context === context); }
}
function persist(command: CardsCommand, remove = false) {
  const commands = readCommands(command.context).filter(item => item.id !== command.id);
  if (!remove) commands.push(command);
  if (remove) memory.delete(command.id); else memory.set(command.id, command);
  try { sessionStorage.setItem(storageKey(command.context), JSON.stringify(commands)); } catch { /* In-memory recovery remains available. */ }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("cpm-cards-command"));
}
function commandFailure(command: CardsCommand, error: unknown): unknown {
  if (cardsUncertain(error)) { command.uncertain = true; persist(command); }
  else if (command.uncertain && error instanceof ApiError && [401, 403, 404].includes(error.status ?? 0)) {
    // Losing access cannot establish whether the earlier command committed.
    persist(command);
    return new ApiError("Результат прежнего действия ещё не подтверждён. Восстановите доступ к кабинету и повторите проверку: исходная команда и ключ сохранены", error.status, undefined, error.code, { command_uncertain: true });
  } else persist(command, true);
  return error;
}
export function cardsPendingCommands(): CardsCommand[] {
  if (!getIdentity()?.user.account_id) return [];
  const contexts = new Set([scope(), scope("/transforms")]);
  return [...contexts].flatMap(readCommands);
}
export async function cardsRetry<T>(command: CardsCommand): Promise<T> {
  if (command.context !== scope(command.path)) throw new ApiError("Действие относится к другому кабинету", 409);
  return once(command.id, async () => { try {
    const result = await cardsRequest<T>(command.path, { method: command.method, body: JSON.stringify(command.body), headers: { "Idempotency-Key": command.id } });
    persist(command, true);
    return result;
  } catch (error) {
    throw commandFailure(command, error);
  } });
}
export async function cardsCommand<T>(path: string, method: CardsCommand["method"], body: unknown): Promise<T> {
  const context = scope(path), pending = readCommands(context).find(command => command.path === path);
  if (pending && (pending.method !== method || JSON.stringify(pending.body) !== JSON.stringify(body))) throw new ApiError(labels.pending_command, 409, undefined, "pending_command");
  const command = pending ?? { id: crypto.randomUUID(), path, method, body, context };
  persist(command);
  return cardsRetry<T>(command);
}
export function cardsPercent(learned: number, total: number): number {
  if (!total) return 0;
  const scaled = learned * 100 / total, lower = Math.floor(scaled), fraction = scaled - lower;
  return fraction === 0.5 ? lower + lower % 2 : Math.round(scaled);
}
function node(value: unknown): TrainingSectionNode {
  const row = record(value), stats = record(row.stats) as unknown as SectionStats;
  return { kind: string(row.kind) as SectionKind, refId: string(row.refId), name: string(row.name), stats, total_cards: stats.total, learned_cards: stats.learned, answer_changed_cards: stats.answer_changed, progress_percent: stats.progress_percent ?? cardsPercent(stats.learned, stats.total) };
}
export function mergeCardsTraining(cards: TrainingDirection[], exams: TrainingDirection[]): TrainingDirection[] {
  const groups = new Map<number, TrainingDirection>();
  for (const direction of [...cards, ...exams]) {
    const previous = groups.get(direction.id);
    const sections = [...(previous?.sections ?? []), ...direction.sections];
    const total = sections.reduce((sum, item) => sum + item.total_cards, 0), learned = sections.reduce((sum, item) => sum + item.learned_cards, 0);
    groups.set(direction.id, { ...direction, name: previous?.name ?? direction.name, sections, topics: sections, total_cards: total, learned_cards: learned, answer_changed_cards: sections.reduce((sum, item) => sum + (item.answer_changed_cards ?? 0), 0), progress_percent: cardsPercent(learned, total) });
  }
  return [...groups.values()];
}
export async function cardsTrainingTree(signal?: AbortSignal): Promise<TrainingDirection[]> {
  const [raw, exams] = await Promise.all([cardsRequest<{ directions: unknown[] }>("/tree", { signal }), examTrainingTree(signal)]);
  const cards = records(raw.directions).map(direction => ({ id: number(direction.id), name: string(direction.name), sections: records(direction.sections).map(node), total_cards: 0, learned_cards: 0, progress_percent: 0 }));
  return mergeCardsTraining(cards, exams);
}
export function cardsSectionsPage(tree: TrainingDirection[], directionId: number, params: { page?: number; limit?: number; search?: string; kind?: string; progress?: string } = {}): TrainingSectionsResponse {
  const direction = tree.find(item => item.id === directionId);
  let sections = direction?.sections ?? [];
  if (params.kind && params.kind !== "all") sections = sections.filter(item => item.kind === params.kind);
  if (params.search) sections = sections.filter(item => item.name.toLocaleLowerCase("ru").includes(params.search!.trim().toLocaleLowerCase("ru")));
  if (params.progress === "learned") sections = sections.filter(item => item.total_cards > 0 && item.total_cards === item.learned_cards);
  if (params.progress === "in_progress") sections = sections.filter(item => !item.total_cards || item.learned_cards < item.total_cards);
  const limit = Math.max(1, Math.min(100, params.limit ?? 6)), total = sections.length, pages = Math.max(1, Math.ceil(total / limit)), page = Math.max(1, Math.min(pages, params.page ?? 1));
  return { success: true, student_id: getIdentity()?.user.account_id ?? 0, direction_id: directionId, direction_name: direction?.name ?? "Направление", sections: sections.slice((page - 1) * limit, page * limit), pagination: { page, limit, total, pages, has_next: page < pages, has_prev: page > 1 } };
}
function sectionPath(kind: SectionKind, ref: string): string {
  if (kind === "exam" || (kind === "manual" ? !/^[1-9]\d*$/.test(ref) : !/^[a-f0-9]{24}$/.test(ref))) throw new ApiError("Адрес раздела не найден", 404);
  return `/sections/${kind}/${ref}`;
}
export async function cardsStudyView(kind: SectionKind, ref: string): Promise<SectionStudyViewResponse> {
  const result = await cardsRequest<Omit<SectionStudyViewResponse, "success" | "student_id">>(sectionPath(kind, ref));
  return { ...result, success: true, student_id: getIdentity()?.user.account_id ?? 0 };
}
export async function cardsStudyBatch(kind: SectionKind, ref: string, batch: number, mode?: StudyFilter): Promise<SectionBatchResponse> {
  const result = await cardsRequest<Omit<SectionBatchResponse, "success" | "student_id" | "section_kind" | "section_ref_id">>(`${sectionPath(kind, ref)}/batches/${batch}${mode ? `?study_mode=${mode}` : ""}`);
  return { ...result, success: true, student_id: getIdentity()?.user.account_id ?? 0, section_kind: kind, section_ref_id: ref };
}
export async function cardsStudySettings(kind: SectionKind, ref: string, payload: StudySettingsPayload) {
  const current = (await cardsStudyView(kind, ref)).settings;
  const settings: StudySettings = { batch_size: payload.batch_size ?? current.batch_size, study_mode: payload.study_mode ?? current.study_mode, last_batch_index: payload.last_batch_index === undefined ? current.last_batch_index : payload.last_batch_index === -1 ? null : payload.last_batch_index };
  return { success: true, settings: await cardsCommand<StudySettings>(`${sectionPath(kind, ref)}/settings`, "PUT", settings) };
}
export async function cardsStudyMark(payload: MarkCardLearnedPayload) {
  const result = await cardsCommand<{ card_ref: string; status: "learned" }>(`${sectionPath(payload.section_kind, payload.section_ref_id)}/learned`, "POST", { card_ref: payload.card_ref, content_fingerprint: payload.content_fingerprint });
  return { success: true, ...result };
}
export async function cardsStudyUnmark(cardRef: string, section?: { kind: SectionKind; ref: string }) {
  let kind: SectionKind, ref: string;
  if (section) { kind = section.kind; ref = section.ref; }
  else if (/^card:[1-9]\d*$/.test(cardRef)) {
    const tree = await cardsTrainingTree();
    let found: string | undefined;
    for (const section of tree.flatMap(direction => direction.sections).filter(item => item.kind === "manual")) {
      if ((await cardsStudyView("manual", section.refId)).cards.some(card => card.card_ref === cardRef)) { found = section.refId; break; }
    }
    if (!found) throw new ApiError(labels.not_found, 404);
    kind = "manual"; ref = found;
  } else {
    const match = /^test:([a-f0-9]{24}):[1-9]\d*$/.exec(cardRef);
    if (!match) throw new ApiError(labels.not_found, 404);
    kind = "test"; ref = match[1];
  }
  const result = await cardsCommand<{ card_ref: string; status: "unlearned" }>(`${sectionPath(kind, ref)}/learned`, "DELETE", { card_ref: cardRef });
  return { success: true, ...result };
}
export async function cardsAdminCatalog(signal?: AbortSignal): Promise<AdminTrainingDirectionRow[]> {
  const raw = await cardsRequest<{ directions: AdminTrainingDirectionRow[] }>("/admin/catalog", { signal });
  const user = getIdentity()?.user ?? null;
  if (!canAccessSection(user, "exams")) return raw.directions.map(direction => ({ ...direction, topics: direction.sections }));
  const [exams, names] = await Promise.all([examsAllPages("/exams?scope=division&type=classic", signal), examsDirections(signal)]);
  const groups = new Map(raw.directions.map(direction => [direction.id, { ...direction, sections: [...direction.sections] }]));
  for (const exam of exams) {
    const training = record(await domain(`/exams/${number(exam.id)}/training?preview=true`, { signal }));
    const stats = record(training.stats);
    const directionId = number(exam.direction_id), direction = groups.get(directionId) ?? { id: directionId, name: names.find(item => item.id === directionId)?.name ?? "Направление", sections: [], topics: [], topics_count: 0, cards_count: 0 };
    direction.sections.push({ kind: "exam", exam_id: number(exam.id), name: string(exam.name), direction_id: directionId, cards_count: number(stats.total), parts_count: records(training.parts).length, visible: Boolean(exam.training_enabled), training_enabled: Boolean(exam.training_enabled) });
    groups.set(directionId, direction);
  }
  return [...groups.values()].map(direction => ({ ...direction, topics: direction.sections, topics_count: direction.sections.length, cards_count: direction.sections.reduce((sum, section) => sum + section.cards_count, 0) }));
}
export async function cardsAdminCards(themeId: number, signal?: AbortSignal): Promise<AdminTrainingCardRow[]> {
  const cards = await cardsRequest<unknown[]>(`/themes/${themeId}/cards`, { signal });
  return records(cards).map(card => ({ id: number(card.card_id), theme_id: themeId, question: string(card.question), answer: string(card.answer), sort_order: number(card.sort_order), revision: number(card.revision) }));
}
export async function cardsAdminMutation(path: string, method: CardsCommand["method"], body: unknown): Promise<TrainingMutationResponse> {
  const result = record(await cardsCommand(path, method, body));
  return { success: true, theme_id: number(result.id) || undefined, card_id: number(result.card_id) || undefined, direction_id: number(result.direction_id) || undefined, revision: number(result.revision) || undefined };
}
export interface CardsTransformSession { session_id: string; revision: number; state: "preview" | "completed"; result?: { draft_id: string }; preview: { draft_title: string; selected_cards?: unknown[] } }
export async function cardsTransform(themeId: number, cardIds: number[]) { return cardsCommand<CardsTransformSession>("/transforms", "POST", { theme_id: themeId, card_ids: cardIds }); }
export async function cardsCommitTransform(session: Pick<CardsTransformSession, "session_id" | "revision">) { return cardsCommand<{ draft_id: string; cards_selected: number }>(`/sessions/${session.session_id}/commit`, "POST", { expected_revision: session.revision }); }
export async function cardsRecover(command: CardsCommand): Promise<unknown> {
  if (command.path !== "/transforms") return cardsRetry(command);
  if (command.context !== scope(command.path)) throw new ApiError("Действие относится к другому кабинету", 409);
  return once(`recover:${command.id}`, async () => {
  // Keep the preview command until its committed session is safely journaled.
  let session: CardsTransformSession;
  try { session = await cardsRequest<CardsTransformSession>(command.path, { method: "POST", body: JSON.stringify(command.body), headers: { "Idempotency-Key": command.id } }); }
  catch (error) { throw commandFailure(command, error); }
  if (!/^[a-f0-9]{32}$/.test(session.session_id)) throw commandFailure(command, new ApiError("Сервер не подтвердил подготовку черновика", 502));
  const commit: CardsCommand = { id: crypto.randomUUID(), path: `/sessions/${session.session_id}/commit`, method: "POST", body: { expected_revision: session.revision }, context: command.context, intent: command.body };
  persist(commit); persist(command, true);
  return cardsRetry(commit);
  });
}
export async function cardsTransformDraft(themeId: number, cardIds: number[]): Promise<{ draft_id: string }> {
  const context = scope("/transforms"), pending = readCommands(context).find(command => command.path === "/transforms" || command.path.endsWith("/commit"));
  const body = { theme_id: themeId, card_ids: cardIds };
  if (pending) {
    if (JSON.stringify(pending.intent ?? pending.body) !== JSON.stringify(body)) throw new ApiError(labels.pending_command, 409, undefined, "pending_command");
    return await cardsRecover(pending) as { draft_id: string };
  }
  const command: CardsCommand = { id: crypto.randomUUID(), path: "/transforms", method: "POST", body, context };
  persist(command);
  return await cardsRecover(command) as { draft_id: string };
}
