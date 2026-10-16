// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps, ReactNode } from "react";
import { StudentSettingsSection } from "@/components/student/navigation/student-settings-section";
import { StudentMenuSection } from "@/components/student/navigation/student-menu-section";
import { getDefaultSection, isValidSection } from "@/lib/navigation";
import { StudentCabinetLayout } from "./student-cabinet-layout";
import { CabinetContext } from "./cabinet-context";
const mocks = vi.hoisted(() => ({
  logout: vi.fn(), replace: vi.fn(), toggleTheme: vi.fn(), request: vi.fn(), exclusive: vi.fn(), reset: vi.fn(), announce: vi.fn(),
  pathname: "/cabinet/student/menu", immersive: false, theme: "dark",
  user: { id: 7, account_id: 70, organization_id: 1, division_id: 11, role: "student", full_name: "Демо ученик", organizations: [{ id: 1, name: "Демо организация", divisions: [{ id: 11, name: "Первая группа" }, { id: 12, name: "Вторая группа" }] }] },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.user, logout: mocks.logout }) }));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ theme: mocks.theme, toggleTheme: mocks.toggleTheme }) }));
vi.mock("@/contexts/cabinet-chrome-context", () => ({ useCabinetChrome: () => ({ immersive: mocks.immersive }) }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname, useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("next/image", () => ({ default: () => <span aria-label="CPM" /> }));
vi.mock("next/link", () => ({ default: ({ children, onNavigate, ...props }: ComponentProps<"a"> & { onNavigate?: () => void; children?: ReactNode }) => <a {...props} onClick={event => { event.preventDefault(); props.onClick?.(event); onNavigate?.(); }}>{children}</a> }));
vi.mock("@/lib/config", () => ({ BFF_DEV: true }));
vi.mock("@/lib/bff/client", () => ({ bffRequest: mocks.request, exclusiveContext: mocks.exclusive, resetRequests: mocks.reset, announceSession: mocks.announce }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn() })));
  vi.clearAllMocks(); mocks.pathname = "/cabinet/student/menu"; mocks.immersive = false; mocks.theme = "dark";
  mocks.logout.mockResolvedValue(undefined);
  mocks.exclusive.mockImplementation((run: () => Promise<unknown>) => run());
  mocks.request.mockRejectedValue(new Error("Кабинет недоступен"));
  HTMLDialogElement.prototype.showModal = function () { this.open = true; this.querySelector<HTMLButtonElement>("button")?.focus(); };
  HTMLDialogElement.prototype.close = function () { if (this.open) { this.open = false; this.dispatchEvent(new Event("close")); } };
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const renderShell = () => render(<StudentCabinetLayout><h1>Содержимое страницы</h1></StudentCabinetLayout>);


it("shows first-name profile and settings entry points with precisely five bottom destinations", () => {
  renderShell();
  expect(screen.getByRole("link", { name: "Профиль: Демо" }).getAttribute("href")).toBe("/cabinet/student/profile");
  expect(screen.queryByText("Демо ученик")).toBeNull();
  expect(screen.getByRole("link", { name: "Открыть настройки" }).getAttribute("href")).toBe("/cabinet/student/settings");
  const nav = screen.getByRole("navigation", { name: "Основная навигация ученика" });
  expect(within(nav).getAllByRole("link").map(link => link.textContent)).toEqual(["Домашние задания", "Тесты", "Экзамены", "Посещаемость", "Меню"]);
  expect(within(nav).getByRole("link", { name: "Меню" }).getAttribute("aria-current")).toBe("page");
  expect(screen.queryByRole("button", { name: "Открыть меню" })).toBeNull();
});

it("moves the active pill by route and keeps profile, settings and legacy profile inside the menu tab", () => {
  const page = renderShell();
  for (const [section, index] of [["tests", "1"], ["attendance", "3"], ["profile", "4"], ["settings", "4"], ["performance", "4"]]) {
    mocks.pathname = `/cabinet/student/${section}`;
    page.rerender(<StudentCabinetLayout><p>Раздел</p></StudentCabinetLayout>);
    expect(screen.getByRole("navigation").style.getPropertyValue("--active-tab")).toBe(index);
    expect(screen.getAllByRole("link").filter(link => link.getAttribute("aria-current") === "page")).toHaveLength(1);
  }
});

it("renders seven custom vector services without a separate about-me menu item", () => {
  render(<StudentMenuSection/>);
  const links = within(screen.getByRole("group", { name: "Разделы" })).getAllByRole("link");
  expect(links.map(link => link.textContent)).toEqual(["Домашние задания", "Тесты", "Экзамены", "Посещаемость", "Карточки", "Расписание", "Запрос на отгул"]);
  expect(screen.getByRole("group", { name: "Разделы" }).querySelectorAll("svg")).toHaveLength(7);
  const ids = [...document.querySelectorAll("[id]")].map(element => element.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(screen.queryByText("Обо мне")).toBeNull();
});

it("keeps the first-name profile header across primary tabs and links the Telegram promo", () => {
  const page = renderShell();
  for (const section of ["homework", "tests", "exams", "attendance"]) {
    mocks.pathname = `/cabinet/student/${section}`;
    page.rerender(<StudentCabinetLayout><p>Раздел</p></StudentCabinetLayout>);
    expect(screen.getByRole("link", { name: "Профиль: Демо" }).getAttribute("href")).toBe("/cabinet/student/profile");
  }
  page.unmount(); render(<StudentMenuSection/>);
  const telegram = screen.getByRole("link", { name: /Наша группа в Telegram/ });
  expect(telegram.getAttribute("href")).toBe("https://t.me/+iqniqzLnqK01YThi");
  expect(telegram.getAttribute("rel")).toBe("noopener noreferrer");
});

it("opens QR and cabinet quick actions in accessible dialogs without changing the session", () => {
  render(<StudentMenuSection/>);
  const actions = within(screen.getByRole("group", { name: "Быстрые действия" }));
  expect(actions.getByRole("link", { name: /Доступные/ }).getAttribute("href")).toBe("/cabinet/student/tests");
  expect(actions.getByRole("link", { name: /Запросить/ }).getAttribute("href")).toBe("/cabinet/student/zaps?create=1");
  fireEvent.click(actions.getByRole("button", { name: /Показать/ }));
  expect(screen.getByRole("dialog", { name: "Мой QR-код" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Закрыть окно" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.body.style.overflow).not.toBe("hidden");
  fireEvent.click(actions.getByRole("button", { name: /Сменить/ }));
  expect(screen.getByRole("dialog", { name: "Сменить кабинет" })).toBeTruthy();
  expect(screen.getByRole("group", { name: "Доступные кабинеты" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Первая группа" }));
  expect(mocks.request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Закрыть окно" }));
  expect(screen.getByRole("button", { name: /Баннер 1 из 3/ }).getAttribute("aria-current")).toBe("true");
});

it("hides student chrome in immersive test and card views", () => {
  mocks.immersive = true; renderShell();
  expect(screen.queryByRole("navigation")).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.getByRole("heading", { name: "Содержимое страницы" })).toBeTruthy();
});

it("keeps list geometry underneath fixed test overlays while hiding the header and dock", () => {
  mocks.immersive = true; mocks.pathname = "/cabinet/student/tests";
  const page = renderShell();
  expect(screen.queryByRole("navigation")).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
  expect(page.container.querySelector(".cabinet-layout")?.getAttribute("data-immersive")).toBe("false");
  expect(page.container.querySelector("header")?.getAttribute("aria-hidden")).toBe("true");
});

it("adds profile and settings routes only for students", () => {
  for (const section of ["menu", "profile", "settings", "performance"]) expect(isValidSection("student", section)).toBe(true);
  for (const role of ["admin", "proctor", "examinator", "supervisor", "staff_admin"] as const) expect(isValidSection(role, "profile")).toBe(false);
});

it("changes theme through the existing context and exposes the current switch state", () => {
  const page = render(<StudentSettingsSection/>);
  expect(screen.getByRole("switch", { name: "Тёмная тема" }).getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getByRole("switch", { name: "Тёмная тема" }));
  expect(mocks.toggleTheme).toHaveBeenCalledOnce();
  mocks.theme = "light"; page.rerender(<StudentSettingsSection/>);
  expect(screen.getByRole("switch", { name: "Тёмная тема" }).getAttribute("aria-checked")).toBe("false");
});

it("asks before logout and leaves the session intact on cancel", () => {
  render(<StudentSettingsSection/>);
  fireEvent.click(screen.getByRole("button", { name: "Выйти из кабинета" }));
  expect(screen.getByRole("dialog", { name: "Выйти из кабинета?" })).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Остаться" }));
  expect(mocks.logout).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Остаться" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.body.style.overflow).not.toBe("hidden");
  expect(mocks.logout).not.toHaveBeenCalled();
});

it("executes a confirmed logout once and disables repeats while in flight", async () => {
  let resolve!: () => void;
  mocks.logout.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  render(<StudentSettingsSection/>); fireEvent.click(screen.getByRole("button", { name: "Выйти из кабинета" }));
  fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
  expect(screen.getByRole("button", { name: "Выходим…" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Остаться" })).toHaveProperty("disabled", true);
  expect(mocks.logout).toHaveBeenCalledOnce();
  expect(mocks.replace).not.toHaveBeenCalled();
  await act(async () => resolve());
  expect(mocks.replace).toHaveBeenCalledWith("/login");
});

it("shows logout failures in the confirmation without navigating away", async () => {
  mocks.logout.mockRejectedValueOnce(new Error("Закройте редактор"));
  render(<StudentSettingsSection/>); fireEvent.click(screen.getByRole("button", { name: "Выйти из кабинета" }));
  fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Закройте редактор");
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Выйти" })).toHaveProperty("disabled", false);
});

it("uses the existing exclusive context guard and exact org/division request from the custom chooser", async () => {
  render(<CabinetContext variant="menu" />); fireEvent.click(screen.getByRole("button", { name: "Переключить кабинет и подразделение" }));
  expect(screen.getByRole("button", { name: "Первая группа" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Вторая группа" }));
  await screen.findByRole("alert");
  expect(mocks.exclusive).toHaveBeenCalledOnce(); expect(mocks.reset).toHaveBeenCalledOnce();
  expect(mocks.request).toHaveBeenCalledWith("/auth/context", { method: "POST", body: '{"organization_id":1,"division_id":12}' });
  expect(mocks.announce).not.toHaveBeenCalled();
});

it("does not request a context change when edits prevent obtaining the exclusive lock", async () => {
  mocks.exclusive.mockRejectedValueOnce(new Error("Закройте редактор"));
  render(<CabinetContext variant="menu" />); fireEvent.click(screen.getByRole("button", { name: "Переключить кабинет и подразделение" }));
  fireEvent.click(screen.getByRole("button", { name: "Вторая группа" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Закройте редактор");
  expect(mocks.request).not.toHaveBeenCalled();
});

it("does not change the context when selecting the current cabinet", () => {
  render(<CabinetContext variant="menu" />);
  fireEvent.click(screen.getByRole("button", { name: "Переключить кабинет и подразделение" }));
  fireEvent.click(screen.getByRole("button", { name: "Первая группа" }));
  expect(mocks.request).not.toHaveBeenCalled(); expect(screen.queryByRole("group")).toBeNull();
});

it("retains the existing native chooser for other cabinets", async () => {
  render(<CabinetContext />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "1:12" } });
  await waitFor(() => expect(mocks.request).toHaveBeenCalledOnce());
});


it("starts the student cabinet in the menu and welcomes the student above the services", () => {
  expect(getDefaultSection("student")).toBe("menu");
  render(<StudentMenuSection/>);
  const welcome=screen.getByRole("heading", {name:/Добро пожаловать/});
  expect(welcome.textContent).toContain("CPM LMS");
  expect(welcome.compareDocumentPosition(screen.getByRole("group",{name:"Разделы"})) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("rotates banners every four seconds, wraps and pauses inside a popup", () => {
  vi.useFakeTimers();render(<StudentMenuSection/>);
  const carousel=screen.getByRole("region",{name:"Новости CPM"});
  Array.from(carousel.children).forEach((card,index)=>Object.defineProperty(card,"offsetLeft",{value:index*300}));
  const scroll=vi.fn(({left}:{left:number})=>{carousel.scrollLeft=left;fireEvent.scroll(carousel);});
  Object.defineProperty(carousel,"scrollTo",{value:scroll});
  act(()=>vi.advanceTimersByTime(3999));expect(scroll).not.toHaveBeenCalled();
  act(()=>vi.advanceTimersByTime(1));expect(scroll).toHaveBeenLastCalledWith({left:300,behavior:"smooth"});
  act(()=>vi.advanceTimersByTime(4000));expect(scroll).toHaveBeenLastCalledWith({left:600,behavior:"smooth"});
  act(()=>vi.advanceTimersByTime(4000));expect(scroll).toHaveBeenLastCalledWith({left:0,behavior:"smooth"});
  fireEvent.click(screen.getByRole("button",{name:/Показать/}));
  act(()=>vi.advanceTimersByTime(8000));expect(scroll).toHaveBeenCalledTimes(3);
});

it("pins the desktop sidebar only on the menu and expands other pages on hover or keyboard focus", () => {
  vi.stubGlobal("matchMedia", (query:string) => ({matches:query.includes("min-width"),addEventListener:vi.fn(),removeEventListener:vi.fn()}));
  const view=renderShell();
  const sidebar=screen.getByRole("complementary",{name:"Боковая панель ученика"});
  expect(screen.getAllByRole("link",{name:"Профиль: Демо"})).toHaveLength(1);
  expect(within(sidebar).getByRole("link",{name:"Профиль: Демо"}).textContent).toBe("ДемоСтудент");
  expect(screen.queryByText("CPM LMS — главная")).toBeNull();
  expect(screen.queryByRole("heading",{name:"Меню"})).toBeNull();
  expect(sidebar.getAttribute("data-expanded")).toBe("true");
  expect(within(sidebar).getByRole("link",{name:"Главная"}).getAttribute("aria-current")).toBe("page");
  expect(screen.queryByRole("navigation",{name:"Основная навигация ученика"})).toBeNull();
  mocks.pathname="/cabinet/student/tests";
  view.rerender(<StudentCabinetLayout><p>Тесты</p></StudentCabinetLayout>);
  expect(sidebar.getAttribute("data-expanded")).toBe("false");
  expect(within(sidebar).getByRole("link",{name:"Тесты"}).getAttribute("aria-current")).toBe("page");
  fireEvent.mouseEnter(sidebar);expect(sidebar.getAttribute("data-expanded")).toBe("true");
  fireEvent.mouseLeave(sidebar);expect(sidebar.getAttribute("data-expanded")).toBe("false");
  act(()=>within(sidebar).getByRole("link",{name:"Тесты"}).focus());
  expect(sidebar.getAttribute("data-expanded")).toBe("true");
  act(()=>screen.getByRole("link",{name:"Открыть настройки"}).focus());
  expect(sidebar.getAttribute("data-expanded")).toBe("false");
});

it("removes the desktop sidebar when shrinking to mobile and restores all five dock links", () => {
  let desktop=true;let change=()=>{};
  vi.stubGlobal("matchMedia", (query:string) => ({get matches(){return query.includes("min-width")&&desktop;},addEventListener:(_type:string,listener:()=>void)=>{change=listener;},removeEventListener:vi.fn()}));
  renderShell();expect(screen.getByRole("complementary")).toBeTruthy();
  desktop=false;act(()=>change());
  expect(screen.queryByRole("complementary")).toBeNull();
  expect(within(screen.getByRole("navigation",{name:"Основная навигация ученика"})).getAllByRole("link")).toHaveLength(5);
});

it.each([
  ["homework","Домашние задания","homework-panorama-v2.webp"],
  ["tests","Тесты","tests-panorama-v2.webp"],
  ["exams","Экзамены","exams-panorama-v2.webp"],
  ["attendance","Посещаемость","attendance-panorama-v2.webp"],
  ["train","Карточки","train-panorama-v2.webp"],
])("moves the desktop %s title into its illustrated header",(section,title,image)=>{
  vi.stubGlobal("matchMedia",()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
  mocks.pathname=`/cabinet/student/${section}`;
  render(<StudentCabinetLayout><p>Содержимое</p></StudentCabinetLayout>);
  const heading=screen.getByRole("heading",{name:title});
  expect(heading.parentElement?.style.getPropertyValue("--section-art")).toBe(`url("/arts/desktop/${image}")`);
  expect(screen.getAllByRole("heading",{name:title})).toHaveLength(1);
});

it.each(["/cabinet/student/train/manual/42","/cabinet/student/train/test/abc"])("hides the desktop cards banner inside %s",pathname=>{
 vi.stubGlobal("matchMedia",()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}));mocks.pathname=pathname;
 render(<StudentCabinetLayout><h1>Название раздела</h1></StudentCabinetLayout>);
 expect(screen.queryByRole("heading",{name:"Карточки"})).toBeNull();
 expect(document.querySelector('header')?.style.getPropertyValue("--section-art")).toBe("");
 expect(screen.getByRole("heading",{name:"Название раздела"})).toBeTruthy();
});
