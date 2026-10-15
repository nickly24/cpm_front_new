// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminTestForm } from "./admin-test-form";
import type { AdminTestDetail } from "@/lib/admin/admin-tests-types";

vi.mock("@/lib/config", () => ({BFF_DEV: true}));
vi.mock("@/lib/bff/use-context-guard", () => ({useContextGuard: () => {}}));
vi.mock("@/lib/admin/admin-tests-api", () => ({createAdminTest: vi.fn(), updateAdminTest: vi.fn(), describeAdminTestRecalc: () => ({kind: "success"})}));
import { createAdminTest, updateAdminTest } from "@/lib/admin/admin-tests-api";

const detail: AdminTestDetail = {_id: "a".repeat(24), title: "Тест", direction: "Право", startDate: "", endDate: "", timeLimitMinutes: 30, visible: false, published: false,
  actions: {can_edit_metadata: true, can_edit_settings: true, can_attach: false, can_copy: true, can_detach: false, can_archive: true, can_manage_bank: true},
  questions: [{questionId: 7, type: "text", text: "Введите ответ", points: 1, answers: [], correctAnswers: ["Москва", " МОСКВА "]}]};

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("test editor text alias recovery", () => {
  it("opens the offending question before sending a save, then permits removing the duplicate", () => {
    render(<AdminTestForm mode="edit" editingTest={detail} directions={[{id: 1, name: "Право"}]} onBack={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.submit(screen.getByRole("button", {name: "Сохранить изменения"}).closest("form")!);
    expect(screen.getByText(/Вопрос №1, ответ №2/)).toBeTruthy();
    const input = screen.getByRole("textbox", {name: "Правильный ответ 2"});
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect((screen.getByRole("button", {name: "Сохранить вопрос"}) as HTMLButtonElement).disabled).toBe(true);
    expect(updateAdminTest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {name: "Удалить правильный ответ 2"}));
    expect((screen.getByRole("button", {name: "Сохранить вопрос"}) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", {name: "Сохранить вопрос"}));
    fireEvent.submit(screen.getByRole("button", {name: "Сохранить изменения"}).closest("form")!);
    expect(screen.getByRole("dialog", {name: "Сохранить изменения?"})).toBeTruthy();
    expect(createAdminTest).not.toHaveBeenCalled();
  });
  it("blocks a new empty text alias and clears the error after entering a valid one", () => {
    render(<AdminTestForm mode="create" directions={[{id: 1, name: "Право"}]} onBack={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", {name: "+ Текстовый"}));
    expect(screen.getByRole("alert").textContent).toContain("пустой вариант");
    fireEvent.change(screen.getByRole("textbox", {name: "Текст вопроса"}), {target: {value: "Столица?"}});
    fireEvent.change(screen.getByRole("textbox", {name: "Правильный ответ 1"}), {target: {value: "Москва"}});
    expect(screen.queryByRole("alert")).toBeNull();
    expect((screen.getByRole("button", {name: "Сохранить вопрос"}) as HTMLButtonElement).disabled).toBe(false);
  });
});
