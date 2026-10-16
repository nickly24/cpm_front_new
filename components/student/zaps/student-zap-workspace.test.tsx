// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Zap } from "@/lib/bff/attendance";
const mocks = vi.hoisted(() => ({ query: "", changed: () => {}, read: vi.fn(), execute: vi.fn(), guard: vi.fn(), pending: false, user: { role: "student", division_id: 7, account_id: 12, organization_id: 1 } }));
function navigate(url: string) { mocks.query = url.split("?")[1] ?? ""; queueMicrotask(mocks.changed); }
vi.mock("next/navigation", () => ({ usePathname: () => "/cabinet/student/zaps", useSearchParams: () => new URLSearchParams(mocks.query), useRouter: () => ({ push: navigate, replace: navigate }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/lib/bff/use-context-guard", () => ({ useContextGuard: mocks.guard }));
vi.mock("@/lib/bff/attendance", async original => ({ ...await original<object>(), readAttendance: mocks.read, ownDivisions: () => [{ id: 7, name: "Кабинет" }] }));
vi.mock("@/components/attendance/shared", () => ({ useAction: () => ({ execute: mocks.execute, busy: false, pending: mocks.pending, error: "" }), ActionNotice: () => null }));
import { StudentZapWorkspace } from "./student-zap-workspace";
const zap: Zap = { id: 15, division_id: 7, account_id: 12, text: "Демо-заявка", answer: "Согласовано", status: "approved", dates: [{ date: "2026-10-17", status: "linked", class_day_id: 8 }] };
function mount(query = "") { mocks.query = query; const view = render(<StudentZapWorkspace />); mocks.changed = () => view.rerender(<StudentZapWorkspace />); return view; }
beforeEach(() => { mocks.pending = false; mocks.query = ""; mocks.changed = () => {}; mocks.read.mockReset().mockImplementation(async (path: string) => ({ value: path.endsWith("/15") ? { zap, image_count: 0 } : [zap], revision: 42 })); mocks.execute.mockReset().mockImplementation(async (_command, done) => { done?.({ value: zap, revision: 43 }); }); mocks.guard.mockClear(); });
afterEach(cleanup);

describe("student leave requests", () => {
  it("opens the list first, then a separate form and returns without creating anything", async () => {
    mount(); await screen.findByText("Демо-заявка");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(mocks.read).toHaveBeenCalledWith("/divisions/7/zaps", expect.any(AbortSignal));
    fireEvent.click(screen.getByRole("button", { name: "Запросить отгул" }));
    await screen.findByRole("textbox", { name: "Причина отгула" });
    expect(mocks.query).toBe("create=1");
    expect(screen.queryByText("Демо-заявка")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "К моим заявкам" }));
    await screen.findByText("Демо-заявка"); expect(mocks.query).toBe(""); expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("supports direct quick-action entry and preserves the existing command payload/revision", async () => {
    mount("create=1&keep=yes");
    fireEvent.change(await screen.findByRole("textbox", { name: "Причина отгула" }), { target: { value: "Демо-причина" } });
    const send = screen.getByRole("button", { name: "Отправить заявку" });
    await waitFor(() => expect(send.hasAttribute("disabled")).toBe(false));
    fireEvent.click(send);
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1));
    expect(mocks.execute.mock.calls[0][0]).toMatchObject({ path: "/divisions/7/zaps", method: "POST", revision: 42, data: { text: "Демо-причина", images: [], dates: [expect.any(String)] } });
    await screen.findByText("Демо-заявка"); expect(mocks.query).toBe("keep=yes");
  });
  it("keeps the date limit and removes dates without allowing an empty submission", async () => {
    mount("create=1"); const remove = await screen.findByRole("button", { name: /^Убрать дату/ }); fireEvent.click(remove);
    fireEvent.change(screen.getByRole("textbox", { name: "Причина отгула" }), { target: { value: "Демо" } });
    expect(screen.getByRole("button", { name: "Отправить заявку" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("Дата отгула"), { target: { value: "2026-10-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Добавить" }));
    await screen.findByRole("button", { name: "Убрать дату 2026-10-20" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Отправить заявку" }).hasAttribute("disabled")).toBe(false));
  });
  it("opens request detail using the current endpoints and blocks sending unresolved commands", async () => {
    const view = mount(); fireEvent.click(await screen.findByRole("button", { name: "Открыть заявку №15" }));
    await screen.findByText("Причина"); expect(mocks.read).toHaveBeenCalledWith("/divisions/7/zaps/15", expect.any(AbortSignal)); expect(mocks.guard).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "К моим заявкам" }));
    await screen.findByRole("button", { name: "Запросить отгул" });
    mocks.pending = true; view.rerender(<StudentZapWorkspace />);
    expect(screen.getByRole("button", { name: "Запросить отгул" }).hasAttribute("disabled")).toBe(true);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("validates attachment limits before a command can be sent", async () => {
    mount("create=1"); const input = await screen.findByLabelText(/Прикрепить документ/);
    fireEvent.change(input, { target: { files: [new File(["x"], "bad.pdf", { type: "application/pdf" })] } });
    await screen.findByRole("alert"); expect(screen.getByText("Нужны PNG или JPEG до 512 КБ каждый")).toBeTruthy(); expect(mocks.execute).not.toHaveBeenCalled();
  });
});
