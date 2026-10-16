import { getIdentity } from "./client";
import { canManageCoreAccess } from "./core-access";
import {
  coreOrganizationAccountMemberships,
  saveCoreOrganizationParticipation,
} from "./core-organization";

export interface StudentDivisionProgress { added: number; existing: number; total: number }

/** Additive only: never replaces memberships, moves groups or recreates accounts. */
export async function assignStudentDivisions(
  accounts: number[], divisions: number[], onProgress: (progress: StudentDivisionProgress) => void,
  shouldContinue: () => boolean = () => true,
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
  const accountIds = [...new Set(accounts)], divisionIds = [...new Set(divisions)];
  if (!accountIds.length || !divisionIds.length || [...accountIds, ...divisionIds].some(id => !Number.isSafeInteger(id) || id <= 0)) throw new Error("Выберите учеников и подразделения");
  const progress = { added: 0, existing: 0, total: accountIds.length * divisionIds.length };
  onProgress({ ...progress });
  // One writer at a time; the existing owner adapter journals unknown outcomes.
  for (const accountId of accountIds) {
    checkContext();
    const detail = await coreOrganizationAccountMemberships(accountId);
    checkContext();
    if (!detail.can_assign) throw new Error("Назначение доступно только организации владельца аккаунта");
    for (const divisionId of divisionIds) {
      checkContext();
      if (detail.memberships.some(member => member.division_id === divisionId)) progress.existing++;
      else {
        await saveCoreOrganizationParticipation(divisionId, accountId, null);
        checkContext();
        // A successful write followed by failed readback stops the batch; no resend.
        const actual = await coreOrganizationAccountMemberships(accountId);
        checkContext();
        if (!actual.memberships.some(member => member.division_id === divisionId)) throw new Error("Не удалось подтвердить назначение. Обновите участия перед продолжением.");
        progress.added++;
      }
      onProgress({ ...progress });
    }
  }
  return progress;
}
