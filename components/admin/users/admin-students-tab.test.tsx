// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/lib/auth/types";
import type { AdminStudent } from "@/lib/admin/admin-users-types";
import { AdminStudentsTab } from "./admin-students-tab";
import { fetchAdminGroupsList, fetchAdminStudents } from "@/lib/admin/admin-users-api";

const state = vi.hoisted(() => ({ user: { id: 1, role: "admin", full_name: "Synthetic administrator" } as User }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/cabinet/admin/users" }));
vi.mock("@/lib/hooks/use-debounced-value", () => ({ useDebouncedValue: (value: string) => value }));
vi.mock("@/lib/admin/admin-users-api", () => ({ fetchAdminStudents: vi.fn(), fetchAdminGroupsList: vi.fn(), editAdminStudent: vi.fn() }));
vi.mock("@/components/admin/users/admin-student-panel", () => ({ AdminStudentPanel: () => null }));
vi.mock("@/components/admin/users/admin-student-deletion", () => ({ AdminStudentDeletionManager: ({ onCompleted }: { onCompleted: (id: number) => void }) =>
  <button onClick={() => onCompleted(16)}>Synthetic complete 16</button> }));

const students: AdminStudent[] = Array.from({ length: 32 }, (_, index) => ({ id: index + 1,
  full_name: `Тестовый ${index + 1}`, class: 9, group_id: index < 31 ? 7 : 8, school_id: 1 }));
const dialogMethods = ["showModal", "close"] as const;
const originalDialogMethods = dialogMethods.map((name) => Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name));
beforeAll(() => {
  for (const name of dialogMethods) {
    Object.defineProperty(HTMLDialogElement.prototype, name, { configurable: true,
      value(this: HTMLDialogElement) { this.open = name === "showModal"; } });
  }
});
afterAll(() => {
  dialogMethods.forEach((name, index) => {
    const original = originalDialogMethods[index];
    if (original) Object.defineProperty(HTMLDialogElement.prototype, name, original);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  });
});
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.clearAllMocks();
  state.user = { id: 1, role: "admin", full_name: "Synthetic administrator" };
  vi.mocked(fetchAdminStudents).mockResolvedValue(students);
  vi.mocked(fetchAdminGroupsList).mockResolvedValue([{ group_id: 7, group_name: "Группа A" }, { group_id: 8, group_name: "Группа B" }]);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("students table deletion integration", () => {
  it.each([false, true])("requires users/edit for staff deletion (edit=%s)", async (edit) => {
    state.user = { ...state.user, role: "staff_admin", permissions: { users: { view: true, edit } } };
    render(<AdminStudentsTab />);
    await screen.findByText("Тестовый 1");
    expect(screen.queryAllByRole("button", { name: "Удалить" }).length).toBe(edit ? 15 : 0);
    expect(Boolean(screen.queryByText("Synthetic complete 16"))).toBe(edit);
  });
  it("refreshes completed deletions while retaining filters and an existing current page", async () => {
    render(<AdminStudentsTab />);
    await screen.findByText("Тестовый 1");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Тестовый" } });
    fireEvent.click(screen.getByRole("button", { name: /^Фильтры/ }));
    fireEvent.change(screen.getByLabelText("Группа"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Класс"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    fireEvent.click(within(screen.getByRole("navigation", { name: "Страницы" })).getByRole("button", { name: "2" }));
    expect(screen.getByText("Тестовый 16")).toBeTruthy();
    vi.mocked(fetchAdminStudents).mockResolvedValue(students.filter((student) => student.id !== 16));
    fireEvent.click(screen.getByText("Synthetic complete 16"));
    await waitFor(() => expect(fetchAdminStudents).toHaveBeenCalledTimes(2));
    await screen.findByText("Тестовый 17");
    expect(screen.queryByText("Тестовый 1")).toBeNull();
    expect(screen.queryByText("Тестовый 16")).toBeNull();
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("Тестовый");
    fireEvent.click(screen.getByRole("button", { name: /^Фильтры/ }));
    expect((screen.getByLabelText("Группа") as HTMLSelectElement).value).toBe("7");
    expect((screen.getByLabelText("Класс") as HTMLSelectElement).value).toBe("9");
  });
  it("clamps to the last remaining page when a deletion removes the final page", async () => {
    vi.mocked(fetchAdminStudents).mockResolvedValue(students.slice(0, 16));
    render(<AdminStudentsTab />);
    await screen.findByText("Тестовый 1");
    fireEvent.click(within(screen.getByRole("navigation", { name: "Страницы" })).getByRole("button", { name: "2" }));
    expect(screen.getByText("Тестовый 16")).toBeTruthy();
    vi.mocked(fetchAdminStudents).mockResolvedValue(students.slice(0, 15));
    fireEvent.click(screen.getByText("Synthetic complete 16"));
    await screen.findByText("Тестовый 1");
    expect(screen.queryByText("Ученики не найдены")).toBeNull();
    expect(screen.queryByText("Тестовый 16")).toBeNull();
  });
});
