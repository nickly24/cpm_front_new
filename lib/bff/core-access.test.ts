import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ identity: { user: { role: "admin", account_id: 9, organization_id: 1001, division_id: 12 as number | null, organization_admin: true, permissions: {} } }, domain: vi.fn() }));
vi.mock("./client", () => ({ domain: state.domain, getIdentity: () => state.identity }));
import { canManageCoreAccess, deleteCoreAccessRole, listCoreAccess, mapCoreAccessRole, pendingCoreAccessRole, recoverCoreAccessRole, revokeCoreAccessUser, saveCoreAccessRole, saveCoreAccessUser } from "./core-access";
const role = { id: 3, name: "Наблюдатель", permissions: [{ section: "users", can_view: 1, can_edit: 0 }] };
const catalog = { roles: [role], sections: ["users", "groups"] };
const staff = { account_id: 45, profile_id: 2, role: "staff_admin", full_name: "Сотрудник", class: null, tg_name: "keep", school_id: null, group_id: null, role_id: 3, is_active: 1, login: "staff" };
const input = { name: "Редактор", description: "", permissions: { users: { view: false, edit: true } } };
let storage: Map<string, string>;
beforeEach(() => {
  state.domain.mockReset(); state.identity.user.role = "admin"; state.identity.user.organization_admin = true; state.identity.user.division_id = 12;
  storage = new Map(); vi.stubGlobal("sessionStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
});
describe("Core access owner contracts", () => {
  it("requires the full admin role and organization flag, even with delegated permissions", async () => {
    state.identity.user.role = "staff_admin"; expect(canManageCoreAccess()).toBe(false);
    await expect(listCoreAccess()).rejects.toThrow("администратор организации");
    await expect(saveCoreAccessRole(input)).rejects.toThrow("администратор организации");
    expect(state.domain).not.toHaveBeenCalled();
  });
  it("maps SQL booleans and preserves distinct zero and unavailable counts", () => {
    expect(mapCoreAccessRole(role, 0)).toMatchObject({ users_count: 0, description: "", permissions: { users: { view: true, edit: false } } });
    expect(mapCoreAccessRole(role, null).users_count).toBeNull();
  });
  it("lists actual roles and selected staff account IDs without passwords or fake global counts", async () => {
    state.domain.mockResolvedValueOnce(catalog).mockResolvedValueOnce([{ ...staff, password: "never-copy" }]);
    const result = await listCoreAccess();
    expect(result.sections).toEqual([{ id: "users", label: "Пользователи" }, { id: "groups", label: "Группы" }]);
    expect(result.roles[0].users_count).toBe(1); expect(result.users[0]).toEqual({ id: 45, full_name: "Сотрудник", login: "staff", role_id: 3, role_name: "Наблюдатель", is_active: true });
    expect(JSON.stringify(result)).not.toContain("never-copy"); expect(state.domain.mock.calls[1][0]).toBe("/core/users?role=staff_admin&limit=200&offset=0");
  });
  it("allows organization roles without a division and avoids any scoped user request", async () => {
    state.identity.user.division_id = null; state.domain.mockResolvedValueOnce(catalog);
    const result = await listCoreAccess(); expect(result).toMatchObject({ divisionSelected: false, users: [], roles: [{ users_count: null }] });
    expect(state.domain).toHaveBeenCalledTimes(1);
    await expect(saveCoreAccessUser({ full_name: "Имя", login: "staff", role_id: 3, is_active: true })).rejects.toThrow("Выберите подразделение");
  });
  it("writes only actual owner fields and normalizes edit to include view", async () => {
    state.domain.mockResolvedValueOnce(catalog).mockResolvedValueOnce({ id: 8 });
    expect(await saveCoreAccessRole(input)).toEqual({ status: true, id: 8 });
    expect(state.domain.mock.calls[1]).toEqual(["/core/roles", { method: "POST", body: '{"name":"Редактор","permissions":{"users":{"view":true,"edit":true}}}' }]);
    expect(storage.size).toBe(0);
  });
  it("does not invent role descriptions or unsupported section permissions", async () => {
    await expect(saveCoreAccessRole({ ...input, description: "Не хранится" })).rejects.toThrow("не поддерживает описание");
    state.domain.mockResolvedValueOnce(catalog);
    await expect(saveCoreAccessRole({ ...input, permissions: { unsupported: { view: true, edit: false } } })).rejects.toThrow("не поддерживает выбранный раздел");
    expect(state.domain.mock.calls.some(call => call[1]?.method === "POST")).toBe(false);
  });
  it("journals before role POST and recovers lost response without repeating or matching preexisting name", async () => {
    const duplicate = { ...role, name: "Редактор", permissions: [{ section: "users", can_view: 1, can_edit: 1 }] };
    state.domain.mockResolvedValueOnce({ ...catalog, roles: [duplicate] }).mockImplementationOnce(async () => {
      expect(pendingCoreAccessRole()).toMatchObject({ method: "POST", before: [3] });
      throw Object.assign(new Error("lost"), { status: 0 });
    });
    await expect(saveCoreAccessRole(input)).rejects.toThrow("Проверьте изменение");
    await expect(saveCoreAccessRole(input)).rejects.toThrow("предыдущего");
    state.domain.mockResolvedValueOnce({ ...catalog, roles: [duplicate] }); await expect(recoverCoreAccessRole()).rejects.toThrow("не подтверждён");
    state.domain.mockResolvedValueOnce({ ...catalog, roles: [duplicate, { ...duplicate, id: 8 }] }); await recoverCoreAccessRole();
    expect(pendingCoreAccessRole()).toBeNull(); expect(state.domain.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
  });
  it("does not accept a changed role as confirmation of unknown PUT", async () => {
    state.domain.mockResolvedValueOnce(catalog).mockRejectedValueOnce(Object.assign(new Error("lost"), { status: 503 }));
    await expect(saveCoreAccessRole(input, 3)).rejects.toThrow("Ответ не получен");
    state.domain.mockResolvedValueOnce(catalog); await expect(recoverCoreAccessRole()).rejects.toThrow("не подтверждён");
    state.domain.mockResolvedValueOnce({ ...catalog, roles: [{ id: 3, name: "Редактор", permissions: [{ section: "users", can_view: 1, can_edit: 1 }] }] }); await recoverCoreAccessRole();
    expect(pendingCoreAccessRole()).toBeNull();
  });
  it("localizes global role in-use conflict and does not leave uncertainty on known rejection", async () => {
    state.domain.mockRejectedValueOnce(Object.assign(new Error("role_in_use"), { status: 409, code: "role_in_use" }));
    await expect(deleteCoreAccessRole(3)).rejects.toThrow("нескольких подразделениях"); expect(pendingCoreAccessRole()).toBeNull();
  });
  it("confirms unknown DELETE only after the role is actually absent", async () => {
    state.domain.mockRejectedValueOnce(Object.assign(new Error("lost"), { status: 0 })); await expect(deleteCoreAccessRole(3)).rejects.toThrow("Проверьте удаление");
    state.domain.mockResolvedValueOnce(catalog); await expect(recoverCoreAccessRole()).rejects.toThrow("не подтверждён");
    state.domain.mockResolvedValueOnce({ ...catalog, roles: [] }); await recoverCoreAccessRole(); expect(pendingCoreAccessRole()).toBeNull();
  });
  it("validates login and password before profile changes and never GETs credentials", async () => {
    state.domain.mockResolvedValueOnce(staff);
    await expect(saveCoreAccessUser({ full_name: "Другое имя", login: "other", role_id: 3, is_active: true }, 45)).rejects.toThrow("новый пароль");
    expect(state.domain.mock.calls).toEqual([["/core/users/45", { signal: undefined }]]);
  });
  it("edits actual account identity with a complete fresh profile, membership role and active flag", async () => {
    state.domain.mockResolvedValueOnce(staff).mockResolvedValueOnce(staff).mockResolvedValue(null);
    expect(await saveCoreAccessUser({ full_name: "Другое имя", login: "staff", role_id: 4, is_active: false }, 45)).toEqual({ status: true, id: 45 });
    expect(state.domain.mock.calls.map(call => call[0])).toEqual(["/core/users/45", "/core/users/45", "/core/users/45", "/core/memberships/45", "/core/users/45/active"]);
    expect(JSON.parse(state.domain.mock.calls[2][1].body)).toEqual({ full_name: "Другое имя", class: 0, tg_name: "keep", school_id: null });
    expect(storage.size).toBe(0);
  });
  it("returns a submitted password only as an immediate save result and never journals it", async () => {
    state.domain.mockResolvedValueOnce({ account_id: 45 });
    const result = await saveCoreAccessUser({ full_name: "Имя", login: "new", role_id: 3, is_active: true, password: "SECRETpass9" });
    expect(result).toMatchObject({ id: 45, credentials: { login: "new", password: "SECRETpass9" } }); expect([...storage.values()].join()).not.toContain("SECRETpass9");
    expect(JSON.parse(state.domain.mock.calls[0][1].body)).toMatchObject({ role: "staff_admin", role_id: 3, class: 0, school_id: null, group_id: null });
  });
  it("does not allow a new POST after an uncertain create and never persists its password", async () => {
    state.domain.mockRejectedValueOnce(Object.assign(new Error("lost"), { status: 0 }));
    const user = { full_name: "Имя", login: "new", role_id: 3, is_active: true, password: "SECRETpass9" };
    await expect(saveCoreAccessUser(user)).rejects.toThrow("Проверьте создание"); await expect(saveCoreAccessUser(user)).rejects.toThrow("предыдущего");
    expect(state.domain).toHaveBeenCalledTimes(1); expect([...storage.values()].join()).not.toContain("SECRETpass9");
  });
  it("distinguishes a created account from an unconfirmed later activation, preventing a duplicate create", async () => {
    state.domain.mockResolvedValueOnce({ account_id: 45 }).mockRejectedValueOnce(Object.assign(new Error("lost"), { status: 0 }));
    await expect(saveCoreAccessUser({ full_name: "Имя", login: "new", role_id: 3, is_active: false, password: "SECRETpass9" })).rejects.toMatchObject({ code: "access_partial_saved", accountId: 45 });
    expect(state.domain.mock.calls.map(call => call[0])).toEqual(["/core/users", "/core/users/45/active"]);
  });
  it("revokes only selected membership instead of deleting account and explains last-membership protection", async () => {
    state.domain.mockResolvedValueOnce(staff).mockRejectedValueOnce(Object.assign(new Error("last_membership"), { status: 409, code: "last_membership" }));
    await expect(revokeCoreAccessUser(45)).rejects.toThrow("последнее участие"); expect(state.domain.mock.calls[1]).toEqual(["/core/memberships/45", { method: "DELETE" }]);
  });
});
