import type { User } from "@/lib/auth/types";
import { domain, getIdentity } from "./client";

export interface HomeworkSettings {
  max_source_bytes: number;
  max_output_bytes: number;
  max_pages: number;
  dpi: number;
  jpeg_quality: number;
  presign_ttl_seconds: number;
  upload_stale_seconds: number;
}
export interface HomeworkAuditEntry {
  id: number;
  actor_id: number | null;
  action: string;
  entity_id: string;
  created_at: string;
}
export interface HomeworkAuditPage {
  items: HomeworkAuditEntry[];
  hasMore: boolean;
  nextCursor: number;
}
const keys: (keyof HomeworkSettings)[] = ["max_source_bytes", "max_output_bytes", "max_pages", "dpi", "jpeg_quality", "presign_ttl_seconds", "upload_stale_seconds"];
const positiveID = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const error = (message: string, code: string, status = 0) => Object.assign(new Error(message), { code, status });

export function homeworkSettingsAccess(user: User | null) {
  const full = user?.role === "admin" && user.organization_admin === true;
  const delegated = user?.role === "staff_admin" && (user.permissions?.assignments?.view === true || user.permissions?.monitoring?.view === true);
  return { readSettings: full || delegated || user?.role === "student" || user?.role === "proctor", writeSettings: full, readAudit: full };
}

export function validateHomeworkSettings(value: unknown): HomeworkSettings {
  if (!record(value) || keys.some(key => !Number.isSafeInteger(value[key]))) throw error("Сервис вернул некорректные настройки", "invalid_settings_response");
  const s = value as unknown as HomeworkSettings;
  if (s.max_source_bytes < 1 || s.max_source_bytes > 100 * 1024 * 1024 || s.max_output_bytes < 1 || s.max_output_bytes > 100 * 1024 * 1024 || s.max_pages < 1 || s.max_pages > 200 || s.dpi < 72 || s.dpi > 300 || s.jpeg_quality < 35 || s.jpeg_quality > 95 || s.presign_ttl_seconds < 60 || s.presign_ttl_seconds > 900 || s.upload_stale_seconds < 2 * s.presign_ttl_seconds || s.upload_stale_seconds > 86400) {
    throw error("Проверьте допустимые значения. Время ожидания загрузки должно быть не меньше двух сроков ссылки.", "invalid_settings", 400);
  }
  return Object.fromEntries(keys.map(key => [key, s[key]])) as unknown as HomeworkSettings;
}

export function sameHomeworkSettings(a: HomeworkSettings, b: HomeworkSettings) { return keys.every(key => a[key] === b[key]); }

function scope() {
  const identity = getIdentity();
  if (!identity || !positiveID(identity.user.account_id) || !positiveID(identity.user.organization_id) || !positiveID(identity.user.division_id) || !identity.context_revision) throw error("Выберите подразделение и обновите страницу", "division_required", 409);
  return { user: identity.user, key: `${identity.user.account_id}:${identity.user.organization_id}:${identity.user.division_id}`, revision: identity.context_revision };
}
function checkScope(snapshot: ReturnType<typeof scope>) {
  const current = scope();
  if (current.key !== snapshot.key || current.revision !== snapshot.revision) throw error("Кабинет изменился. Обновите страницу.", "context_changed", 409);
}
const journalKey = (key: string) => `cpm-homework-settings-pending:${key}`;
export function pendingHomeworkSettings(): HomeworkSettings | null {
  const snapshot = scope();
  try {
    const raw = sessionStorage.getItem(journalKey(snapshot.key));
    return raw ? validateHomeworkSettings(JSON.parse(raw)) : null;
  } catch { return null; }
}
function clearPending(snapshot: ReturnType<typeof scope>) { sessionStorage.removeItem(journalKey(snapshot.key)); }

export async function getHomeworkSettings(signal?: AbortSignal): Promise<HomeworkSettings> {
  const snapshot = scope();
  if (!homeworkSettingsAccess(snapshot.user).readSettings) throw error("Недостаточно прав для просмотра настроек", "forbidden", 403);
  const value = await domain<unknown>("/homework/settings", { signal });
  checkScope(snapshot);
  return validateHomeworkSettings(value);
}

/** A settings write has neither a source revision nor an idempotency key. Never retry it automatically. */
export async function saveHomeworkSettings(value: HomeworkSettings): Promise<HomeworkSettings> {
  const snapshot = scope();
  if (!homeworkSettingsAccess(snapshot.user).writeSettings) throw error("Менять настройки может только администратор организации", "forbidden", 403);
  const desired = validateHomeworkSettings(value);
  if (pendingHomeworkSettings()) throw error("Сначала проверьте результат предыдущего сохранения", "settings_pending", 409);
  try { sessionStorage.setItem(journalKey(snapshot.key), JSON.stringify(desired)); }
  catch { throw error("Не удалось сохранить состояние операции в браузере. Сохранение не отправлено.", "journal_unavailable", 409); }
  let received = false;
  try {
    const response = await domain<unknown>("/homework/settings", { method: "PUT", body: JSON.stringify(desired) });
    received = true;
    checkScope(snapshot);
    const saved = validateHomeworkSettings(response);
    if (!sameHomeworkSettings(desired, saved)) throw error("Ответ сервиса отличается от отправленных настроек", "invalid_settings_response");
    clearPending(snapshot);
    return saved;
  } catch (failure) {
    const status = record(failure) && typeof failure.status === "number" ? failure.status : 0;
    if (!received && status >= 400 && status < 500 && !(record(failure) && failure.code === "context_changed")) { clearPending(snapshot); throw failure; }
    throw error("Ответ на сохранение не получен. Проверьте настройки на сервере перед новым сохранением.", "settings_outcome_unknown");
  }
}

export async function reconcileHomeworkSettings(signal?: AbortSignal) {
  const snapshot = scope();
  const desired = pendingHomeworkSettings();
  const current = await getHomeworkSettings(signal);
  checkScope(snapshot);
  clearPending(snapshot);
  return { current, applied: desired ? sameHomeworkSettings(desired, current) : null };
}

export async function getHomeworkAudit(after = 0, pageSize = 50, signal?: AbortSignal): Promise<HomeworkAuditPage> {
  const snapshot = scope();
  if (!homeworkSettingsAccess(snapshot.user).readAudit) throw error("Аудит доступен только администратору организации", "forbidden", 403);
  if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 199) throw error("Некорректная страница журнала", "invalid_pagination", 400);
  // The owner returns items only. One extra item proves that another page exists.
  const value = await domain<unknown>(`/homework/audit?limit=${pageSize + 1}&after=${after}`, { signal });
  checkScope(snapshot);
  if (!record(value) || !Array.isArray(value.items) || value.items.length > pageSize + 1) throw error("Сервис вернул некорректный журнал", "invalid_audit_response");
  let previous = after;
  for (const row of value.items) {
    if (!record(row) || !positiveID(row.id) || row.id <= previous || !(row.actor_id === null || positiveID(row.actor_id)) || typeof row.action !== "string" || !row.action || row.action.length > 100 || typeof row.entity_id !== "string" || row.entity_id.length > 100 || typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at))) throw error("Сервис вернул некорректную запись журнала", "invalid_audit_response");
    previous = row.id;
  }
  const items = (value.items as HomeworkAuditEntry[]).slice(0, pageSize);
  return { items, hasMore: value.items.length > pageSize, nextCursor: items.at(-1)?.id ?? after };
}

export function homeworkSettingsError(failure: unknown): string {
  const code = record(failure) && typeof failure.code === "string" ? failure.code : "";
  const messages: Record<string, string> = { forbidden: "Недостаточно прав в выбранном кабинете", invalid_settings: "Проверьте допустимые значения настроек", transport_error: "Не удалось получить ответ сервера. Повторите чтение.", dependency_unavailable: "Сервис домашних работ временно недоступен", upstream_unavailable: "Сервис домашних работ временно недоступен", invalid_persisted_settings: "Сохранённые настройки недоступны. Обратитесь к администратору сервиса.", division_required: "Выберите подразделение", context_changed: "Кабинет изменился. Обновите страницу." };
  return messages[code] ?? (failure instanceof Error ? failure.message : "Не удалось выполнить запрос");
}

export function homeworkAuditAction(action: string) {
  const labels: Record<string, string> = { "settings.update": "Изменены настройки", "type.save": "Сохранён тип задания", "type.archive": "Архивирован тип задания", "assignment.save": "Сохранено задание", "assignment.delete": "Удалено задание", "manual.save": "Сохранён результат вручную", "upload.create": "Начата загрузка", "upload.complete": "Завершена передача файла", "upload.ready": "Файл подготовлен", "upload.cancel": "Отменена загрузка", "upload.retry": "Повторена обработка файла", "draft.remove": "Удалён черновик", "submission.submit": "Работа отправлена", "submission.claim": "Работа взята на проверку", "submission.takeover": "Проверка передана другому проверяющему", "submission.release": "Работа освобождена", "submission.request-revision": "Запрошена доработка", "submission.grade": "Работа оценена", "submission.edit-grade": "Изменена оценка", "submission.resubmit": "Работа отправлена повторно" };
  return labels[action] ?? action;
}
