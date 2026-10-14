import { domain, getIdentity } from "./client";
import type { AdminExternalTestFormData, AdminTestListItem } from "@/lib/admin/admin-tests-types";
import type { StudentTestItem } from "@/lib/student/tests-types";

export interface ExternalResult {
  id: string;
  revision: number;
  account_id: number;
  student_id: number;
  full_name?: string;
  score: number | null;
  updated_at?: string;
  correct_count?: number;
  completed_at?: string;
  time_spent?: string;
  login?: string;
  source_row_id?: string;
}
export interface ExternalTest {
  id: string;
  revision: number;
  organization_id: number;
  division_id: number;
  name: string;
  direction_id: number;
  direction_name: string;
  date: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  actions: { can_edit: boolean; can_delete: boolean; can_view_results: boolean };
  result?: ExternalResult | null;
}
export interface ExternalDeletePreview {
  test: ExternalTest;
  results_count: number;
  confirmation_token: string;
  expires_at: string;
}
export interface ExternalHistory {
  id: string;
  revision: number;
  action: string;
  actor_id: number;
  changed_at: string;
  account_id?: number;
  metadata_before?: unknown;
  metadata_after?: unknown;
  result_changes?: unknown[];
}
interface Page<T> { items: T[]; total: number; limit: number; offset: number }
export interface ExternalCatalogFilters { directionId?: number; search?: string; dateFrom?: string; dateTo?: string; accountId?: number; signal?: AbortSignal }
export interface ExternalResultItem { test: ExternalTest; result: ExternalResult | null }

const pendingCreates = new Map<string, string>();
const pendingCommands = new Map<string, string>();
const previews = new Map<string, ExternalDeletePreview>();
const path = (id: string) => {
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new Error("Недопустимый ID внешнего теста");
  return `/tests/external-tests/${id}`;
};
function context() {
  const identity = getIdentity();
  if (!identity?.user.organization_id || !identity.user.division_id) throw new Error("Выберите подразделение");
  return `${identity.context_revision}:${identity.user.organization_id}:${identity.user.division_id}`;
}
function currentScope(test: ExternalTest) {
  const user = getIdentity()?.user;
  if (test.organization_id !== user?.organization_id || test.division_id !== user?.division_id) throw new Error("Кабинет изменился. Обновите список.");
  if (user.role === "student" && test.result && test.result.account_id !== user.account_id) throw new Error("Некорректный результат ученика");
  if (test.result) validResultScore(test.result);
  return test;
}
function validResultScore(result: ExternalResult) {
  if (result.score !== null && (typeof result.score !== "number" || !Number.isFinite(result.score) || result.score < 0 || result.score > 100)) throw new Error("Некорректный балл внешнего теста");
}
export async function externalPages<T>(resource: string, signal?: AbortSignal): Promise<T[]> {
  const items: T[] = [];
  for (let offset = 0; offset <= 100000; offset += 100) {
    signal?.throwIfAborted();
    const page = await domain<Page<T>>(`${resource}${resource.includes("?") ? "&" : "?"}limit=100&offset=${offset}`, { signal });
    if (!Array.isArray(page.items) || !Number.isSafeInteger(page.total) || page.total < 0) throw new Error("Некорректный ответ списка внешних тестов");
    items.push(...page.items);
    if (items.length >= page.total) return items;
    if (!page.items.length) throw new Error("Список изменился. Обновите его.");
  }
  throw new Error("Список слишком большой. Уточните фильтры.");
}
function catalogQuery(filters: ExternalCatalogFilters) {
  const query = new URLSearchParams();
  if (filters.directionId) query.set("direction_id", String(filters.directionId));
  if (filters.search?.trim()) query.set("q", filters.search.trim());
  if (filters.dateFrom) query.set("date_from", filters.dateFrom);
  if (filters.dateTo) query.set("date_to", filters.dateTo);
  if (filters.accountId !== undefined) {
    if (!Number.isSafeInteger(filters.accountId) || filters.accountId < 1) throw new Error("Недопустимый ID учётной записи");
    query.set("account_id", String(filters.accountId));
  }
  return query;
}
export async function externalCatalog(filters: ExternalCatalogFilters = {}): Promise<ExternalTest[]> {
  const rows = await externalPages<ExternalTest>(`/tests/external-tests?${catalogQuery(filters)}`, filters.signal);
  return rows.map(currentScope);
}
export async function externalTest(id: string, signal?: AbortSignal): Promise<ExternalTest> {
  return currentScope(await domain<ExternalTest>(path(id), { signal }));
}
export function externalAdminItem(test: ExternalTest): AdminTestListItem {
  return { id: test.id, name: test.name, title: test.name, directionName: test.direction_name, date: test.date, revision: test.revision,
    isExternal: true, externalTest: true, externalActions: test.actions, isAttached: true, isOwner: true };
}
export function externalStudentItem(test: ExternalTest): StudentTestItem {
  currentScope(test);
  const hasResult = test.result != null;
  return { id: test.id, name: test.name, title: test.name, date: test.date, directionName: test.direction_name,
    isExternal: true, externalTest: true, status: "external", hasResult, rate: hasResult ? test.result!.score : null,
    canStart: false, canPractice: false, canResume: false, canViewResults: false };
}
export async function createExternalTest(payload: AdminExternalTestFormData): Promise<ExternalTest> {
  const body = { name: payload.name.trim(), direction_id: payload.direction_id, date: payload.date };
  const scope = `${context()}:${JSON.stringify(body)}`;
  const key = pendingCreates.get(scope) ?? crypto.randomUUID();
  pendingCreates.set(scope, key);
  try {
    const test = currentScope(await domain<ExternalTest>("/tests/external-tests", { method: "POST", body: JSON.stringify(body), headers: { "Idempotency-Key": key } }));
    pendingCreates.delete(scope);
    return test;
  } catch (error) { throw externalError(error); }
}
export async function externalDeletePreview(id: string): Promise<ExternalDeletePreview> {
  const data = await domain<ExternalDeletePreview>(`${path(id)}/delete-preview`);
  currentScope(data.test);
  previews.set(`${context()}:${id}`, data);
  return data;
}
export async function deleteExternalTest(id: string): Promise<{ test_id: string; results_deleted: number }> {
  const key = `${context()}:${id}`, preview = previews.get(key);
  if (!preview) throw new Error("Сначала откройте подтверждение удаления");
  try {
    const result = await domain<{ test_id: string; results_deleted: number }>(path(id), { method: "DELETE", body: JSON.stringify({ expected_revision: preview.test.revision, confirmation_token: preview.confirmation_token }) });
    previews.delete(key);
    return result;
  } catch (error) { previews.delete(key); throw externalError(error); }
}
export async function externalResults(id: string, signal?: AbortSignal): Promise<ExternalResult[]> {
  return externalPages<ExternalResult>(`${path(id)}/results`, signal);
}
export async function externalHistory(id: string, signal?: AbortSignal): Promise<ExternalHistory[]> {
  return externalPages<ExternalHistory>(`${path(id)}/history`, signal);
}
export async function updateExternalTest(test: ExternalTest, payload: AdminExternalTestFormData): Promise<ExternalTest> {
  currentScope(test);
  return currentScope(await externalCommand<ExternalTest>(path(test.id), "PUT", { expected_revision: test.revision, name: payload.name.trim(), direction_id: payload.direction_id, date: payload.date }));
}
export async function externalResultItems(filters: ExternalCatalogFilters = {}): Promise<ExternalResultItem[]> {
  const rows = await externalPages<ExternalResultItem>(`/tests/external-results?${catalogQuery(filters)}`, filters.signal);
  for (const row of rows) {
    currentScope(row.test);
    const expectedAccount = getIdentity()?.user.role === "student" ? getIdentity()?.user.account_id : filters.accountId;
    if (row.result && expectedAccount !== undefined && row.result.account_id !== expectedAccount) throw new Error("Некорректный результат ученика");
    if (row.result) validResultScore(row.result);
  }
  return rows;
}
async function externalCommand<T>(resource: string, method: string, body: unknown): Promise<T> {
  const scope = `${context()}:${method}:${resource}:${JSON.stringify(body)}`;
  const key = pendingCommands.get(scope) ?? crypto.randomUUID();
  pendingCommands.set(scope, key);
  try {
    const result = await domain<T>(resource, { method, body: JSON.stringify(body), headers: { "Idempotency-Key": key } });
    pendingCommands.delete(scope);
    return result;
  } catch (error) { throw externalError(error); }
}
export async function correctExternalResult(test: ExternalTest, accountId: number, resultRevision: number, score: number | null): Promise<ExternalTest> {
  currentScope(test);
  if (!Number.isSafeInteger(accountId) || accountId < 1) throw new Error("Укажите ID учётной записи ученика");
  if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100)) throw new Error("Укажите балл от 0 до 100 или оставьте поле пустым");
  await externalCommand(`${path(test.id)}/results/${accountId}`, "PUT", { expected_revision: test.revision, expected_result_revision: resultRevision, score });
  return externalTest(test.id);
}
export async function removeExternalResult(test: ExternalTest, result: ExternalResult): Promise<ExternalTest> {
  currentScope(test);
  await externalCommand(`${path(test.id)}/results/${result.account_id}`, "DELETE", { expected_revision: test.revision, expected_result_revision: result.revision });
  return externalTest(test.id);
}
export function externalError(error: unknown): Error {
  const e = error as Error & { code?: string; status?: number };
  const labels: Record<string, string> = { external_test_changed: "Тест изменился. Обновите данные и повторите действие", stale_revision: "Данные изменились. Обновите список", confirmation_expired: "Подтверждение устарело. Откройте его заново", invalid_confirmation: "Данные удаления изменились. Откройте подтверждение заново", idempotency_conflict: "Этот запрос уже отправлен с другими данными", external_test_not_found: "Внешний тест не найден в выбранном подразделении" };
  return Object.assign(new Error(labels[e.code ?? ""] ?? e.message ?? "Не удалось загрузить внешний тест"), { code: e.code, status: e.status });
}
