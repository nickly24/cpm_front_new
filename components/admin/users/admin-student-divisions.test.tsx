// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/lib/auth/types";
const state = vi.hoisted(() => ({ user: { account_id: 8, id: 8, role: "admin", organization_admin: true, organization_id: 1, division_id: 10, context_revision: "r1", full_name: "Admin" } as User,
  catalog: vi.fn(), accounts: vi.fn(), memberships: vi.fn(), divisionUsers: vi.fn(), assign: vi.fn(), pending: vi.fn(), recover: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("@/lib/config", () => ({ BFF_DEV: true }));
vi.mock("@/lib/bff/use-context-guard", () => ({ useContextGuard: vi.fn() }));
vi.mock("@/lib/bff/core-organization", () => ({ coreOrganizationCatalog: state.catalog, coreOrganizationAccounts: state.accounts, coreOrganizationAccountMemberships: state.memberships,
  coreOrganizationError: (reason: Error) => reason, pendingCoreOrganizationCommand: state.pending, recoverCoreOrganizationCommand: state.recover }));
vi.mock("@/lib/bff/core-admin", () => ({ coreAll: state.divisionUsers }));
vi.mock("@/lib/bff/student-divisions", () => ({ assignStudentDivisions: state.assign }));
import { AdminStudentDivisions } from "./admin-student-divisions";

const rows = Array.from({ length: 17 }, (_, index) => ({ account_id: 45 + index, profile_id: 900 + index, role: "student", login: `demo${index}`, full_name: `Ученик ${index + 1}`, is_active: true, owner_organization_id: 1 }));
beforeEach(() => {
  vi.clearAllMocks(); state.user = { ...state.user, role: "admin", organization_admin: true, organization_id: 1, context_revision: "r1" };
  state.catalog.mockResolvedValue({ organization: { id: 1, name: "Организация A" }, directions: [], divisions: [{ id: 10, name: "Основная" }, { id: 20, name: "Резерв" }, { id: 30, name: "Школа" }] });
  state.accounts.mockResolvedValue([...rows, { ...rows[0], account_id: 999, role: "proctor" }]);
  state.memberships.mockImplementation(async (account_id: number) => ({ account_id, can_assign: true, memberships: [{ division_id: 10, division_name: "Основная" }] }));
  state.pending.mockReturnValue(null);
  state.assign.mockImplementation(async (_accounts, _divisions, update) => { const result = { added: 2, existing: 0, total: 2 }; update(result); return result; });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.open = false; } });
});
afterEach(cleanup);
describe("student distribution workspace", () => {
  it("shows only students, reads visible memberships, and opens multiple target divisions for one account", async () => {
    render(<AdminStudentDivisions onClose={vi.fn()} />);
    await screen.findByText("Ученик 1"); await waitFor(() => expect(state.memberships).toHaveBeenCalledTimes(15));
    expect(screen.queryByText("ID 999")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Назначить подразделения" })[0]);
    const modal = within(screen.getByRole("dialog"));
    const original = modal.getByRole("checkbox", { name: /Основная/ }) as HTMLInputElement;
    expect(original.checked).toBe(true); expect(original.disabled).toBe(true);
    fireEvent.click(modal.getByRole("checkbox", { name: "Резерв" })); fireEvent.click(modal.getByRole("checkbox", { name: "Школа" }));
    fireEvent.click(modal.getByRole("button", { name: "Добавить в выбранные" }));
    await waitFor(() => expect(state.assign).toHaveBeenCalledWith([45], [20, 30], expect.any(Function), expect.any(Function)));
    await screen.findByText(/Готово: добавлено участий — 2/);
  });
  it("retains explicit selection between pages and assigns the selected accounts only", async () => {
    render(<AdminStudentDivisions onClose={vi.fn()} />); await screen.findByText("Ученик 1");
    fireEvent.click(screen.getByRole("checkbox", { name: "Выбрать Ученик 1" }));
    fireEvent.click(within(screen.getByRole("navigation", { name: "Страницы" })).getByRole("button", { name: "2" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Выбрать Ученик 17" }));
    fireEvent.click(screen.getByRole("button", { name: "Добавить в подразделения" }));
    const modal = within(screen.getByRole("dialog")); fireEvent.click(modal.getByRole("checkbox", { name: "Резерв" })); fireEvent.click(modal.getByRole("button", { name: "Добавить в выбранные" }));
    await waitFor(() => expect(state.assign).toHaveBeenCalledWith([45, 61], [20], expect.any(Function), expect.any(Function)));
  });
  it("filters a different division without changing the active cabinet and clears hidden selection", async () => {
    state.divisionUsers.mockResolvedValue([{ account_id: 61 }]);
    render(<AdminStudentDivisions onClose={vi.fn()} />); await screen.findByText("Ученик 1");
    fireEvent.click(screen.getByRole("checkbox", { name: "Выбрать Ученик 1" }));
    fireEvent.change(screen.getByLabelText("Подразделение"), { target: { value: "20" } });
    await screen.findByText("Ученик 17");
    expect(screen.queryByText("Ученик 1")).toBeNull();
    expect(state.divisionUsers).toHaveBeenCalledWith("/core/divisions/20/users", { role: "student" }, expect.any(AbortSignal));
    expect((screen.getByRole("button", { name: "Добавить в подразделения" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("stops a partial failure visibly and blocks resend while an outcome is unknown", async () => {
    state.assign.mockImplementationOnce(async (_accounts, _divisions, update) => { update({ added: 1, existing: 0, total: 2 }); state.pending.mockReturnValue({ kind: "membership" }); throw new Error("Ответ не получен"); });
    render(<AdminStudentDivisions onClose={vi.fn()} />); await screen.findByText("Ученик 1");
    fireEvent.click(screen.getAllByRole("button", { name: "Назначить подразделения" })[0]);
    const modal = within(screen.getByRole("dialog")); fireEvent.click(modal.getByRole("checkbox", { name: "Резерв" })); fireEvent.click(modal.getByRole("checkbox", { name: "Школа" })); fireEvent.click(modal.getByRole("button", { name: "Добавить в выбранные" }));
    await modal.findByText(/Выполнение остановлено/);
    expect(modal.getByText(/Подтверждено: 1 из 2/)).toBeTruthy();
    expect((modal.getByRole("button", { name: "Добавить в выбранные" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(modal.getByRole("button", { name: "Проверить результат" })); await waitFor(() => expect(state.recover).toHaveBeenCalledTimes(1));
    expect(state.assign).toHaveBeenCalledTimes(1);
  });
  it("does not fetch organization data for a filtered administrator", () => {
    state.user = { ...state.user, role: "staff_admin", organization_admin: false, permissions: { users: { view: true, edit: true } } };
    render(<AdminStudentDivisions onClose={vi.fn()} />);
    expect(state.accounts).not.toHaveBeenCalled(); expect(state.catalog).not.toHaveBeenCalled();
  });
});
