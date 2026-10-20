import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ identity: { user: { account_id: 8, organization_id: 1, division_id: 10, role: "admin", organization_admin: true }, context_revision: "r1" }, read: vi.fn(), save: vi.fn(), accounts: vi.fn(), roles: vi.fn() }));
vi.mock("./client", () => ({ getIdentity: () => state.identity }));
vi.mock("./core-organization", () => ({ coreOrganizationAccountMemberships: state.read, saveCoreOrganizationParticipation: state.save, coreOrganizationAccounts: state.accounts, coreOrganizationRoles: state.roles }));
import { assignStudentDivisions, assignStaffAdminDivisions } from "./student-divisions";

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


describe("restricted administrator distribution", () => {
  beforeEach(() => {
    state.accounts.mockResolvedValue([45,46].map(account_id => ({ account_id, role:"staff_admin", owner_organization_id:1 })));
    state.roles.mockResolvedValue([{id:3,name:"Преподаватель"},{id:4,name:"Куратор"}]);
    state.read.mockImplementation(async (account_id:number) => ({account_id,can_assign:true,memberships:[...memberships.get(account_id)!].map(division_id=>({division_id,role_id:division_id===20?4:3}))}));
    const assignedRoles=new Map<string,number>();
    state.read.mockImplementation(async (account_id:number) => ({account_id,can_assign:true,memberships:[...memberships.get(account_id)!].map(division_id=>({division_id,role_id:assignedRoles.get(`${account_id}:${division_id}`) ?? (division_id===20?4:3)}))}));
    state.save.mockImplementation(async (division:number,account:number,role:number) => { memberships.get(account)!.add(division);assignedRoles.set(`${account}:${division}`,role); });
  });
  it("grants different explicit roles for each new division and confirms those roles",async()=>{
    state.read.mockResolvedValueOnce({can_assign:true,memberships:[{division_id:10,role_id:3}]}).mockResolvedValueOnce({memberships:[{division_id:10,role_id:3},{division_id:20,role_id:4}]}).mockResolvedValueOnce({memberships:[{division_id:30,role_id:3}]});
    expect(await assignStaffAdminDivisions([45],[{divisionId:20,roleId:4},{divisionId:30,roleId:3}],vi.fn())).toEqual({added:2,existing:0,total:2});
    expect(state.save.mock.calls).toEqual([[20,45,4],[30,45,3]]);
  });
  it("does not replace existing roles in a bulk assignment",async()=>{
    expect(await assignStaffAdminDivisions([45,46],[{divisionId:10,roleId:4},{divisionId:20,roleId:4}],vi.fn())).toEqual({added:2,existing:2,total:4});
    expect(state.save.mock.calls).toEqual([[20,45,4],[10,46,4]]);
  });
  it.each([0,-1,NaN,999])("rejects a missing or foreign role before writing (%s)",async(roleId)=>{
    await expect(assignStaffAdminDivisions([45],[{divisionId:20,roleId}],vi.fn())).rejects.toThrow(/роль/);
    expect(state.save).not.toHaveBeenCalled();
  });
  it.each([{role:"student",owner_organization_id:1},{role:"admin",owner_organization_id:1},{role:"staff_admin",owner_organization_id:99}])("refuses a wrong account category/owner before writing %o",async(patch)=>{
    state.accounts.mockResolvedValueOnce([{account_id:45,...patch}]);
    await expect(assignStaffAdminDivisions([45],[{divisionId:20,roleId:4}],vi.fn())).rejects.toThrow("своей организации");
    expect(state.save).not.toHaveBeenCalled();
  });
  it("stops when readback reports a different role, without writing the next division",async()=>{
    state.read.mockResolvedValueOnce({can_assign:true,memberships:[]}).mockResolvedValueOnce({memberships:[{division_id:20,role_id:3}]});
    await expect(assignStaffAdminDivisions([45],[{divisionId:20,roleId:4},{divisionId:30,roleId:3}],vi.fn())).rejects.toThrow("подтвердить назначение и роль");
    expect(state.save.mock.calls).toEqual([[20,45,4]]);
  });
  it("stops after a lost reply and never automatically applies to the next account",async()=>{
    state.save.mockRejectedValueOnce(new Error("lost reply"));
    await expect(assignStaffAdminDivisions([45,46],[{divisionId:20,roleId:4}],vi.fn())).rejects.toThrow("lost reply");
    expect(state.save).toHaveBeenCalledTimes(1);
  });
  it("requires the full organization administrator even for valid scoped roles",async()=>{
    state.identity.user.role="staff_admin";
    await expect(assignStaffAdminDivisions([45],[{divisionId:20,roleId:4}],vi.fn())).rejects.toThrow("администратору организации");
    expect(state.roles).not.toHaveBeenCalled();expect(state.save).not.toHaveBeenCalled();
  });
});
