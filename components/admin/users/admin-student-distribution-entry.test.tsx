// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: { role: "admin", organization_admin: true, account_id: 8, id: 8, organization_id: 1, division_id: 10, full_name: "Synthetic admin" } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("@/lib/config", () => ({ BFF_DEV: true }));
vi.mock("@/lib/admin/admin-users-api", () => ({ fetchAdminStudents: async () => [], fetchAdminGroupsList: async () => [], editAdminStudent: vi.fn() }));
vi.mock("./admin-student-divisions", () => ({ AdminStudentDivisions: ({ onClose }: { onClose: () => void }) => <section aria-label="Distribution fixture"><button onClick={onClose}>Вернуться к ученикам</button></section> }));
vi.mock("./admin-student-deletion", () => ({ AdminStudentDeletionManager: () => null }));
vi.mock("./admin-student-panel", () => ({ AdminStudentPanel: () => null }));
vi.mock("./core-access", () => ({ CoreCreateRecovery: () => null, CoreEditOnly: () => null, CoreReadOnlyControl: () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/cabinet/admin/users" }));
import { AdminStudentsTab } from "./admin-students-tab";
afterEach(cleanup);
describe("students distribution entry", () => {
  it("opens distribution from Students and returns without replacing the users screen", async () => {
    render(<AdminStudentsTab />);
    fireEvent.click(screen.getByRole("button", { name: "Распределить по подразделениям" }));
    expect(screen.getByRole("region", { name: "Distribution fixture" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Вернуться к ученикам" }));
    await screen.findByRole("searchbox", { name: "Поиск учеников" });
    expect(screen.queryByRole("region", { name: "Distribution fixture" })).toBeNull();
  });
});
