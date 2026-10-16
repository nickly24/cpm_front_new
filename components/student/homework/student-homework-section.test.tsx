// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudentHomeworkResponse } from "@/lib/student/homework-types";
const { navigation, fetchPage } = vi.hoisted(() => ({ navigation: { query: "", changed: () => {}, desktop:false, back:vi.fn() }, fetchPage: vi.fn() }));
const navigate = (url: string) => { navigation.query = url.split("?")[1] || ""; window.history.replaceState({}, "", url); queueMicrotask(navigation.changed); };
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.query), usePathname: () => "/student", useRouter: () => ({ replace: navigate, push: navigate, back:navigation.back }) }));
vi.mock("@/lib/hooks/use-media-query", () => ({useMediaQuery:()=>navigation.desktop}));
vi.mock("@/lib/bff/use-homework-types", () => ({ useHomeworkTypes: () => ({ names: ["ОВ", "Право"], error: "" }) }));
vi.mock("@/lib/student/homework-api", async importOriginal => ({ ...await importOriginal<object>(), fetchStudentHomework: fetchPage }));
vi.mock("@/components/homework/homework-workspace", () => ({ HomeworkWorkspaceModal: ({ onClose, presentation }: { onClose: () => void; presentation?:string }) => <div role={presentation==="page"?"region":"dialog"} aria-label={presentation==="page"?"Страница домашнего задания":undefined}><button onClick={onClose}>Закрыть работу</button></div> }));
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
beforeEach(() => { navigation.desktop=false; navigation.back.mockReset(); vi.spyOn(window,"scrollTo").mockImplementation(()=>{}); HTMLDialogElement.prototype.showModal = function () { this.open = true; }; HTMLDialogElement.prototype.close = function () { this.open = false; }; fetchPage.mockReset(); navigation.query = ""; navigation.changed = () => {}; fetchPage.mockImplementation(async ({ page, status }) => data(page, status)); });
afterEach(()=>{cleanup();vi.restoreAllMocks();});

function changeStatus(label: string) {
  fireEvent.click(screen.getByRole("button", { name: "Изменить поиск заданий" }));
  fireEvent.click(screen.getByRole("button", { name: /^Статус/ }));
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}(?: ·|$)`) }));
  fireEvent.click(screen.getByRole("button", { name: "Найти задания" }));
}

describe("student homework remote pages", () => {
  it("loads only one page, keeps SQL counts and requests the next page on click", async () => {
    mount();
    await screen.findByText("Карточка 1");
    expect(screen.getAllByRole("article")).toHaveLength(12);
    expect(screen.getByRole("button", { name: "Изменить поиск заданий" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Обновить задания" })).toBeNull();
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
    changeStatus("На проверке");
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(fetchPage.mock.calls[1][0]).toMatchObject({ page: 1, type: "ОВ", status: "in_review", search: "право" });
    fireEvent.click(screen.getByRole("button", { name: "Изменить поиск заданий" }));
    fireEvent.click(screen.getByRole("button", { name: /^Тип задания/ }));
    fireEvent.click(screen.getByRole("button", { name: "Право" }));
    fireEvent.click(screen.getByRole("button", { name: "Найти задания" }));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(3));
    expect(fetchPage.mock.calls[2][0]).toMatchObject({ page: 1, type: "Право", status: "in_review" });
  });
  it("applies draft search to the owner only after submit", async () => {
    mount("page=2"); await screen.findByText("Карточка 13");
    fireEvent.click(screen.getByRole("button", { name: "Изменить поиск заданий" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Москва" } });
    expect(fetchPage).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Найти задания" }));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(fetchPage.mock.calls[1][0]).toMatchObject({ page: 1, search: "Москва" });
    expect(new URLSearchParams(navigation.query).get("search")).toBe("Москва");
  });
  it("cancels stale requests and never lets a late response replace the selected filter", async () => {
    const pending: ((value: StudentHomeworkResponse) => void)[] = [];
    fetchPage.mockImplementation(() => new Promise(resolve => pending.push(resolve)));
    mount();
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    changeStatus("На проверке");
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
    fireEvent.click(screen.getByRole("button", { name: "Открыть задание: Карточка 1" }));
    await screen.findByRole("dialog");
    expect(new URLSearchParams(navigation.query).get("work")).toBe("1");
    expect(fetchPage).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new Event("homework-workspace-updated")));
    expect(fetchPage).toHaveBeenCalledTimes(1);
    fetchPage.mockResolvedValueOnce({ ...data(), counts: { ...data().counts, done: 6, undone: 18 } });
    fireEvent.click(screen.getByRole("button", { name: "Закрыть работу" }));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Изменить поиск заданий" }));
    fireEvent.click(screen.getByRole("button", { name: /^Статус/ }));
    await screen.findByRole("button", { name: "Проверено · 6" });
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

it("refreshes the current homework query after pulling down at the top", async () => {
  mount("type=ОВ&status=undone"); await screen.findByText("Карточка 1");
  const list = screen.getByRole("region", { name: "Лента домашних заданий" });
  fireEvent.touchStart(list, { touches: [{ clientX: 20, clientY: 20 }] });
  fireEvent.touchMove(list, { touches: [{ clientX: 20, clientY: 160 }], cancelable: true });
  fireEvent.touchEnd(list);
  await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
  expect(fetchPage.mock.lastCall?.[0]).toMatchObject({ page: 1, type: "ОВ", status: "undone", limit: 12 });
});


it("uses independent desktop search and filters while requesting only the selected remote page",async()=>{
 navigation.desktop=true;mount("page=2&type=ОВ&status=undone&search=право");await screen.findByText("Карточка 13");
 expect(screen.queryByRole("button",{name:"Изменить поиск заданий"})).toBeNull();
 expect(screen.getByRole("combobox",{name:"Статус заданий"})).toHaveProperty("value","undone");
 expect(screen.getByRole("searchbox",{name:"Найти задание"})).toHaveProperty("value","право");
 fireEvent.change(screen.getByRole("combobox",{name:"Статус заданий"}),{target:{value:"in_review"}});
 await waitFor(()=>expect(fetchPage).toHaveBeenCalledTimes(2));expect(fetchPage.mock.calls[1][0]).toMatchObject({page:1,type:"ОВ",status:"in_review",search:"право"});
});
it("opens a desktop page instead of a dialog and returns with the same filters and page",async()=>{
 navigation.desktop=true;mount("page=2&type=ОВ");await screen.findByText("Карточка 13");
 const link=screen.getByRole("link",{name:"Открыть задание: Карточка 13"});expect(link.getAttribute("href")).toBe("/student?page=2&type=%D0%9E%D0%92&work=13");
 fireEvent.click(link);await screen.findByRole("region",{name:"Страница домашнего задания"});expect(screen.queryByRole("dialog")).toBeNull();expect(screen.queryByRole("searchbox")).toBeNull();expect(fetchPage).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole("button",{name:"Закрыть работу"}));expect(navigation.back).toHaveBeenCalledOnce();
 act(()=>navigate("/student?page=2&type=%D0%9E%D0%92"));await screen.findByText("Карточка 13");await waitFor(()=>expect(fetchPage).toHaveBeenCalledTimes(2));expect(fetchPage.mock.calls[1][0]).toMatchObject({page:2,type:"ОВ"});
});

it("restores desktop scroll only after the refreshed list has arrived",async()=>{
 navigation.desktop=true;mount();await screen.findByText("Карточка 1");
 Object.defineProperty(window,"scrollY",{value:420,configurable:true});
 fireEvent.click(screen.getByRole("link",{name:"Открыть задание: Карточка 1"}));await screen.findByRole("region",{name:"Страница домашнего задания"});
 let finish:(value:StudentHomeworkResponse)=>void=()=>{};
 fetchPage.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 act(()=>navigate("/student"));await waitFor(()=>expect(fetchPage).toHaveBeenCalledTimes(2));
 expect(window.scrollTo).not.toHaveBeenCalledWith({top:420,behavior:"instant"});
 await act(async()=>finish(data()));await screen.findByText("Карточка 1");
 await waitFor(()=>expect(window.scrollTo).toHaveBeenLastCalledWith({top:420,behavior:"instant"}));
 Object.defineProperty(window,"scrollY",{value:0,configurable:true});
});
