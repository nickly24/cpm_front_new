import { domain, getIdentity } from "./client";
import { activateCoreUser, coreError, coreUncertain, coreUser, coreUsers, createCoreUser, generatedCorePassword, updateCoreUser, type CoreRole } from "./core-admin";
import type { AccessData, AccessRole, AccessSaveResult, AccessUserInput, RoleInput } from "@/lib/admin/admin-access-api";
import type { SectionPermissions, User } from "@/lib/auth/types";

const labels: Record<string, string> = {
  dashboard: "Главная", organizations: "Организации", divisions: "Подразделения", groups: "Группы", directions: "Направления", users: "Пользователи", schools: "Школы", upload: "Загрузка", schedule: "Расписание", assignments: "Домашние задания", "review-queue": "Очередь работ", "homework-archive": "Архив работ", monitoring: "Мониторинг", tests: "Тесты", "test-results": "Результаты тестов", exams: "Экзамены", attendance: "Посещаемость", scan: "Сканирование", zaps: "Запросы на отгул", train: "Карточки", ratings: "Рейтинг",
};
export function canManageCoreAccess(user: User | null | undefined = getIdentity()?.user): boolean { return user?.role === "admin" && user.organization_admin === true; }
function context(requireDivision = false): string {
  const user = getIdentity()?.user;
  if (!canManageCoreAccess(user)) throw new Error("Доступ и роли изменяет администратор организации");
  if (!user?.account_id || !user.organization_id) throw new Error("Войдите в кабинет заново");
  if (requireDivision && !user.division_id) throw new Error("Выберите подразделение в меню кабинетов");
  return `${user.account_id}:${user.organization_id}:${user.division_id ?? "org"}`;
}
function ensureContext(snapshot: string) { if (context() !== snapshot) throw new Error("Кабинет изменился. Обновите список."); }
function positiveId(value: number): number { if (!Number.isSafeInteger(value) || value < 1) throw new Error("Недопустимый ID"); return value; }
const enabled = (flag: boolean | number) => flag === true || flag === 1;
const roles = (signal?: AbortSignal) => domain<{ roles: CoreRole[]; sections: string[] }>("/core/roles", { signal });
export function mapCoreAccessRole(role: CoreRole, usersCount: number | null): AccessRole {
  const permissions: SectionPermissions = {};
  for (const permission of role.permissions) permissions[permission.section] = { view: enabled(permission.can_view) || enabled(permission.can_edit), edit: enabled(permission.can_edit) };
  return { id: positiveId(role.id), name: role.name, description: "", users_count: usersCount, permissions };
}
export async function listCoreAccess(signal?: AbortSignal): Promise<AccessData> {
  const snapshot = context(), divisionSelected = !!getIdentity()?.user.division_id;
  const [catalog, users] = await Promise.all([roles(signal), divisionSelected ? coreUsers("staff_admin", signal) : Promise.resolve([])]);
  ensureContext(snapshot);
  return { status: true, divisionSelected, sections: catalog.sections.map(section => ({ id: section, label: labels[section] ?? section })), roles: catalog.roles.map(role => mapCoreAccessRole(role, divisionSelected ? users.filter(user => user.role_id === role.id).length : null)), users: users.map(user => ({ id: positiveId(user.account_id), full_name: user.full_name, login: user.login, role_id: user.role_id ?? 0, role_name: catalog.roles.find(role => role.id === user.role_id)?.name ?? "Роль недоступна", is_active: enabled(user.is_active) })) };
}
interface PendingRole { scope: string; method: "POST" | "PUT" | "DELETE"; id?: number; before: number[]; input?: { name: string; permissions: SectionPermissions } }
const journalKey = () => `cpm-core-access-role:${context()}`;
export function pendingCoreAccessRole(): PendingRole | null { try { return JSON.parse(sessionStorage.getItem(journalKey()) ?? "null"); } catch { return null; } }
export function dismissCoreAccessRole() { try { sessionStorage.removeItem(journalKey()); } catch {} }
function sameRole(role: CoreRole, input: NonNullable<PendingRole["input"]>) {
  const actual = mapCoreAccessRole(role, null).permissions;
  const sections = new Set([...Object.keys(actual), ...Object.keys(input.permissions)]);
  return role.name === input.name && [...sections].every(section => !!actual[section]?.view === !!input.permissions[section]?.view && !!actual[section]?.edit === !!input.permissions[section]?.edit);
}
export async function recoverCoreAccessRole(): Promise<void> {
  const pending = pendingCoreAccessRole(); if (!pending) throw new Error("Нет запроса для проверки");
  const catalog = await roles(); ensureContext(pending.scope);
  const matches = pending.method === "POST" ? catalog.roles.filter(role => !pending.before.includes(role.id) && sameRole(role, pending.input!)) : catalog.roles.filter(role => role.id === pending.id);
  const confirmed = pending.method === "DELETE" ? matches.length === 0 : pending.method === "POST" ? matches.length === 1 : matches.length === 1 && sameRole(matches[0], pending.input!);
  if (!confirmed) throw new Error("Результат не подтверждён. Проверьте текущие роли перед новым изменением.");
  dismissCoreAccessRole();
}
function accessError(error: unknown): Error {
  const result = coreError(error), code = (error as { code?: string })?.code;
  const messages: Record<string, string> = { role_in_use: "Роль используется в одном или нескольких подразделениях. Сначала измените назначения.", last_membership: "Нельзя отозвать последнее участие. Аккаунт можно отключить, сохранив историю.", cannot_remove_self: "Нельзя отозвать свой доступ", membership_has_history: "Участие защищено историей", rating_exists: "Участие защищено историей рейтингов", invalid_role: "Проверьте название роли и разрешения", role_required: "Выберите роль сотрудника" };
  if (code && messages[code]) result.message = messages[code];
  return result;
}
export async function saveCoreAccessRole(input: RoleInput, roleId?: number): Promise<AccessSaveResult> {
  const snapshot = context(), key = journalKey();
  if (pendingCoreAccessRole()) throw new Error("Сначала проверьте результат предыдущего изменения роли");
  const name = input.name.trim(); if (!name || name.length > 100) throw new Error("Укажите название роли до 100 символов");
  if (input.description.trim()) throw new Error("Core не поддерживает описание роли");
  const catalog = await roles(); ensureContext(snapshot);
  if (roleId !== undefined) positiveId(roleId);
  const permissions: SectionPermissions = {};
  for (const [section, flags] of Object.entries(input.permissions)) {
    if (!catalog.sections.includes(section)) throw new Error("Сервис не поддерживает выбранный раздел");
    permissions[section] = { view: flags.view || flags.edit, edit: flags.edit };
  }
  const payload = { name, permissions }, pending: PendingRole = { scope: snapshot, method: roleId === undefined ? "POST" : "PUT", id: roleId, input: payload, before: catalog.roles.map(role => role.id) };
  sessionStorage.setItem(key, JSON.stringify(pending));
  try {
    const result = await domain<{ id: number }>(`/core/roles${roleId === undefined ? "" : `/${roleId}`}`, { method: pending.method, body: JSON.stringify(payload) });
    ensureContext(snapshot); sessionStorage.removeItem(key); return { status: true, id: result.id };
  } catch (error) {
    if (!coreUncertain(error)) sessionStorage.removeItem(key);
    const result = accessError(error); if (coreUncertain(error)) result.message = "Ответ не получен. Проверьте изменение роли перед новым запросом."; throw result;
  }
}
export async function deleteCoreAccessRole(roleId: number): Promise<void> {
  const snapshot = context(), key = journalKey(); positiveId(roleId);
  if (pendingCoreAccessRole()) throw new Error("Сначала проверьте результат предыдущего изменения роли");
  sessionStorage.setItem(key, JSON.stringify({ scope: snapshot, method: "DELETE", id: roleId, before: [] } satisfies PendingRole));
  try { await domain(`/core/roles/${roleId}`, { method: "DELETE" }); ensureContext(snapshot); sessionStorage.removeItem(key); }
  catch (error) { if (!coreUncertain(error)) sessionStorage.removeItem(key); const result = accessError(error); if (coreUncertain(error)) result.message = "Ответ не получен. Проверьте удаление роли перед новым запросом."; throw result; }
}
export async function saveCoreAccessUser(input: AccessUserInput, accountId?: number): Promise<AccessSaveResult> {
  const snapshot = context(true), fullName = input.full_name.trim(), login = input.login.trim(); positiveId(input.role_id);
  if (!fullName || fullName.length > 50 || !login || login.length > 50 || /\s/.test(login)) throw new Error("Укажите ФИО и логин до 50 символов; логин без пробелов");
  if (input.password && (input.password.length < 8 || input.password.length > 128)) throw new Error("Пароль должен содержать от 8 до 128 символов");
  if (accountId !== undefined) {
    const user = await coreUser(positiveId(accountId)); ensureContext(snapshot);
    if (user.role !== "staff_admin") throw new Error("На этом экране изменяется только доступ сотрудников");
    if (login !== user.login && !input.password) throw new Error("Для смены логина укажите новый пароль");
    try {
      await updateCoreUser(accountId, { ...(fullName !== user.full_name ? { full_name: fullName } : {}), role_id: input.role_id, ...(input.password ? { login, password: input.password } : {}) });
      ensureContext(snapshot); if (input.is_active !== enabled(user.is_active)) await activateCoreUser(accountId, input.is_active);
      return { status: true, id: accountId, ...(input.password ? { credentials: { login, password: input.password } } : {}) };
    } catch (error) { const result = accessError(error); result.message += " Обновите данные: часть изменений могла сохраниться."; throw result; }
  }
  const password = input.password || generatedCorePassword();
  const created = await createCoreUser({ role: "staff_admin", full_name: fullName, class: 0, tg_name: "", school_id: null, group_id: null, role_id: input.role_id, login, password });
  try { ensureContext(snapshot); if (!input.is_active) await activateCoreUser(created.account_id, false); }
  catch (error) { throw Object.assign(accessError(error), { code: "access_partial_saved", accountId: created.account_id, message: "Сотрудник создан, но состояние аккаунта не подтверждено. Обновите список перед новым изменением." }); }
  return { status: true, id: created.account_id, credentials: { login, password } };
}
export async function revokeCoreAccessUser(accountId: number): Promise<void> {
  const snapshot = context(true), user = await coreUser(positiveId(accountId)); ensureContext(snapshot);
  if (user.role !== "staff_admin") throw new Error("На этом экране отзывается только доступ сотрудников");
  try { await domain(`/core/memberships/${accountId}`, { method: "DELETE" }); }
  catch (error) { const result = accessError(error); if (coreUncertain(error)) result.message = "Ответ не получен. Обновите список и проверьте доступ сотрудника."; throw result; }
}
