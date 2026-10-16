import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ identity: { user: { account_id: 8, organization_id: 1, division_id: 10, role: "admin", organization_admin: true }, context_revision: "r1" }, read: vi.fn(), save: vi.fn() }));
vi.mock("./client", () => ({ getIdentity: () => state.identity }));
vi.mock("./core-organization", () => ({ coreOrganizationAccountMemberships: state.read, saveCoreOrganizationParticipation: state.save }));
import { assignStudentDivisions } from "./student-divisions";

let memberships: Map<number, Set<number>>;
beforeEach(() => {
  vi.clearAllMocks(); Object.assign(state.identity.user, { role: "admin", organization_admin: true, organization_id: 1 }); state.identity.context_revision = "r1";
  memberships = new Map([[45, new Set([10])], [46, new Set([20])]]);
  state.read.mockImplementation(async (account: number) => ({ account_id: account, can_assign: true, memberships: [...(memberships.get(account) ?? [])].map(division_id => ({ division_id })) }));
  state.save.mockImplementation(async (division: number, account: number) => { memberships.get(account)!.add(division); });
});
describe("additive student distribution", () => {
  it("adds one student to multiple divisions, skips existing and keeps the original memberships", async () => {
    const progress = vi.fn();
    expect(await assignStudentDivisions([45, 45], [10, 20, 30, 30], progress)).toEqual({ added: 2, existing: 1, total: 3 });
    expect(state.save.mock.calls).toEqual([[20, 45, null], [30, 45, null]]);
    expect([...memberships.get(45)!]).toEqual([10, 20, 30]);
    expect(progress.mock.calls.at(-1)?.[0]).toEqual({ added: 2, existing: 1, total: 3 });
  });
  it("processes a group sequentially and confirms every new assignment by reading", async () => {
    await assignStudentDivisions([45, 46], [30], vi.fn());
    expect(state.read.mock.calls).toEqual([[45], [45], [46], [46]]);
    expect(state.save.mock.calls).toEqual([[30, 45, null], [30, 46, null]]);
  });
  it("stops after unknown delivery without touching the next account or replaying", async () => {
    state.save.mockRejectedValueOnce(new Error("Ответ не получен"));
    await expect(assignStudentDivisions([45, 46], [20, 30], vi.fn())).rejects.toThrow("Ответ не получен");
    expect(state.save).toHaveBeenCalledTimes(1); expect(state.read.mock.calls).toEqual([[45]]);
  });
  it("stops on failed readback and explicitly resuming skips the already saved membership", async () => {
    const read = state.read.getMockImplementation()!;
    state.read.mockImplementationOnce(read).mockRejectedValueOnce(new Error("readback unavailable"));
    await expect(assignStudentDivisions([45, 46], [20], vi.fn())).rejects.toThrow("readback unavailable");
    expect(state.save).toHaveBeenCalledTimes(1);
    expect(await assignStudentDivisions([45, 46], [20], vi.fn())).toEqual({ added: 0, existing: 2, total: 2 });
    expect(state.save).toHaveBeenCalledTimes(1);
  });
  it("does not continue after context changes or component unmounts", async () => {
    state.read.mockImplementationOnce(async () => { state.identity.context_revision = "r2"; return { can_assign: true, memberships: [] }; });
    await expect(assignStudentDivisions([45], [20], vi.fn())).rejects.toThrow("Кабинет изменился");
    expect(state.save).not.toHaveBeenCalled();
    await expect(assignStudentDivisions([45], [20], vi.fn(), () => false)).rejects.toThrow("раздел закрыт");
    expect(state.save).not.toHaveBeenCalled();
  });
  it("preserves owner and full administrator checks", async () => {
    state.identity.user.role = "staff_admin";
    await expect(assignStudentDivisions([45], [20], vi.fn())).rejects.toThrow("администратору");
    expect(state.read).not.toHaveBeenCalled();
    state.identity.user.role = "admin";
    state.read.mockResolvedValueOnce({ can_assign: false, memberships: [] });
    await expect(assignStudentDivisions([45], [20], vi.fn())).rejects.toThrow("владельца");
    expect(state.save).not.toHaveBeenCalled();
  });
});
