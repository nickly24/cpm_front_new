import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ enabled: true, legacy: vi.fn(), list: vi.fn(), saveRole: vi.fn(), deleteRole: vi.fn(), saveUser: vi.fn(), revokeUser: vi.fn() }));
vi.mock("@/lib/config", () => ({ get BFF_DEV() { return state.enabled; } }));
vi.mock("@/lib/api/client", () => ({ apiRequest: state.legacy }));
vi.mock("@/lib/bff/core-access", () => ({ listCoreAccess: state.list, saveCoreAccessRole: state.saveRole, deleteCoreAccessRole: state.deleteRole, saveCoreAccessUser: state.saveUser, revokeCoreAccessUser: state.revokeUser }));
import { adminAccessApi } from "./admin-access-api";
const role = { name: "Роль", description: "", permissions: {} };
const user = { full_name: "Имя", login: "staff", role_id: 3, is_active: true };
beforeEach(() => { state.enabled = true; for (const mock of [state.legacy, state.list, state.saveRole, state.deleteRole, state.saveUser, state.revokeUser]) mock.mockReset(); });
describe("Access API mode boundary", () => {
  it("uses only Core adapters in BFF mode for roles and selected memberships", async () => {
    const signal = new AbortController().signal;
    await adminAccessApi.list(signal); await adminAccessApi.saveRole(role); await adminAccessApi.saveRole(role, 3); await adminAccessApi.deleteRole(3); await adminAccessApi.saveUser(user); await adminAccessApi.saveUser(user, 45); await adminAccessApi.deleteUser(45);
    expect(state.list).toHaveBeenCalledWith(signal); expect(state.saveRole.mock.calls).toEqual([[role, undefined], [role, 3]]); expect(state.revokeUser).toHaveBeenCalledWith(45); expect(state.legacy).not.toHaveBeenCalled();
  });
  it("preserves every production legacy endpoint outside BFF", async () => {
    state.enabled = false;
    await adminAccessApi.list(); await adminAccessApi.saveRole(role); await adminAccessApi.saveRole(role, 3); await adminAccessApi.deleteRole(3); await adminAccessApi.saveUser(user); await adminAccessApi.saveUser(user, 45); await adminAccessApi.deleteUser(45);
    expect(state.legacy.mock.calls.map(call => [call[0], call[1]?.method ?? "GET"])).toEqual([["/api/admin-access", "GET"], ["/api/admin-access/roles", "POST"], ["/api/admin-access/roles/3", "PUT"], ["/api/admin-access/roles/3", "DELETE"], ["/api/admin-access/users", "POST"], ["/api/admin-access/users/45", "PUT"], ["/api/admin-access/users/45", "DELETE"]]);
    expect(state.list).not.toHaveBeenCalled(); expect(state.saveRole).not.toHaveBeenCalled(); expect(state.saveUser).not.toHaveBeenCalled();
  });
  it("does not silently fall back after owner authorization rejection", async () => {
    state.list.mockRejectedValue(Object.assign(new Error("denied"), { status: 403 })); await expect(adminAccessApi.list()).rejects.toMatchObject({ status: 403 }); expect(state.legacy).not.toHaveBeenCalled();
  });
});
