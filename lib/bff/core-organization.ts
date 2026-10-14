import { domain, getIdentity } from "./client";
import { coreAll, coreError, coreRoles, coreUncertain, type CoreRole } from "./core-admin";
import { canManageCoreAccess } from "./core-access";

export interface CoreOrganization { id: number; name: string; is_active: boolean | number }
export interface CoreDivision { id: number; name: string; is_active: boolean | number }
export interface CoreDirection { id: number; name: string }
export interface CoreOrganizationAccount {
  account_id: number; profile_id: number; role: string; login: string; full_name: string;
  is_active: boolean | number; owner_organization_id: number | null;
}
export interface CoreParticipation { division_id: number; division_name: string; role_id: number | null; role_name: string | null; group_id: number | null; can_revoke: boolean }
export interface CoreOrganizationMemberships { account_id: number; owner_organization_id: number | null; can_assign: boolean; can_revoke: boolean; memberships: CoreParticipation[] }
export interface CoreOrganizationCatalog { organization: CoreOrganization; divisions: CoreDivision[]; directions: CoreDirection[] }
export type CoreCatalogKind = "organization" | "division" | "direction";
interface Scope { account: number; organization: number; division: number | null; revision: string }
export interface PendingOrganizationCommand {
  organization_id: number; kind: CoreCatalogKind | "membership"; method: "POST" | "PUT" | "DELETE";
  id?: number; name?: string; before_ids?: number[]; account_id?: number; division_id?: number; role_id?: number | null;
}

const positive = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("Недопустимый идентификатор");
  return value;
};
function scope(manage = false): Scope {
  const identity = getIdentity(), user = identity?.user;
  if (!identity || !user?.account_id || !user.organization_id) throw new Error("Войдите в кабинет заново");
  if (manage && !canManageCoreAccess(user)) throw new Error("Изменения доступны только администратору организации");
  return { account: positive(user.account_id), organization: positive(user.organization_id), division: user.division_id ?? null, revision: identity.context_revision };
}
function assertScope(expected: Scope) {
  const current = scope();
  if (current.account !== expected.account || current.organization !== expected.organization || current.division !== expected.division || current.revision !== expected.revision) throw new Error("Кабинет изменился. Обновите данные перед изменением.");
}
const journalKey = () => { const current = scope(true); return `cpm-core-organization:${current.account}:${current.organization}`; };
export function pendingCoreOrganizationCommand(): PendingOrganizationCommand | null {
  try { return JSON.parse(sessionStorage.getItem(journalKey()) ?? "null"); } catch { return null; }
}
export function dismissCoreOrganizationCommand() { sessionStorage.removeItem(journalKey()); }
function assertNoPending() {
  if (pendingCoreOrganizationCommand()) throw new Error("Сначала проверьте результат предыдущего изменения");
}
export function coreOrganizationError(reason: unknown): Error {
  const error = coreError(reason), code = (reason as { code?: string })?.code;
  const labels: Record<string, string> = {
    division_has_members: "В подразделении есть участники. Сначала проверьте их участия; аккаунты и историю удалять нельзя.",
    division_has_history: "Подразделение защищено историей посещаемости и не может быть архивировано.",
    last_membership: "Нельзя снять последнее участие аккаунта. Отключение аккаунта выполняется в разделе пользователей.",
    membership_has_history: "Участие защищено учебной историей и не может быть снято.",
    rating_exists: "Участие защищено историей рейтингов, включая опубликованный нулевой рейтинг.",
    cannot_remove_self: "Нельзя снять собственное участие.",
    admin_has_organization_access: "Администратор имеет доступ ко всей организации без отдельных участий.",
    role_for_staff_admin_only: "Административная роль назначается только сотруднику с ограниченным доступом.",
    role_required: "Выберите административную роль сотрудника.",
    not_found: "Объект больше не доступен в этой организации. Обновите список.",
  };
  if (code && labels[code]) error.message = labels[code];
  return error;
}
const getOrganization = (signal?: AbortSignal) => domain<CoreOrganization>("/core/organization", { signal });
const getDivisions = (signal?: AbortSignal) => domain<CoreDivision[]>("/core/divisions", { signal });
const getDirections = (signal?: AbortSignal) => domain<CoreDirection[]>("/core/directions", { signal });
export async function coreOrganizationCatalog(signal?: AbortSignal): Promise<CoreOrganizationCatalog> {
  const snapshot = scope();
  try {
    const [organization, divisions, directions] = await Promise.all([getOrganization(signal), getDivisions(signal), getDirections(signal)]);
    assertScope(snapshot);
    if (organization.id !== snapshot.organization || !Array.isArray(divisions) || !Array.isArray(directions)) throw new Error("Сервис вернул неверные справочники организации");
    return { organization, divisions, directions };
  } catch (error) { throw coreOrganizationError(error); }
}
export async function coreOrganizationAccounts(signal?: AbortSignal): Promise<CoreOrganizationAccount[]> {
  const snapshot = scope(true);
  const accounts = await coreAll<CoreOrganizationAccount>("/core/organization/users", {}, signal);
  assertScope(snapshot);
  return accounts.map(row => ({ account_id: positive(row.account_id), profile_id: positive(row.profile_id), role: row.role, login: row.login, full_name: row.full_name, is_active: row.is_active, owner_organization_id: row.owner_organization_id }));
}
export async function coreOrganizationAccountMemberships(accountId: number, signal?: AbortSignal): Promise<CoreOrganizationMemberships> {
  const snapshot = scope(true); positive(accountId);
  const response = await domain<CoreOrganizationMemberships>(`/core/organization/users/${accountId}/memberships`, { signal }).catch(error => { throw coreOrganizationError(error); });
  assertScope(snapshot);
  if (response.account_id !== accountId || !Array.isArray(response.memberships)) throw new Error("Сервис вернул неверные участия аккаунта");
  return { account_id: response.account_id, owner_organization_id: response.owner_organization_id, can_assign: response.can_assign === true, can_revoke: response.can_revoke === true, memberships: response.memberships.map(row => ({ division_id: positive(row.division_id), division_name: row.division_name, role_id: row.role_id, role_name: row.role_name, group_id: row.group_id, can_revoke: row.can_revoke === true })) };
}
export async function coreOrganizationRoles(signal?: AbortSignal): Promise<CoreRole[]> {
  const snapshot = scope(true), roles = await coreRoles(signal); assertScope(snapshot); return roles;
}
function catalogPath(kind: CoreCatalogKind) { return kind === "organization" ? "/core/organization" : `/core/${kind === "division" ? "divisions" : "directions"}`; }
async function catalogRows(kind: CoreCatalogKind): Promise<{ id: number; name: string }[]> {
  return kind === "organization" ? [await getOrganization()] : kind === "division" ? getDivisions() : getDirections();
}
async function execute(command: PendingOrganizationCommand, snapshot: Scope, path: string, body?: unknown): Promise<number | undefined> {
  const key = journalKey(); assertScope(snapshot);
  // Owners do not implement receipts for these commands. Persist before sending and recover by GET only.
  sessionStorage.setItem(key, JSON.stringify(command));
  try {
    const result = await domain<{ id: number } | null>(path, { method: command.method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assertScope(snapshot); sessionStorage.removeItem(key);
    return result?.id ?? command.id;
  } catch (reason) {
    const uncertain = coreUncertain(reason) || (reason as { status?: number })?.status === 500 || (reason instanceof Error && reason.message.includes("Кабинет изменился"));
    if (!uncertain) sessionStorage.removeItem(key);
    const error = coreOrganizationError(reason);
    if (uncertain) error.message = "Ответ на изменение не получен. Проверьте результат по актуальным данным перед новым запросом.";
    throw error;
  }
}
export async function saveCoreOrganizationName(kind: CoreCatalogKind, input: string, entityId?: number): Promise<number | undefined> {
  const snapshot = scope(true); assertNoPending();
  const name = input.trim(), maximum = kind === "direction" ? 200 : 150;
  if (!name || [...name].length > maximum) throw new Error(`Укажите название до ${maximum} символов`);
  if (kind === "organization") {
    if (entityId !== undefined && entityId !== snapshot.organization) throw new Error("Выбрана другая организация");
    entityId = snapshot.organization;
  } else if (entityId !== undefined) positive(entityId);
  const before = await catalogRows(kind); assertScope(snapshot);
  if (entityId !== undefined && !before.some(row => row.id === entityId)) throw new Error("Объект больше не доступен. Обновите список.");
  const command: PendingOrganizationCommand = { kind, method: entityId === undefined ? "POST" : "PUT", organization_id: snapshot.organization, id: entityId, name, before_ids: before.map(row => row.id) };
  return execute(command, snapshot, `${catalogPath(kind)}${entityId !== undefined && kind !== "organization" ? `/${entityId}` : ""}`, { name });
}
export async function archiveCoreOrganizationCatalog(kind: "division" | "direction", entityId: number): Promise<void> {
  const snapshot = scope(true); assertNoPending(); positive(entityId);
  const current = await catalogRows(kind); assertScope(snapshot);
  if (!current.some(row => row.id === entityId)) throw new Error("Объект уже архивирован или недоступен. Обновите список.");
  await execute({ organization_id: snapshot.organization, kind, method: "DELETE", id: entityId }, snapshot, `${catalogPath(kind)}/${entityId}`);
}
async function membershipPreflight(snapshot: Scope, divisionId: number, accountId: number, roleId?: number | null) {
  positive(divisionId); positive(accountId);
  const [divisions, accounts, detail, roles] = await Promise.all([getDivisions(), coreOrganizationAccounts(), coreOrganizationAccountMemberships(accountId), roleId === undefined || roleId === null ? Promise.resolve([]) : coreOrganizationRoles()]);
  assertScope(snapshot);
  if (!divisions.some(row => row.id === divisionId)) throw new Error("Подразделение больше не доступно в этой организации");
  const account = accounts.find(row => row.account_id === accountId);
  if (!account) throw new Error("Аккаунт больше не доступен в выбранной организации");
  if (account.role === "admin") throw new Error("Администратор имеет доступ ко всей организации без отдельных участий");
  if (roleId !== undefined) {
    if (!detail.can_assign || account.owner_organization_id !== snapshot.organization || detail.owner_organization_id !== snapshot.organization) throw new Error("Назначение и изменение роли доступны только организации владельца аккаунта");
    if (account.role === "staff_admin") {
      if (roleId === null || !roles.some(role => role.id === positive(roleId))) throw new Error("Выберите действующую роль сотрудника этой организации");
    } else if (roleId !== null) throw new Error("Административная роль назначается только сотруднику с ограниченным доступом");
  }
  return detail;
}
export async function saveCoreOrganizationParticipation(divisionId: number, accountId: number, roleId: number | null): Promise<void> {
  const snapshot = scope(true); assertNoPending();
  await membershipPreflight(snapshot, divisionId, accountId, roleId);
  await execute({ organization_id: snapshot.organization, kind: "membership", method: "PUT", division_id: divisionId, account_id: accountId, role_id: roleId }, snapshot, `/core/divisions/${divisionId}/memberships/${accountId}`, { role_id: roleId });
}
export async function revokeCoreOrganizationParticipation(divisionId: number, accountId: number): Promise<void> {
  const snapshot = scope(true); assertNoPending();
  const detail = await membershipPreflight(snapshot, divisionId, accountId);
  const member = detail.memberships.find(row => row.division_id === divisionId);
  if (!member) throw new Error("Участие уже отсутствует. Обновите список.");
  if (!member.can_revoke) throw new Error("Владелец сервиса не разрешает снятие этого участия");
  await execute({ organization_id: snapshot.organization, kind: "membership", method: "DELETE", division_id: divisionId, account_id: accountId }, snapshot, `/core/divisions/${divisionId}/memberships/${accountId}`);
}
export async function recoverCoreOrganizationCommand(): Promise<void> {
  const snapshot = scope(true), pending = pendingCoreOrganizationCommand();
  if (!pending || pending.organization_id !== snapshot.organization) throw new Error("Нет запроса для проверки в этой организации");
  let confirmed = false;
  if (pending.kind === "membership") {
    const divisions = await getDivisions(); assertScope(snapshot);
    if (!divisions.some(row => row.id === pending.division_id)) throw new Error("Подразделение недоступно. Проверьте архив и участников вручную.");
    try {
      const detail = await coreOrganizationAccountMemberships(positive(pending.account_id!)); assertScope(snapshot);
      const member = detail.memberships.find(row => row.division_id === pending.division_id);
      confirmed = pending.method === "DELETE" ? !member : !!member && member.role_id === pending.role_id;
    } catch (error) {
      if (pending.method !== "DELETE" || (error as { status?: number })?.status !== 404) throw error;
      // Removing the last participation in this organization also removes its organization-access row.
      // Confirm absence via an authorized complete list; never treat a generic 404 as command success.
      const accounts = await coreOrganizationAccounts(); assertScope(snapshot);
      confirmed = !accounts.some(account => account.account_id === pending.account_id);
    }
  } else {
    const rows = await catalogRows(pending.kind); assertScope(snapshot);
    const matches = rows.filter(row => pending.method === "POST" ? !pending.before_ids?.includes(row.id) && row.name === pending.name : row.id === pending.id);
    confirmed = pending.method === "DELETE" ? matches.length === 0 : matches.length === 1 && matches[0].name === pending.name;
  }
  if (!confirmed) throw new Error("Результат не подтверждён. Проверьте актуальные данные перед следующим изменением.");
  dismissCoreOrganizationCommand();
}
