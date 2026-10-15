// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudentHomeworkResponse } from "@/lib/student/homework-types";
const { navigation, fetchPage } = vi.hoisted(() => ({ navigation: { query: "", changed: () => {} }, fetchPage: vi.fn() }));
const navigate = (url: string) => { navigation.query = url.split("?")[1] || ""; window.history.replaceState({}, "", url); queueMicrotask(navigation.changed); };
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.query), usePathname: () => "/student", useRouter: () => ({ replace: navigate, push: navigate }) }));
vi.mock("@/lib/bff/use-homework-types", () => ({ useHomeworkTypes: () => ({ names: ["ОВ", "Право"], error: "" }) }));
vi.mock("@/lib/student/homework-api", async importOriginal => ({ ...await importOriginal<object>(), fetchStudentHomework: fetchPage }));
vi.mock("@/components/homework/homework-workspace", () => ({ HomeworkWorkspaceModal: ({ onClose }: { onClose: () => void }) => <div role="dialog"><button onClick={onClose}>Закрыть работу</button></div> }));
vi.mock("@/components/ui/filter-popover", () => ({ FilterPopover: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
import { StudentHomeworkSection } from "./student-homework-section";

function data(page = 1, status = "all"): StudentHomeworkResponse {
  const counts = { all: 32, undone: 19, in_review: 8, revision: 4, done: 5 };
  const total = counts[status as keyof typeof counts];
  const pages = Math.max(1, Math.ceil(total / 12));
  page = Math.min(page, pages);
  return { status: true, res: Array.from({ length: Math.min(12, total - (page - 1) * 12) }, (_, index) => ({ homework_id: (page - 1) * 12 + index + 1, homework_name: `Карточка ${(page - 1) * 12 + index + 1}`, homework_type: "ОВ", deadline: "2026-10-20", status: "не сдано", result: null, submission_state: "none" })), counts, pagination: { current_page: page, total_pages: pages, total_items: total, items_per_page: 12 } };
}
function mount(query = "") {
  navigation.query = query;
  window.history.replaceState({}, "", "/student" + (query ? "?" + query : ""));
  const view = render(<StudentHomeworkSection />);
  navigation.changed = () => view.rerender(<StudentHomeworkSection />);
  return view;
}
beforeEach(() => { fetchPage.mockReset(); navigation.query = ""; navigation.changed = () => {}; fetchPage.mockImplementation(async ({ page, status }) => data(page, status)); });
afterEach(cleanup);

describe("student homework remote pages", () => {
  it("loads only one page, keeps SQL counts and requests the next page on click", async () => {
    mount();
    await screen.findByText("Карточка 1");
    expect(screen.getAllByRole("article")).toHaveLength(12);
    expect(screen.getByRole("button", { name: "Все задания 32" })).toBeTruthy();
    expect(screen.queryByText("Карточка 13")).toBeNull();
    expect(fetchPage).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Страница 2" }));
    await screen.findByText("Карточка 13");
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage.mock.calls[1][0]).toMatchObject({ page: 2, limit: 12, status: "all" });
    expect(navigation.query).toBe("page=2");
    expect(screen.queryByText("Карточка 1")).toBeNull();
  });
  it("restores page and all filters on reload, resets page when a tab or type changes", async () => {
    mount("page=2&type=ОВ&status=undone&search=право");
    await screen.findByText("Карточка 13");
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage.mock.calls[0][0]).toMatchObject({ page: 2, type: "ОВ", status: "undone", search: "право" });
    fireEvent.click(screen.getByRole("button", { name: "На проверке 8" }));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(fetchPage.mock.calls[1][0]).toMatchObject({ page: 1, type: "ОВ", status: "in_review", search: "право" });
    fireEvent.change(screen.getByRole("combobox", { name: "Тип задания" }), { target: { value: "Право" } });
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(3));
    expect(fetchPage.mock.calls[2][0]).toMatchObject({ page: 1, type: "Право", status: "in_review" });
  });
  it("debounces search and sends it to the owner rather than filtering this page locally", async () => {
    mount("page=2"); await screen.findByText("Карточка 13");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Москва" } });
    expect(fetchPage).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(fetchPage.mock.calls[1][0]).toMatchObject({ page: 1, search: "Москва" });
    expect(new URLSearchParams(navigation.query).get("search")).toBe("Москва");
  });
  it("cancels stale requests and never lets a late response replace the selected filter", async () => {
    const pending: ((value: StudentHomeworkResponse) => void)[] = [];
    fetchPage.mockImplementation(() => new Promise(resolve => pending.push(resolve)));
    mount();
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: /На проверке/ }));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(fetchPage.mock.calls[0][0].signal.aborted).toBe(true);
    await act(async () => pending[1]({ ...data(1, "in_review"), res: [{ ...data().res[0], homework_name: "Правильный фильтр" }] }));
    await screen.findByText("Правильный фильтр");
    await act(async () => pending[0](data()));
    expect(screen.queryByText("Карточка 1")).toBeNull();
    expect(screen.getByText("Правильный фильтр")).toBeTruthy();
  });
  it("refreshes counts after workspace changes, and opening a card does not load the list again", async () => {
    mount(); await screen.findByText("Карточка 1");
    fireEvent.click(screen.getAllByRole("button", { name: "Подготовить работу" })[0]);
    await screen.findByRole("dialog");
    expect(fetchPage).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new Event("homework-workspace-updated")));
    expect(fetchPage).toHaveBeenCalledTimes(1);
    fetchPage.mockResolvedValueOnce({ ...data(), counts: { ...data().counts, done: 6, undone: 18 } });
    fireEvent.click(screen.getByRole("button", { name: "Закрыть работу" }));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    await screen.findByRole("button", { name: "Проверено 6" });
  });
  it("normalizes a page removed by a count change without looping or loading intermediate pages", async () => {
    mount("page=99");
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    await screen.findByText("Карточка 25");
    expect(fetchPage.mock.calls.map(call => call[0].page)).toEqual([99, 3]);
    expect(navigation.query).toBe("page=3");
    expect(screen.getAllByRole("article")).toHaveLength(8);
  });
  it("shows a page error without keeping cards from the previous page or fetching other pages", async () => {
    mount(); await screen.findByText("Карточка 1");
    fetchPage.mockRejectedValueOnce(new Error("Страница не загрузилась"));
    fireEvent.click(screen.getByRole("button", { name: "Страница 2" }));
    await screen.findByRole("alert");
    expect(screen.queryByText("Карточка 1")).toBeNull();
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});
