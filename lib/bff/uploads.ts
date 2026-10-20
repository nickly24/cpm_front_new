import { bffBlobRequest, domain, getIdentity } from "./client";

export interface UploadScope { organization_id: number; division_id: number; actor_account_id: number }
export interface UploadType {
  type: string; owner: string; permission: string; formats: string[]; mode: string; target_scope: string;
  max_bytes?: number; max_rows?: number; template?: boolean; template_reason?: "pending" | "not_applicable"; create: boolean; edit: boolean; commit: boolean; dependency?: string;
}
export interface UploadCatalog { scope: UploadScope; types: UploadType[] }
export interface UploadSession extends UploadScope {
  id: string; type: string; owner: string; owner_session_id?: string; target_id?: string; revision: number;
  owner_revision: number; state: string; file_id?: string; preview?: unknown; expires_at: string; created_at: string;
}
export interface UploadJob extends UploadScope {
  id: string; session_id: string; type: string; owner: string; status: string; attempt: number; processed: number;
  total: number; error?: string; report?: unknown; created_at: string; capabilities?: UploadJobCapabilities; authorization?: { bound: boolean; mode: "apply" | "receipt"; expires_at?: string };
}
export interface UploadJobCapabilities { retry_delivery: boolean; recover_receipt: boolean; revoke_authorization: boolean; retry_confirmation: boolean }
export interface UploadReceipt { command_id: string; action: string; resource_id: string; state: string; scope: UploadScope; type: string; owner: string }
export interface UploadPending { id: string; scope: UploadScope; type: string; action: "create" | "edit" | "commit" | "retry" | "recover" | "revoke"; resource?: string; owner?: string; expected_revision?: number; job_ref?: string }
export interface UploadJobWatch { id: string; session_id: string; scope: UploadScope; type: string; owner: string; confirmation_id?: string; expected_revision?: number }
export interface UploadReport { job_id: string; scope: UploadScope; type: string; owner: string; report: { rows?: { source_row?: number; row_id?: string; state?: string; warnings?: string[] }[]; owner_result?: unknown } }
export const uploadLabels: Record<string, string> = {
  "users.credentials": "Пользователи с готовыми учётными данными", "users.legacy": "Пользователи: школы и прокторы", "cards.xlsx": "Карточки из Excel", "cards.transform": "Карточки в черновик теста", "tests.json": "Тесты из Excel / JSON / OnlineTestPad", "tests.external-results": "Результаты внешних тестов", "exams.questions": "Вопросы экзамена", "exams.assignments": "Назначения на экзамен", "exams.outside": "Результаты экзамена вне LMS", "homework.pdf": "PDF домашних работ", "attendance.zap-images": "Изображения запросов на отгул",
};
export const uploadStates: Record<string, string> = {
  staging: "Подготовка", preview: "Предпросмотр", editing: "Сохранение изменений", edit_unknown: "Нужно проверить изменения", authorizing: "Подтверждение фонового доступа", authorization_unknown: "Исход разрешения требует проверки", outcome_unknown: "Исход применения неизвестен", access_required: "Нужен доступ к исходному кабинету", authorization_expired: "Срок фонового доступа истёк", revoked: "Фоновое разрешение отозвано", rejected: "Загрузка отклонена", queued: "В очереди", running: "В процессе", retry: "Ожидание повторной попытки", awaiting_authorization: "Применение ожидает разрешения фонового доступа", completed: "Завершено", cancelled: "Отменено", failed: "Ошибка", owner_confirmed: "Подтверждено", skipped: "Пропущено",
};
const errorLabels: Record<string, string> = {
  upload_and_subject_permission_required: "Нужны права на загрузку и выбранный раздел", scope_access_denied: "Подразделение недоступно", owner_access_denied: "Владелец данных отказал в доступе", owner_adapter_pending: "Этот формат ещё не подключён", owner_outcome_unknown: "Ответ владельца не получен. Проверьте исход команды", command_outcome_unknown: "Исход команды пока не подтверждён", preview_modified: "Предпросмотр изменился. Обновите его перед подтверждением", preview_not_confirmable: "Эту загрузку нельзя подтвердить", owner_preview_modified: "Предпросмотр владельца изменился", source_not_retained: "Исходный файл не хранится", source_not_retained_or_expired: "Исходный файл удалён или не хранится", reauthorization_required: "Сервис отклонил доступ к импорту. Сессия кабинета сохранена", owner_service_authentication_failed: "Ошибка служебного доступа к сервису тестов. Сессия кабинета сохранена", question_table_headers_required: "Не найдены колонки: Название теста, Номер, Категория вопроса, Вопрос, Варианты ответов, Правильный ответ", question_table_empty: "В таблице нет вопросов", question_table_question_limit: "В одном тесте допускается до 200 вопросов", report_not_ready: "Отчёт ещё не готов", owner_template_pending: "Для этого формата шаблон пока не поддерживается", owner_template_unavailable: "Шаблон недоступен у владельца. Проверьте выбранный экзамен и права", background_authorization_pending: "Фоновое применение ожидает разрешения доступа. Данные ещё не импортированы; повторная попытка не обходит это ограничение", source_expired: "Исходный файл истёк. Повторное применение недоступно", owner_preview_changed: "Проверка источника изменилась. Обновите предпросмотр", pinned_test_target_mismatch: "Внешний тест закреплён за предпросмотром и не может быть заменён", session_expired: "Предпросмотр истёк. Подготовьте новую загрузку",
};
export function uploadError(error: unknown): Error {
  const e = error instanceof Error ? error : new Error("Не удалось выполнить действие");
  const code = (error as { code?: string })?.code;
  if (code && errorLabels[code]) e.message = errorLabels[code];
  return e;
}
export function uploadScope(): UploadScope {
  const user = getIdentity()?.user;
  if (![user?.account_id, user?.organization_id, user?.division_id].every(value=>typeof value==="number"&&Number.isSafeInteger(value)&&value>0)) throw new Error("Выберите подразделение в меню кабинетов");
  return { actor_account_id: user!.account_id!, organization_id: user!.organization_id!, division_id: user!.division_id! };
}
const sameScope = (a: UploadScope, b: UploadScope) => a.actor_account_id === b.actor_account_id && a.organization_id === b.organization_id && a.division_id === b.division_id;
function scoped<T extends UploadScope>(value: T, snapshot = uploadScope()): T {
  if (!sameScope(snapshot, uploadScope()) || !sameScope(snapshot, value)) throw new Error("Данные относятся к другому кабинету. Обновите страницу.");
  return value;
}
function id(value: string) { if (!/^[a-f0-9]{32}$/.test(value)) throw new Error("Недопустимый ID загрузки"); return value; }
const storageKey = (scope = uploadScope()) => `cpm-uploads-command:${scope.actor_account_id}:${scope.organization_id}:${scope.division_id}`;
const backgroundPrefix = "cpm-uploads-background-command:";
const watchPrefix = "cpm-uploads-background-job:";
const watchScopePrefix = (scope = uploadScope()) => `${watchPrefix}${scope.actor_account_id}:${scope.organization_id}:${scope.division_id}:`;
const backgroundKey = (scope = uploadScope()) => `${backgroundPrefix}${scope.actor_account_id}:${scope.organization_id}:${scope.division_id}`;
const commandId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const typeOwner = (type: string) => type.startsWith("users.") ? "core" : type.split(".")[0];
function pendingRecord(raw: string, scope: UploadScope): UploadPending {
  const keys = ["id", "scope", "type", "action", "resource", "owner", "expected_revision", "job_ref"];
  let value: Record<string, unknown>;
  try { if (raw.length > 2048) throw new Error(); value = object(JSON.parse(raw)); }
  catch { throw new Error("Сохранённую команду нельзя прочитать. Новые действия заблокированы; журнал не удалён."); }
  const s = object(value.scope), action = value.action;
  if (Object.keys(value).some(key => !keys.includes(key)) || typeof value.id !== "string" || !commandId.test(value.id) || typeof value.type !== "string" || !Object.hasOwn(uploadLabels, value.type) || !["create", "edit", "commit", "retry", "recover", "revoke"].includes(String(action)) || Object.keys(s).length !== 3 || !sameScope(s as unknown as UploadScope, scope) || value.owner !== undefined && value.owner !== typeOwner(value.type) || value.expected_revision !== undefined && (!Number.isSafeInteger(value.expected_revision) || Number(value.expected_revision) < 1) || action !== "create" && (typeof value.resource !== "string" || !/^[a-f0-9]{32}$/.test(value.resource)) || action === "create" && value.resource !== undefined || value.job_ref !== undefined && (action !== "commit" || typeof value.job_ref !== "string" || !/^[a-f0-9]{32}$/.test(value.job_ref))) throw new Error("Сохранённая команда не соответствует исходному кабинету. Новые действия заблокированы; журнал не удалён.");
  // Retained sessionStorage commands, including old credentials UUIDs, are never migrated.
  return value as unknown as UploadPending;
}
function watchRecord(raw: string, scope: UploadScope): UploadJobWatch {
  let row: Record<string, unknown>;
  try { if (raw.length > 1024) throw new Error(); row = object(JSON.parse(raw)); } catch { throw new Error("Журнал исходов заданий повреждён. Новое действие не отправлено; записи сохранены."); }
  if (Object.keys(row).some(key => !["id", "session_id", "scope", "type", "owner", "confirmation_id", "expected_revision"].includes(key)) || typeof row.id !== "string" || !/^[a-f0-9]{32}$/.test(row.id) || typeof row.session_id !== "string" || !/^[a-f0-9]{32}$/.test(row.session_id) || typeof row.type !== "string" || !Object.hasOwn(uploadLabels, row.type) || row.owner !== typeOwner(row.type) || Object.keys(object(row.scope)).length !== 3 || !sameScope(object(row.scope) as unknown as UploadScope, scope) || row.confirmation_id !== undefined && (typeof row.confirmation_id !== "string" || !commandId.test(row.confirmation_id)) || row.expected_revision !== undefined && (!Number.isSafeInteger(row.expected_revision) || Number(row.expected_revision) < 1)) throw new Error("Журнал исходов не соответствует исходному кабинету. Новое действие не отправлено; записи сохранены.");
  return row as unknown as UploadJobWatch;
}
export function watchedUploadJobs(): UploadJobWatch[] {
  const scope = uploadScope(), prefix = watchScopePrefix(scope), values: UploadJobWatch[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        const row = watchRecord(localStorage.getItem(key)!, scope);
        if (key !== prefix + row.id) throw new Error("Запись журнала не соответствует исходному заданию");
        values.push(row);
      }
    }
  } catch (error) { throw uploadError(error); }
  return values;
}
function boundedStorage(additionalKey: string, additionalRaw: string) {
  let count = 0, bytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(backgroundPrefix) || key?.startsWith(watchPrefix)) { count++; bytes += key.length + (localStorage.getItem(key)?.length ?? 0); }
  }
  if (count >= 64 || bytes + additionalKey.length + additionalRaw.length > 131072) throw new Error("Журнал заполнен. Неизвестные команды не удалены.");
}
function watchJob(job: UploadJob, pending?: UploadPending): void {
  scoped(job);
  const key = watchScopePrefix() + job.id, raw = localStorage.getItem(key);
  const existing = raw === null ? undefined : watchRecord(raw, uploadScope());
  if (existing && (existing.id !== job.id || existing.session_id !== job.session_id || existing.type !== job.type || existing.owner !== job.owner)) throw new Error("Задание не соответствует сохранённому исходу. Журнал сохранён.");
  if (job.status === "completed") { if (raw !== null && localStorage.getItem(key) === raw) localStorage.removeItem(key); return; }
  const value: UploadJobWatch = existing ?? { id: job.id, session_id: job.session_id, scope: uploadScope(), type: job.type, owner: job.owner, ...(pending?.action === "commit" ? { confirmation_id: pending.id, ...(pending.expected_revision !== undefined ? { expected_revision: pending.expected_revision } : {}) } : {}) };
  const next = JSON.stringify(value); watchRecord(next, uploadScope());
  if (raw === null) boundedStorage(key, next);
  if (localStorage.getItem(key) !== raw) throw new Error("Журнал исходов изменился. Исходная команда сохранена.");
  localStorage.setItem(key, next);
  if (localStorage.getItem(key) !== next) throw new Error("Не удалось сохранить исход задания. Исходная команда сохранена.");
}
class OtherCabinetCommand extends Error {}
interface JournalEntry { pending: UploadPending; key: string; raw: string; storage: Storage }
function journalEntry(): JournalEntry | null {
  const scope = uploadScope();
  try {
    watchedUploadJobs();
    const prefix = `${backgroundPrefix}${scope.actor_account_id}:${scope.organization_id}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix) && key !== backgroundKey(scope)) throw new OtherCabinetCommand("Команда сохранена в другом исходном кабинете. Вернитесь туда и проверьте её исход; журнал не удалён.");
    }
    const shared = localStorage.getItem(backgroundKey(scope)), legacy = sessionStorage.getItem(storageKey(scope));
    if (shared !== null && legacy !== null) throw new Error("Несколько незавершённых команд. Проверьте их исход в исходном кабинете; журнал сохранён.");
    if (shared !== null) return { pending: pendingRecord(shared, scope), key: backgroundKey(scope), raw: shared, storage: localStorage };
    return legacy === null ? null : { pending: pendingRecord(legacy, scope), key: storageKey(scope), raw: legacy, storage: sessionStorage };
  } catch (error) {
    if (error instanceof Error && /журнал|команд/i.test(error.message)) throw error;
    throw new Error("Журнал команд недоступен. Новое действие не отправлено; восстановите хранилище браузера.");
  }
}
export function pendingUploadCommand(): UploadPending | null { return journalEntry()?.pending ?? null; }
export function uploadCommandJournalState(): { pending: UploadPending | null; blocked: boolean; otherCabinet: boolean; error: string } {
  try { return { pending: pendingUploadCommand(), blocked: false, otherCabinet: false, error: "" }; }
  catch (error) { return { pending: null, blocked: true, otherCabinet: error instanceof OtherCabinetCommand, error: uploadError(error).message }; }
}
function clearCommand(entry: JournalEntry) {
  if (!sameScope(entry.pending.scope, uploadScope())) throw new Error("Вернитесь в исходный кабинет, чтобы проверить команду. Журнал сохранён.");
  try { if (entry.storage.getItem(entry.key) !== entry.raw) throw new Error(); entry.storage.removeItem(entry.key); }
  catch { throw new Error("Журнал изменился или недоступен. Команда не удалена; проверьте её исход перед новым действием."); }
}
function saveEntry(entry: JournalEntry, pending: UploadPending): JournalEntry {
  const raw = JSON.stringify(pending); pendingRecord(raw, pending.scope);
  try { if (entry.storage.getItem(entry.key) !== entry.raw) throw new Error(); entry.storage.setItem(entry.key, raw); }
  catch { throw new Error("Журнал изменился или недоступен. Исходная команда сохранена; новое действие не отправлено."); }
  return { ...entry, pending, raw };
}
function reserveCommand(pending: UploadPending): JournalEntry {
  const raw = JSON.stringify(pending), background = ["commit", "retry", "recover", "revoke"].includes(pending.action);
  const key = background ? backgroundKey(pending.scope) : storageKey(pending.scope), storage = background ? localStorage : sessionStorage;
  pendingRecord(raw, pending.scope);
  try {
    if (background) boundedStorage(key, raw);
    if (storage.getItem(key) !== null) throw new Error();
    storage.setItem(key, raw);
    if (storage.getItem(key) !== raw) throw new Error();
  } catch { throw new Error("Не удалось сохранить журнал команды. Действие не отправлено; восстановите хранилище браузера. Неизвестные команды не удалены."); }
  return { pending, key, raw, storage };
}
const dispatching = new Set<string>();
async function exclusiveCommand<T>(fn: () => Promise<T>): Promise<T> {
  const scope = uploadScope(), key = `${backgroundPrefix}${scope.actor_account_id}:${scope.organization_id}`;
  if (dispatching.has(key)) throw new Error("Предыдущее действие ещё выполняется");
  dispatching.add(key);
  try {
    journalEntry();
    if (typeof navigator === "undefined" || !navigator.locks) throw new Error("Браузер не поддерживает безопасный журнал команд. Действие не отправлено.");
    return await navigator.locks.request(key, { ifAvailable: true }, lock => {
      if (!lock) throw new Error("Команда выполняется в другой вкладке. Дождитесь проверки её исхода.");
      if (!sameScope(scope, uploadScope())) throw new Error("Кабинет изменился. Действие не отправлено.");
      journalEntry();
      return fn();
    });
  } finally { dispatching.delete(key); }
}
export async function uploadCatalog(signal?: AbortSignal) { const snapshot = uploadScope(); const c = await domain<UploadCatalog>("/uploads/catalog", { signal }); scoped(c.scope, snapshot); return c; }
export async function uploadSessions(signal?: AbortSignal, limit = 50) { const snapshot = uploadScope(); const items = await domain<UploadSession[]>(`/uploads/sessions?limit=${limit}`, { signal }); return items.map(item => scoped(item, snapshot)); }
export async function uploadJobs(signal?: AbortSignal, limit = 50) { const snapshot = uploadScope(); const items = await domain<UploadJob[]>(`/uploads/jobs?limit=${limit}`, { signal }); return items.map(item => scoped(item, snapshot)); }
export async function uploadSession(sessionId: string, signal?: AbortSignal) { const snapshot = uploadScope(), value = scoped(await domain<UploadSession>(`/uploads/sessions/${id(sessionId)}`, { signal }), snapshot); if(value.id!==sessionId || value.owner!==typeOwner(value.type)) throw new Error("Предпросмотр не соответствует выбранной загрузке"); return value; }
export async function uploadJob(jobId: string, signal?: AbortSignal) { const snapshot = uploadScope(), value = scoped(await domain<UploadJob>(`/uploads/jobs/${id(jobId)}`, { signal }), snapshot); if(value.id!==jobId || !Object.hasOwn(uploadLabels,value.type) || value.owner!==typeOwner(value.type) || !/^[a-f0-9]{32}$/.test(value.session_id)) throw new Error("Задание не соответствует выбранной загрузке"); return value; }
export async function uploadReport(jobId: string) { const snapshot = uploadScope(); const report = await domain<UploadReport>(`/uploads/jobs/${id(jobId)}/report`); scoped(report.scope, snapshot); return report; }
const uncertain = (e: unknown) => { const x = e as { status?: number; code?: string }; return x.status === 0 || x.status === undefined || x.status >= 500 || x.code === "command_outcome_unknown"; };
function matchJob(job: UploadJob, pending: UploadPending, jobId?: string): UploadJob {
  scoped(job, pending.scope);
  if (job.type !== pending.type || job.owner !== typeOwner(pending.type) || !/^[a-f0-9]{32}$/.test(job.id) || jobId !== undefined && job.id !== jobId || (pending.action === "commit" ? job.session_id !== pending.resource || pending.job_ref !== undefined && job.id !== pending.job_ref : job.id !== pending.resource)) throw new Error("Задание не соответствует исходной команде. Журнал сохранён.");
  return job;
}
function confirmationBound(job: UploadJob): boolean {
  return job.authorization?.bound === true && ["apply", "receipt"].includes(job.authorization.mode) && validCapabilities(job) && job.capabilities!.retry_confirmation === false && (["queued", "running", "completed"].includes(job.status) || ["outcome_unknown", "access_required", "authorization_expired", "revoked"].includes(job.status) && job.capabilities!.recover_receipt === true);
}
async function confirmationResult(entry: JournalEntry, result: UploadJob): Promise<UploadJob> {
  matchJob(result, entry.pending);
  const bound = saveEntry(entry, { ...entry.pending, job_ref: result.id });
  // A completed HTTP confirmation receipt only reserves a job. A fresh job read
  // must prove the authorization phase ended before this key can be released.
  try {
    const fresh = matchJob(await uploadJob(result.id), bound.pending, result.id);
    if (confirmationBound(fresh)) { watchJob(fresh, bound.pending); clearCommand(bound); }
    return fresh;
  } catch { return result; } // No proof: retain original key, scope and revision.
}
async function command<T extends UploadScope>(action: UploadPending["action"], type: string, path: string, method: "POST" | "PUT", body: BodyInit, resource?: string): Promise<T> {
  return exclusiveCommand(async () => {
    if (pendingUploadCommand()) throw new Error("Сначала проверьте исход предыдущей команды");
    const scope = uploadScope(), pending: UploadPending = { id: crypto.randomUUID(), scope, action, type, owner: typeOwner(type), ...(resource ? { resource } : {}), ...(["edit", "commit"].includes(action) ? { expected_revision: JSON.parse(body as string).expected_revision } : {}) };
    const entry = reserveCommand(pending);
    try {
      const result = scoped(await domain<T>(path, { method, body, headers: { "Idempotency-Key": pending.id } }), scope);
      const value = object(result);
      if (value.type !== type || value.owner !== pending.owner || typeof value.id !== "string" || !/^[a-f0-9]{32}$/.test(value.id) || action === "edit" && value.id !== resource || action === "commit" && value.session_id !== resource || ["retry", "recover", "revoke"].includes(action) && value.id !== resource) throw new Error("Ответ не подтверждает исходную команду. Журнал сохранён; проверьте исход.");
      if (action === "commit") return await confirmationResult(entry, result as unknown as UploadJob) as unknown as T;
      if (["retry", "recover", "revoke"].includes(action)) {
        try { await proveAction(entry); } catch { /* Unknown scheduling/revoke: keep the action identity. */ }
      } else clearCommand(entry);
      return result;
    } catch (error) {
      const e = error as { status?: number; code?: string };
      const knownRejection = ["create", "edit"].includes(action) || ["preview_modified", "preview_not_confirmable", "confirmation_required"].includes(e.code ?? "");
      if (!uncertain(error) && knownRejection) clearCommand(entry);
      throw uploadError(error);
    }
  });
}
export async function createUpload(type: UploadType, file: File, fields: Record<string, string> = {}): Promise<UploadSession> {
  if (!type.create || !["owner_session", "validated_input"].includes(type.mode) || type.type === "cards.transform") throw new Error("Выбранный формат недоступен для загрузки файла");
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  if (!extension || !type.formats.includes(extension)) throw new Error(`Выберите файл ${type.formats.join(" / ")}`);
  if (!file.size || file.size > (type.max_bytes ?? 8 * 1024 * 1024)) throw new Error("Файл пуст или превышает допустимый размер");
  const allowed = ["target_id", "direction_id", "theme_id", "create_new_theme", "new_theme_name", ...(type.type === "tests.json" ? ["title", "direction", "startDate", "endDate", "timeLimitMinutes", "published", "visible"] : [])];
  if (Object.keys(fields).some(key => !allowed.includes(key))) throw new Error("Недопустимые параметры загрузки");
  const body = new FormData(); body.append("type", type.type); body.append("file", file);
  for (const [key, value] of Object.entries(fields)) if (value !== "") body.append(key, value);
  return command("create", type.type, "/uploads/sessions", "POST", body);
}
export function editUpload(session: UploadSession, ownerPayload: Record<string, unknown>) { scoped(session); return command<UploadSession>("edit", session.type, `/uploads/sessions/${id(session.id)}`, "PUT", JSON.stringify({ expected_revision: session.revision, owner_payload: ownerPayload }), session.id); }
export function commitUpload(session: UploadSession,confirmed:boolean) { scoped(session); if(confirmed!==true||session.type==="cards.transform")throw new Error("Явно подтвердите фоновый импорт текущего предпросмотра");return command<UploadJob>("commit", session.type, `/uploads/sessions/${id(session.id)}/commit`, "POST", JSON.stringify({ expected_revision: session.revision, confirmed:true }), session.id); }
export function retryUpload(job: UploadJob) { scoped(job); if(!uploadCanRetry(job))throw new Error("Повторное применение этого задания недоступно. Проверьте исход прежней команды.");return command<UploadJob>("retry", job.type, `/uploads/jobs/${id(job.id)}/retry`, "POST", "{}", job.id); }
export function recoverUploadJob(job:UploadJob,confirmed:boolean) { scoped(job);if(confirmed!==true||!uploadCanRecover(job))throw new Error("Проверка исхода задания недоступна. Требуется явное подтверждение и доступ в исходном кабинете");return command<UploadJob>("recover",job.type,`/uploads/jobs/${id(job.id)}/recover`,"POST",JSON.stringify({confirmed:true}),job.id); }
export function revokeUploadJob(job:UploadJob,confirmed:boolean) { scoped(job);if(confirmed!==true||!uploadCanRevoke(job))throw new Error("Отзыв разрешения недоступен. Требуется явное подтверждение и доступ в исходном кабинете");return command<UploadJob>("revoke",job.type,`/uploads/jobs/${id(job.id)}/revoke`,"POST",JSON.stringify({confirmed:true}),job.id); }
export async function reconcileUpload(session: UploadSession) { const snapshot = uploadScope(); return scoped(await domain<UploadSession>(`/uploads/sessions/${id(session.id)}/reconcile`, { method: "POST" }), snapshot); }
function matchReceipt(receipt: UploadReceipt, pending: UploadPending): UploadReceipt {
  scoped(receipt.scope, pending.scope);
  const action = pending.action === "create" ? "session.create" : `${["edit", "commit"].includes(pending.action) ? "session" : "job"}.${pending.action}:${pending.resource}`;
  if (receipt.type !== pending.type || receipt.command_id !== pending.id || receipt.owner !== typeOwner(pending.type) || receipt.action !== action || receipt.state !== "completed" || !/^[a-f0-9]{32}$/.test(receipt.resource_id)) throw new Error("Квитанция не соответствует завершённой исходной команде. Журнал сохранён.");
  return receipt;
}
async function proveAction(entry: JournalEntry): Promise<UploadJob> {
  const receipt = matchReceipt(await domain<UploadReceipt>(`/uploads/receipts/${encodeURIComponent(entry.pending.id)}`), entry.pending);
  const job = matchJob(await uploadJob(receipt.resource_id), entry.pending, receipt.resource_id);
  watchJob(job); clearCommand(entry);
  return job;
}
export async function pollUploadJob(jobId: string, signal?: AbortSignal): Promise<UploadJob> {
  const job = await uploadJob(jobId, signal), entry = journalEntry();
  const watch = watchedUploadJobs().find(value => value.id === job.id);
  if (watch) watchJob(job);
  if (entry?.pending.action === "commit" && entry.pending.job_ref === job.id) {
    matchJob(job, entry.pending, job.id);
    if (confirmationBound(job)) { watchJob(job, entry.pending); clearCommand(entry); }
  }
  return job;
}
export async function retryUploadConfirmation(job: UploadJob, confirmed: boolean): Promise<UploadJob> {
  scoped(job);
  return exclusiveCommand(async () => {
    const entry = journalEntry();
    if (confirmed !== true || !entry || entry.pending.action !== "commit" || entry.pending.owner === undefined || entry.pending.expected_revision === undefined || entry.pending.job_ref !== job.id || !uploadCanRetryConfirmation(job)) throw new Error("Повтор исходного подтверждения недоступен. Проверьте исход сохранённой команды.");
    matchJob(job, entry.pending, job.id);
    const body = JSON.stringify({ expected_revision: entry.pending.expected_revision, confirmed: true });
    const result = await domain<UploadJob>(`/uploads/sessions/${id(entry.pending.resource!)}/commit`, { method: "POST", body, headers: { "Idempotency-Key": entry.pending.id } });
    // Any denial or uncertain transport keeps the original identity and bytes.
    return confirmationResult(entry, result);
  });
}
export async function recoverUploadCommand(): Promise<{ session?: UploadSession; job?: UploadJob }> {
  return exclusiveCommand(async () => {
    let entry = journalEntry(); if (!entry) throw new Error("Нет команды для проверки");
    const pending = entry.pending;
    const receipt = matchReceipt(await domain<UploadReceipt>(`/uploads/receipts/${encodeURIComponent(pending.id)}`), pending);
    if (["commit", "retry", "recover", "revoke"].includes(pending.action)) {
      const job = matchJob(await uploadJob(receipt.resource_id), pending, receipt.resource_id);
      if (pending.action === "commit") {
        entry = saveEntry(entry, { ...pending, job_ref: job.id });
        if (confirmationBound(job)) { watchJob(job, pending); clearCommand(entry); }
      } else { watchJob(job); clearCommand(entry); } // Action scheduling/revoke, not native completion.
      return { job };
    }
    const session = await uploadSession(receipt.resource_id);
    if (session.id !== receipt.resource_id || session.type !== pending.type || session.owner !== receipt.owner || pending.action === "edit" && (session.id !== pending.resource || pending.expected_revision !== undefined && session.revision <= pending.expected_revision)) throw new Error("Предпросмотр не соответствует исходной команде. Журнал сохранён.");
    if (["staging", "outcome_unknown", "editing", "edit_unknown"].includes(session.state)) throw new Error("Исход команды ещё не подтверждён; проверьте позднее в исходном кабинете");
    clearCommand(entry); return { session };
  });
}
export async function downloadUploadSource(session: UploadSession): Promise<Blob> {
  scoped(session); if (!session.file_id) throw new Error("У загрузки нет файла");
  return bffBlobRequest(`/uploads/files/${id(session.file_id)}/download`);
}
export function uploadReportCSV(report: UploadReport): string {
  const cell = (v: unknown) => `"${String(v ?? "").replace(/^\s*[=+@-]/, value => `'${value}`).replaceAll('"', '""')}"`;
  return [["Строка", "Состояние", "Предупреждения"], ...(report.report.rows ?? []).map(row => [row.source_row, uploadStates[row.state ?? ""] ?? row.state, row.warnings?.join("; ")])].map(row => row.map(cell).join(",")).join("\r\n");
}

export interface UploadTarget { id: string; name: string }
/** Uses the current BFF scope, independently of readiness for the external Tests screens. */
export async function uploadExternalTargets(signal?: AbortSignal): Promise<UploadTarget[]> {
  const snapshot = uploadScope(), result: UploadTarget[] = [];
  for (let offset = 0; offset <= 100000; offset += 100) {
    signal?.throwIfAborted();
    const page = await domain<{items: {id:string; name:string; organization_id:number; division_id:number; is_deleted:boolean}[]; total:number}>(`/tests/external-tests?limit=100&offset=${offset}`, { signal });
    scoped(snapshot, snapshot);
    if (!Array.isArray(page.items) || !Number.isSafeInteger(page.total) || page.total < 0) throw new Error("Источник вернул неполный каталог внешних тестов");
    for (const item of page.items) {
      scoped({ ...snapshot, organization_id:item.organization_id, division_id:item.division_id }, snapshot);
      if (!/^[a-f0-9]{24}$/.test(item.id) || typeof item.name !== "string" || item.is_deleted !== false) throw new Error("Источник вернул неверный внешний тест");
      result.push({ id:item.id, name:item.name });
    }
    if (new Set(result.map(row => row.id)).size !== result.length || result.length > page.total) throw new Error("Каталог изменился. Обновите список внешних тестов");
    if (result.length === page.total) return result;
    if (!page.items.length) throw new Error("Источник вернул неполный каталог внешних тестов");
  }
  throw new Error("Каталог слишком большой. Уточните список внешних тестов");
}
export interface UploadTemplateOptions { targetId?:string; directionId?:number; format?:"cpm_json"|"online_test_pad"|"question_table"; signal?:AbortSignal }
export async function downloadUploadTemplate(type: UploadType, options:UploadTemplateOptions = {}): Promise<{blob:Blob; filename:string}> {
  const snapshot = uploadScope();
  if (type.template !== true) throw new Error(type.template_reason === "not_applicable" ? "Этот формат не использует файловый шаблон" : "Шаблон этого формата пока недоступен");
  if (!Object.hasOwn(uploadLabels, type.type) || Object.keys(options).some(key=>!["targetId","directionId","format","signal"].includes(key))) throw new Error("Недопустимые параметры шаблона");
  const exams = type.type.startsWith("exams."), external=type.type === "tests.external-results", json=type.type === "tests.json";
  const query=new URLSearchParams(), targetId=options.targetId??"";
  if (exams && (!/^[1-9][0-9]*$/.test(targetId) || !Number.isSafeInteger(Number(targetId)))) throw new Error("Выберите экзамен для шаблона");
  if (external && !/^[a-f0-9]{24}$/.test(targetId)) throw new Error("Выберите внешний тест для шаблона");
  if (!exams && !external && targetId) throw new Error("Для этого шаблона цель не задаётся");
  if (exams || external) query.set("target_id",targetId);
  const format=options.format??"cpm_json";
  if (json) {
    if (!Number.isSafeInteger(options.directionId) || (options.directionId??0)<1) throw new Error("Выберите направление для шаблона");
    if (!["cpm_json","online_test_pad","question_table"].includes(format)) throw new Error("Недопустимый формат шаблона теста");
    query.set("direction_id",String(options.directionId));query.set("format",format);
  } else if (options.directionId !== undefined || options.format !== undefined) throw new Error("Направление и формат задаются только для шаблона JSON / OnlineTestPad");
  const path = `/uploads/templates/${encodeURIComponent(type.type)}${query.size?`?${query}`:""}`;
  let blob: Blob;
  try { blob = await bffBlobRequest(path, { signal:options.signal }); } catch (error) { throw uploadError(error); }
  scoped(snapshot, snapshot);
  const mime = blob.type.split(";")[0].toLowerCase();
  const expected = json ? format === "question_table" ? {mime:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",extension:"xlsx"} : format === "online_test_pad" ? {mime:"text/javascript",extension:"js"} : {mime:"application/json",extension:"json"} : type.type === "users.credentials" ? {mime:"text/csv",extension:"csv"} : {mime:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",extension:"xlsx"};
  if (mime !== expected.mime) throw new Error("Источник вернул неподдерживаемый формат шаблона");
  // Check only JSON transport syntax. Subject shape and JavaScript/OTP parsing belong to Tests.
  if (expected.extension === "json") {
    try { JSON.parse(await blob.text()); } catch { throw new Error("Источник вернул некорректный JSON шаблона"); }
    scoped(snapshot,snapshot);
  }
  return { blob, filename:`${type.type.replaceAll(".", "-")}-template.${expected.extension}` };
}

export async function uploadDirections(signal?:AbortSignal):Promise<{id:number;name:string}[]> {
  const snapshot=uploadScope();
  signal?.throwIfAborted();
  // Core returns the complete organization catalog; it has no paging query.
  const rows=await domain<{id:number;name:string}[]>("/core/directions",{signal});
  scoped(snapshot,snapshot);
  if(!Array.isArray(rows) || rows.some(row=>!Number.isSafeInteger(row.id)||row.id<1||typeof row.name!=="string")) throw new Error("Источник вернул неверные направления");
  if(new Set(rows.map(row=>row.id)).size!==rows.length) throw new Error("Направления изменились. Обновите список");
  return rows;
}

/** Public owner capabilities are the only authority for job actions. */
function validCapabilities(job: UploadJob): boolean {
  return !!job.capabilities && ["retry_delivery", "recover_receipt", "revoke_authorization", "retry_confirmation"].every(key => typeof object(job.capabilities)[key] === "boolean");
}
function capability(job: UploadJob, name: keyof UploadJobCapabilities, type?: UploadType): boolean {
  return validCapabilities(job) && job.type !== "cards.transform" && (!type || type.type === job.type && type.commit === true) && job.capabilities![name] === true;
}
export function uploadCanRetry(job: UploadJob, type?: UploadType): boolean { return capability(job, "retry_delivery", type) && !["authorization_unknown", "outcome_unknown", "access_required", "authorization_expired", "revoked", "completed", "running"].includes(job.status); }
export function uploadCanRecover(job: UploadJob, type?: UploadType): boolean { return capability(job, "recover_receipt", type); }
export function uploadCanRevoke(job: UploadJob, type?: UploadType): boolean { return capability(job, "revoke_authorization", type); }
export function uploadCanRetryConfirmation(job: UploadJob): boolean { return capability(job, "retry_confirmation") && ["authorizing", "authorization_unknown"].includes(job.status); }
export function uploadJobNeedsPolling(job: UploadJob): boolean { return ["authorizing", "authorization_unknown", "queued", "running", "retry", "outcome_unknown", "access_required"].includes(job.status); }
