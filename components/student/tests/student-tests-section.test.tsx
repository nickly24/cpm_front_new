// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StudentTestsSection } from "./student-tests-section";
import { TESTS_STATUS_FILTER_OPTIONS } from "./tests-filter-options";
import type { StudentTestItem } from "@/lib/student/tests-types";
const mocks = vi.hoisted(() => ({ catalog: vi.fn(), all: vi.fn(), directions: vi.fn(), mobile: true, desktop:false, observers: new Set<IntersectionObserverCallback>() }));
vi.mock("@/lib/config", () => ({ BFF_DEV: true }));
vi.mock("@/lib/hooks/use-media-query", () => ({ useMediaQuery: (query:string) => query.includes("min-width") ? mocks.desktop : mocks.mobile }));
vi.mock("@/lib/student/test-attempt-v2-store", () => ({ listV2Bundles: async () => [] }));
vi.mock("@/lib/student/tests-api", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/student/tests-api")>(), fetchStudentAvailableTests: mocks.catalog, fetchTestsWithSessions: mocks.all, fetchDirections: mocks.directions }));
const tests: StudentTestItem[] = Array.from({ length: 19 }, (_, index) => ({ id: String(index), title: `Тест ${index + 1}`, status: "available", canStart: true }));
function response(page: number, limit: number, items = tests) {
  return { tests: items.slice((page - 1) * limit, page * limit), sessions: [], pagination: { current_page: page, total_pages: Math.ceil(items.length / limit), total_items: items.length, items_per_page: limit } };
}
const next = () => fireEvent.click(screen.getByRole("button", { name: "Загрузить ещё" }));
const intersect = () => act(() => { for (const callback of [...mocks.observers]) callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver); });
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  vi.clearAllMocks(); mocks.mobile = true; mocks.desktop=false; mocks.observers.clear();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private callback: IntersectionObserverCallback) {}
    observe() { mocks.observers.add(this.callback); }
    disconnect() { mocks.observers.delete(this.callback); }
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  mocks.catalog.mockImplementation(async (page: number, limit = 5) => response(page, limit));
  mocks.all.mockImplementation(async (_direction: string, page: number, limit = 5) => response(page, limit));
  mocks.directions.mockResolvedValue([{ id: 0, name: "Все направления" }, { id: 1, name: "Право" }, { id: 2, name: "История" }]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("appends six tests on reaching the end, retains older cards and restores position after closing details", async () => {
  render(<StudentTestsSection />);
  expect(await screen.findByRole("button", { name: "Тест 1" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Тесты" })).toBeNull();
  expect(screen.queryByRole("searchbox")).toBeNull();
  expect(screen.queryByText("Доступные тесты")).toBeNull();
  expect(screen.queryByRole("button", { name: "Следующая страница" })).toBeNull();
  expect(screen.queryByText("Тест 7")).toBeNull();
  intersect(); intersect();
  const test = await screen.findByRole("button", { name: "Тест 12" });
  expect(screen.getByText("Тест 1")).toBeTruthy();
  expect(mocks.catalog.mock.calls.map(call => call.slice(0, 2))).toEqual([[1, 6], [2, 6]]);
  screen.getByRole("region", { name: "Лента тестов" }).scrollTop = 900;
  fireEvent.click(test);
  expect(screen.getByRole("dialog", { name: "Карточка теста" })).toBeTruthy();
  expect(mocks.observers.size).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "К списку тестов" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByRole("region", { name: "Лента тестов" }).scrollTop).toBe(900);
  expect(screen.getByRole("button", { name: "Тест 12" })).toBeTruthy();
  expect(mocks.catalog).toHaveBeenCalledTimes(2);
  next(); await screen.findByText("Тест 18"); next(); await screen.findByText("Тест 19");
  expect(screen.getByText("Все тесты загружены")).toBeTruthy();
  expect(screen.getByText("Тест 1")).toBeTruthy();
  expect(mocks.observers.size).toBe(0);
});

it("preserves already loaded cards after a failed append and retries the same page", async () => {
  render(<StudentTestsSection />); await screen.findByText("Тест 1");
  mocks.catalog.mockRejectedValueOnce(new Error("Нет сети"));
  next(); await screen.findByRole("alert");
  expect(screen.getByText("Тест 1")).toBeTruthy();
  expect(mocks.observers.size).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
  await screen.findByText("Тест 12");
  expect(mocks.catalog.mock.calls.map(call => call[0])).toEqual([1, 2, 2]);
});

it("keeps filters inside search, applies the combined draft once and discards cancelled edits", async () => {
  render(<StudentTestsSection />); await screen.findByText("Тест 1");
  expect(screen.queryByRole("button", { name: "Изменить поиск тестов" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Все тесты" }));
  await waitFor(() => expect(mocks.all).toHaveBeenCalled());
  expect(screen.queryByRole("group", { name: "Статус" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Изменить поиск тестов" }));
  const dialog = within(screen.getByRole("dialog", { name: "Настройки поиска тестов" }));
  fireEvent.click(dialog.getByRole("button", { name: /^Статус/ }));
  const statuses = within(dialog.getByRole("group", { name: "Статус" }));
  expect(statuses.getAllByRole("button")).toHaveLength(TESTS_STATUS_FILTER_OPTIONS.length);
  fireEvent.click(statuses.getByRole("button", { name: /Ожидают отправки/ }));
  fireEvent.click(dialog.getByRole("button", { name: /^Направление/ }));
  fireEvent.click(dialog.getByRole("button", { name: "Право" }));
  expect(mocks.all.mock.lastCall?.[0]).toBe("Все направления");
  fireEvent.click(dialog.getByRole("button", { name: "Найти тесты" }));
  await waitFor(() => expect(mocks.all.mock.lastCall?.[0]).toBe("Право"));
  expect(mocks.all.mock.lastCall?.[3].status).toBe("pending_upload");
  expect(mocks.all.mock.lastCall?.slice(1, 3)).toEqual([1, 6]);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Изменить поиск тестов" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Поиск тестов" }), { target: { value: "Ист" } });
  fireEvent.click(screen.getByRole("button", { name: "История Направление" }));
  fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
  expect(mocks.all.mock.lastCall?.[0]).toBe("Право");
});

it("ignores an old page response arriving after applying another search filter", async () => {
  render(<StudentTestsSection />); await screen.findByText("Тест 1");
  fireEvent.click(screen.getByRole("button", { name: "Все тесты" }));
  await waitFor(() => expect(mocks.all).toHaveBeenCalled());
  let resolve!: (result: ReturnType<typeof response>) => void;
  mocks.all.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  next();
  mocks.all.mockResolvedValueOnce(response(1, 6, [{ id: "new", title: "Другой результат", status: "completed" }]));
  fireEvent.click(screen.getByRole("button", { name: "Изменить поиск тестов" }));
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.click(dialog.getByRole("button", { name: /^Статус/ }));
  fireEvent.click(dialog.getByRole("button", { name: /Сданные/ }));
  fireEvent.click(dialog.getByRole("button", { name: "Найти тесты" }));
  await screen.findByText("Другой результат");
  await act(async () => resolve(response(2, 6)));
  expect(screen.queryByText("Тест 12")).toBeNull();
  expect(screen.getByText("Другой результат")).toBeTruthy();
});

it("shows a static accessible status icon without a popup control", async () => {
  render(<StudentTestsSection/>); await screen.findByText("Тест 1");
  expect(screen.getAllByRole("img", { name: "Статус: Доступен" })).toHaveLength(6);
  expect(screen.queryByRole("button", { name: /Подробнее о статусе/ })).toBeNull();
});

it("keeps the overview feed in memory when returning from the all-tests tab", async () => {
  render(<StudentTestsSection />); await screen.findByText("Тест 1");
  next(); await screen.findByText("Тест 12");
  fireEvent.click(screen.getByRole("button", { name: "Все тесты" }));
  await waitFor(() => expect(mocks.all).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "К доступным тестам" }));
  await screen.findByText("Тест 12");
  expect(screen.getByText("Тест 1")).toBeTruthy();
  expect(mocks.catalog).toHaveBeenCalledTimes(2);
});

it("retains paged navigation on desktop", async () => {
  mocks.mobile = false;
  render(<StudentTestsSection />); await screen.findByRole("button", { name: "Тест 1" });
  expect(screen.queryByText("Тест 6")).toBeNull();
  fireEvent.click(screen.getAllByRole("button", { name: "Следующая страница" })[0]);
  await screen.findByRole("button", { name: "Тест 6" });
  expect(screen.queryByText("Тест 1")).toBeNull();
  expect(mocks.catalog.mock.calls.map(call => call[0])).toEqual([1, 2]);
});

it("refreshes the overview and all-tests feeds with the same filters after a top pull", async () => {
  render(<StudentTestsSection/>); await screen.findByText("Тест 1");
  const pull = () => {
    const list = screen.getByRole("region", { name: "Лента тестов" });
    fireEvent.touchStart(list, { touches: [{ clientX: 20, clientY: 20 }] });
    fireEvent.touchMove(list, { touches: [{ clientX: 20, clientY: 160 }], cancelable: true });
    fireEvent.touchEnd(list);
  };
  pull(); await waitFor(() => expect(mocks.catalog).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole("button", { name: "Все тесты" }));
  await waitFor(() => expect(mocks.all).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByLabelText("Загрузка тестов")).toBeNull());
  pull(); await waitFor(() => expect(mocks.all).toHaveBeenCalledTimes(2));
  expect(mocks.all.mock.lastCall?.slice(0, 3)).toEqual(["Все направления", 1, 6]);
});


it("opens the desktop available list first, with separate all-test filters and no permanent detail pane",async()=>{
 mocks.desktop=true;mocks.mobile=false;render(<StudentTestsSection/>);await screen.findByText("Тест 1");
 expect(mocks.catalog.mock.calls[0].slice(0,2)).toEqual([1,12]);expect(mocks.all).not.toHaveBeenCalled();
 expect(screen.getByRole("button",{name:"Доступные"}).getAttribute("aria-current")).toBe("page");expect(screen.queryByRole("searchbox")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Тест 1"}));expect(screen.getByRole("button",{name:"К списку тестов"})).toBeTruthy();expect(screen.queryByRole("dialog")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"К списку тестов"}));fireEvent.click(screen.getByRole("button",{name:"Все тесты"}));
 await screen.findByRole("searchbox",{name:"Найти тест"});await waitFor(()=>expect(mocks.all).toHaveBeenCalled());
 fireEvent.change(screen.getByRole("combobox",{name:"Статус теста"}),{target:{value:"completed"}});await waitFor(()=>expect(mocks.all.mock.calls.at(-1)?.[3]).toMatchObject({status:"completed"}));
});
