import { getIdentity } from "./client";
import { canManageCoreAccess } from "./core-access";
import {
  coreOrganizationAccountMemberships,
  coreOrganizationAccounts,
  coreOrganizationRoles,
  saveCoreOrganizationParticipation,
} from "./core-organization";

export interface StudentDivisionProgress { added: number; existing: number; total: number }
export type DistributionAccountRole = "student" | "staff_admin";
export interface StaffDivisionAssignment { divisionId: number; roleId: number }

/** Additive only: never replaces memberships, moves groups or recreates accounts. */
export async function assignStudentDivisions(
  accounts: number[], divisions: number[], onProgress: (progress: StudentDivisionProgress) => void,
  shouldContinue: () => boolean = () => true,
): Promise<StudentDivisionProgress> {
  return assignDivisions(accounts, divisions.map(divisionId => ({ divisionId, roleId: null })), "student", onProgress, shouldContinue);
}

export async function assignStaffAdminDivisions(
  accounts: number[], assignments: StaffDivisionAssignment[], onProgress: (progress: StudentDivisionProgress) => void,
  shouldContinue: () => boolean = () => true,
): Promise<StudentDivisionProgress> {
  return assignDivisions(accounts, assignments, "staff_admin", onProgress, shouldContinue);
}

async function assignDivisions(
  accounts: number[], assignments: { divisionId: number; roleId: number | null }[], accountRole: DistributionAccountRole,
  onProgress: (progress: StudentDivisionProgress) => void, shouldContinue: () => boolean,
): Promise<StudentDivisionProgress> {
  const identity = getIdentity();
  if (!canManageCoreAccess(identity?.user)) throw new Error("Распределение доступно администратору организации");
  const snapshot = JSON.stringify([identity?.user.account_id, identity?.user.organization_id, identity?.user.division_id, identity?.context_revision]);
  const checkContext = () => {
    if (!shouldContinue()) throw new Error("Распределение остановлено: раздел закрыт. Проверьте сохранённые участия.");
    const current = getIdentity();
    if (!canManageCoreAccess(current?.user) || snapshot !== JSON.stringify([current?.user.account_id, current?.user.organization_id, current?.user.division_id, current?.context_revision])) {
      throw new Error("Кабинет изменился. Обновите список.");
    }
  };
  const accountIds = [...new Set(accounts)], targets = new Map<number, number | null>();
  const positive = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  if (!accountIds.length || !assignments.length || accountIds.some(id => !positive(id))) throw new Error("Выберите пользователей и подразделения");
  for (const { divisionId, roleId } of assignments) {
    if (!positive(divisionId)) throw new Error("Выберите подразделение");
    if (accountRole === "staff_admin" && !positive(roleId)) throw new Error("Выберите роль для каждого нового подразделения");
    if (targets.has(divisionId) && targets.get(divisionId) !== roleId) throw new Error("Для подразделения выбраны разные роли");
    targets.set(divisionId, roleId);
  }
  checkContext();
  if (accountRole === "staff_admin") {
    const [roles, rows] = await Promise.all([coreOrganizationRoles(), coreOrganizationAccounts()]);
    checkContext();
    if ([...targets.values()].some(roleId => !roles.some(role => role.id === roleId))) throw new Error("Выберите действующую роль этой организации");
    if (accountIds.some(id => !rows.some(row => row.account_id === id && row.role === "staff_admin" && row.owner_organization_id === identity?.user.organization_id))) {
      throw new Error("Выберите администраторов подразделений своей организации");
    }
  }
  const progress = { added: 0, existing: 0, total: accountIds.length * targets.size };
  onProgress({ ...progress });
  // One writer at a time; the existing owner adapter journals unknown outcomes.
  for (const accountId of accountIds) {
    checkContext();
    const detail = await coreOrganizationAccountMemberships(accountId);
    checkContext();
    if (!detail.can_assign) throw new Error("Назначение доступно только организации владельца аккаунта");
    for (const [divisionId, roleId] of targets) {
      checkContext();
      if (detail.memberships.some(member => member.division_id === divisionId)) progress.existing++;
      else {
        await saveCoreOrganizationParticipation(divisionId, accountId, roleId);
        checkContext();
        // A successful write followed by failed readback stops the batch; no resend.
        const actual = await coreOrganizationAccountMemberships(accountId);
        checkContext();
        if (!actual.memberships.some(member => member.division_id === divisionId && (accountRole !== "staff_admin" || member.role_id === roleId))) throw new Error("Не удалось подтвердить назначение и роль. Обновите участия перед продолжением.");
        progress.added++;
      }
      onProgress({ ...progress });
    }
  }
  return progress;
}
