// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { HomeworkWorkspace } from "@/lib/homework-files/types";
const mocks = vi.hoisted(() => ({ workspace: vi.fn(), fileUrl: vi.fn(), submit: vi.fn(), enqueue: vi.fn(), cancel: vi.fn(), retry: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: 7 } }) }));
vi.mock("@/lib/bff/use-context-guard", () => ({ useContextGuard: vi.fn() }));
vi.mock("@/contexts/homework-upload-context", () => ({ useHomeworkUploads: () => ({ jobs: [], enqueue: mocks.enqueue, cancel: mocks.cancel, retry: mocks.retry }) }));
vi.mock("@/lib/homework-files/api", () => ({ homeworkFilesApi: { workspace: mocks.workspace, fileUrl: mocks.fileUrl, submit: mocks.submit }, homeworkErrorMessage: () => "Ошибка файла" }));
vi.mock("@/lib/homework-scanner/project-store", () => ({ deleteScannerProject: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./homework-pdf-viewer", () => ({ HomeworkPdfViewer: () => <section aria-label="Страницы PDF">Просмотр страниц</section> }));
vi.mock("./scanner-modal", () => ({ ScannerModal: ({ onClose }: { onClose: () => void }) => <div role="dialog" aria-label="Сканер"><button onClick={onClose}>Закрыть сканер</button></div> }));
import { HomeworkWorkspaceModal } from "./homework-workspace";
const file = { id: 20, filename: "Очень длинное имя настоящего файла.pdf", page_count: 2, size_bytes: 64000 };
function data(state: HomeworkWorkspace["submission"]["state"] = "graded"): HomeworkWorkspace {
  return { homework: { id: 11, name: "Конституционное право", deadline: "2026-10-20", published: true }, legacy_result: state === "graded" ? { id: 3, status: 1, result: 94, date_pass: null } : null,
    submission: { id: 1, state, has_draft: state === "draft", has_file: state === "graded", ...(state === "graded" ? { current_file: file } : state === "draft" ? { draft_file: file } : {}) },
    permissions: { upload: state === "none" || state === "draft", submit: state === "draft" }, limits: { max_source_bytes: 40000000, max_output_bytes: 20000000, max_pages: 50, dpi: 150, jpeg_quality: .8 } };
}
beforeEach(() => { vi.clearAllMocks(); mocks.workspace.mockResolvedValue(data()); mocks.fileUrl.mockResolvedValue({ url: "https://example.test/homework.pdf", expires_in: 300 }); mocks.submit.mockResolvedValue({}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("keeps a compact graded overview and opens the PDF in a separate screen with a return action", async () => {
  const close = vi.fn(); render(<HomeworkWorkspaceModal homeworkId={11} onClose={close}/>);
  await screen.findByRole("button", { name: "Открыть отправленную домашнюю работу" });
  expect(screen.getByText("94")).toBeTruthy();
  expect(screen.getByText("2 страницы · 63 КБ")).toBeTruthy();
  expect(screen.queryByText(file.filename)).toBeNull();
  expect(screen.queryByRole("button", { name: "Обновить работу" })).toBeNull();
  expect(screen.queryByText("Сейчас")).toBeNull();
  expect(screen.queryByText("Получить результат")).toBeNull();
  expect(screen.queryByRole("button", { name: "К заданиям" })).toBeNull();
  expect(screen.queryByLabelText("Страницы PDF")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Открыть отправленную домашнюю работу" }));
  const preview = screen.getByRole("dialog", { name: "Просмотр домашней работы" });
  expect(within(preview).getByRole("button", { name: "Скачать PDF" })).toBeTruthy();
  expect(within(preview).getByLabelText("Страницы PDF")).toBeTruthy();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  fireEvent.click(within(preview).getByRole("button", { name: "Скачать PDF" }));
  await waitFor(() => expect(mocks.fileUrl).toHaveBeenCalledWith(1, false, true));
  await waitFor(() => expect(within(preview).getByRole("button", { name: "Скачать PDF" })).toHaveProperty("disabled", false));
  fireEvent.click(within(preview).getByRole("button", { name: "Назад к заданию" }));
  expect(screen.getByRole("button", { name: "Открыть отправленную домашнюю работу" })).toBeTruthy();
  expect(close).not.toHaveBeenCalled(); expect(mocks.submit).not.toHaveBeenCalled();
});
it("shows a status legend only on request and leaves assignment navigation intact", async () => {
  const close = vi.fn(); render(<HomeworkWorkspaceModal homeworkId={11} onClose={close}/>);
  await screen.findByRole("button", { name: "Что означают статусы" });
  fireEvent.click(screen.getByRole("button", { name: "Что означают статусы" }));
  const legend = screen.getByRole("dialog", { name: "Статусы домашних заданий" });
  expect(within(legend).getByText("Доработка")).toBeTruthy();
  expect(within(legend).getByText("Черновик")).toBeTruthy();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Статусы домашних заданий" })).toBeNull();
  expect(close).not.toHaveBeenCalled();
});
it("opens attachment choices from the empty artwork and covers the assignment when scanning", async () => {
  mocks.workspace.mockResolvedValue(data("none")); render(<HomeworkWorkspaceModal homeworkId={11} onClose={vi.fn()}/>);
  fireEvent.click(await screen.findByRole("button", { name: /Добавить свою работу/ }));
  const choices = screen.getByRole("dialog", { name: "Добавить работу" });
  expect(within(choices).getByRole("button", { name: /Выбрать PDF/ })).toBeTruthy();
  const chooseFile = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
  fireEvent.click(within(choices).getByRole("button", { name: /Выбрать PDF/ }));
  expect(chooseFile).toHaveBeenCalledOnce();
  expect(document.querySelector('input[type="file"]')?.closest("[inert]")).toBeNull();
  expect(screen.queryByRole("dialog", { name: "Добавить работу" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Добавить свою работу/ }));
  const scanChoices = within(screen.getByRole("dialog", { name: "Добавить работу" }));
  fireEvent.click(scanChoices.getByRole("button", { name: /Сканировать/ }));
  expect(screen.getByRole("dialog", { name: "Сканер" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Конституционное право" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Закрыть сканер" }));
  expect(screen.getByRole("button", { name: /Добавить свою работу/ })).toBeTruthy();
  expect(mocks.enqueue).not.toHaveBeenCalled();
});
it("keeps the draft submission action and respects revoked upload permission", async () => {
  mocks.workspace.mockResolvedValue(data("draft")); const page = render(<HomeworkWorkspaceModal homeworkId={11} onClose={vi.fn()}/>);
  expect(await screen.findByRole("button", { name: /Отправить на проверку/ })).toHaveProperty("disabled", false);
  expect(screen.getByRole("button", { name: "Открыть черновик домашней работы" })).toBeTruthy();
  page.unmount();
  const denied = data("none"); denied.permissions.upload = false; mocks.workspace.mockResolvedValue(denied);
  render(<HomeworkWorkspaceModal homeworkId={11} onClose={vi.fn()}/>);
  await waitFor(() => expect(screen.getByRole("button", { name: /Добавить свою работу/ })).toHaveProperty("disabled", true));
  expect(screen.queryByRole("button", { name: /Отправить на проверку/ })).toBeNull();
});

it("does not present an attached PDF as missing when its link fails and allows a read-only retry", async () => {
  mocks.fileUrl.mockRejectedValueOnce(new Error("Ссылка недоступна"));
  render(<HomeworkWorkspaceModal homeworkId={11} onClose={vi.fn()}/>);
  await screen.findByText("Не удалось открыть файл.");
  expect(screen.queryByText("Работа проверена без прикреплённого PDF.")).toBeNull();
  expect(screen.queryByRole("button", { name: /Добавить свою работу/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
  await screen.findByRole("button", { name: "Открыть отправленную домашнюю работу" });
  expect(mocks.enqueue).not.toHaveBeenCalled();
});

it("renders the desktop assignment as a page without a dialog or body scroll lock",async()=>{
 const close=vi.fn();render(<HomeworkWorkspaceModal homeworkId={11} onClose={close} presentation="page"/>);
 await screen.findByRole("button",{name:"Открыть отправленную домашнюю работу"});
 expect(screen.queryByRole("dialog")).toBeNull();expect(screen.getByRole("region",{name:"Конституционное право"})).toBeTruthy();expect(document.body.style.overflow).not.toBe("hidden");
 fireEvent.keyDown(document,{key:"Escape"});expect(close).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"К домашним заданиям"}));expect(close).toHaveBeenCalledOnce();
});
