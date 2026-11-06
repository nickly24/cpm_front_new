// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ExamTrainingLocation } from "@/lib/training/training-routes";
import type { SectionStudyViewResponse } from "@/lib/training/training-types";
const api = vi.hoisted(() => ({ read: vi.fn(), mark: vi.fn(), unmark: vi.fn(), settings: vi.fn() }));
vi.mock("@/lib/bff/use-context-guard", () => ({ useContextGuard: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({}), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/training/training-api", () => ({ fetchExamTrainingSelection: api.read, markCardLearned: api.mark, unmarkCardLearned: api.unmark, updateSectionStudySettings: api.settings }));
vi.mock("./training-flashcards", () => ({ TrainingFlashcards: ({ previewCards }: { previewCards?: unknown[] }) => <p>Учебный набор: {previewCards?.length ?? "сервер"}</p> }));
import { ExamTraining } from "./exam-training";
const location: ExamTrainingLocation = { examId: 31, partId: 3, area: true, study: false, batch: 0, mode: "unlearned" };
const props = { studentId: 91, location, navigate: vi.fn(), onBack: vi.fn() };
function fixture(page = 1): SectionStudyViewResponse {
  const stats = { total: 5000, learned: 2000, unlearned: 2900, answer_changed: 100, progress_percent: 40 };
  return { success: true, student_id: 91, section_kind: "exam", section_ref_id: "31:3", section_name: "Часть А", part_id: 3, settings: { batch_size: 10, last_batch_index: 0, last_part_id: 3, study_mode: "unlearned" }, stats,
    cards: Array.from({ length: 20 }, (_, index) => ({ card_ref: `exam:31:${(page - 1) * 20 + index + 1}`, question: `Вопрос ${(page - 1) * 20 + index + 1}`, answer: "Ответ", status: "unlearned", part_id: 3, part_code: "А", content_fingerprint: "v1" })),
    parts: [{ kind: "exam", refId: "31:3", name: "Часть А", part_id: 3, total_cards: 5000, learned_cards: 2000, progress_percent: 40, stats }],
    batches: [{ index: 0, from: 1, to: 10, size: 10, stats: { total: 10, learned: 6, unlearned: 3, answer_changed: 1 } }] };
}
beforeEach(() => {
  vi.clearAllMocks(); api.read.mockImplementation(async (_student, _ref, selection) => ({ ...fixture(selection.page), cards: selection.summary ? [] : fixture(selection.page).cards }));
  api.mark.mockResolvedValue({ success: true }); api.settings.mockImplementation(async (_student, _kind, _ref, settings) => ({ success: true, settings }));
});
afterEach(cleanup);
it("loads a summary without cards on the exam landing page", async () => {
  render(<ExamTraining {...props} location={{ ...location, area: false, partId: null }} />);
  await screen.findByRole("button", { name: "Продолжить" });
  expect(api.read).toHaveBeenCalledTimes(1); expect(api.read.mock.calls[0].slice(0, 4)).toEqual([91, "31", { summary: true }, false]);
  expect(screen.queryByText("Вопрос 1")).toBeNull(); expect(screen.getByRole("heading", { name: "Часть А", level: 2 })).toBeTruthy();
});
it("requests one page of 20 questions and keeps full progress and batch counts", async () => {
  render(<ExamTraining {...props} />); await screen.findByText("Вопрос 1");
  expect(api.read.mock.calls[0].slice(0, 4)).toEqual([91, "31:3", { page: 1, limit: 20 }, false]);
  expect(screen.getByRole("button", { name: "Учить выбранный набор (4)" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Учить всю часть (3000)" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Далее" })); await screen.findByText("Вопрос 21");
  expect(screen.queryByText("Вопрос 1")).toBeNull(); expect(screen.getByText("Страница 2 из 250")).toBeTruthy();
  expect(api.read).toHaveBeenCalledTimes(2); expect(api.read.mock.calls[1][2]).toEqual({ page: 2, limit: 20 });
});
it("keeps the selected page and current fingerprint after a progress update", async () => {
  render(<ExamTraining {...props} />); await screen.findByText("Вопрос 1");
  fireEvent.click(screen.getByRole("button", { name: "Далее" })); await screen.findByText("Вопрос 21");
  fireEvent.click(screen.getAllByRole("button", { name: "Выучено" })[0]);
  await waitFor(() => expect(api.read).toHaveBeenCalledTimes(3));
  expect(api.mark).toHaveBeenCalledWith({ student_id: 91, section_kind: "exam", section_ref_id: "31:3", card_ref: "exam:31:21", content_fingerprint: "v1" });
  expect(api.read.mock.calls[2][2]).toEqual({ page: 2, limit: 20 }); expect(screen.getByText("Вопрос 21")).toBeTruthy();
});
it("does not download all cards when selecting all; loads them only on explicit study navigation", async () => {
  const view = render(<ExamTraining {...props} preview />); await screen.findByText("Вопрос 1");
  fireEvent.click(screen.getByRole("button", { name: "Учить всю часть (3000)" }));
  await waitFor(() => expect(props.navigate).toHaveBeenCalledWith({ area: true, partId: 3, study: true, batch: -1, mode: "unlearned" }));
  expect(api.read).toHaveBeenCalledTimes(1); expect(api.settings).not.toHaveBeenCalled();
  view.rerender(<ExamTraining {...props} preview location={{ ...location, study: true, batch: -1 }} />);
  await screen.findByText("Учебный набор: 20");
  expect(api.read.mock.calls[1][2]).toEqual({ batchSize: 10 });
});
it("uses a bounded preview batch and asks the server to recompute batch metadata after size changes", async () => {
  const view = render(<ExamTraining {...props} preview />); await screen.findByText("Вопрос 1");
  fireEvent.change(screen.getByRole("combobox", { name: "По сколько карточек учить" }), { target: { value: "20" } });
  await waitFor(() => expect(api.read).toHaveBeenCalledTimes(2)); expect(api.read.mock.calls[1][2]).toEqual({ page: 1, limit: 20, batchSize: 20 });
  view.rerender(<ExamTraining {...props} preview location={{ ...location, study: true, batch: 4 }} />); await screen.findByText("Учебный набор: 20");
  expect(api.read.mock.calls[2][2]).toEqual({ batchIndex: 4, batchSize: 20 }); expect(api.settings).not.toHaveBeenCalled();
});
it("discards an old part response and aborts it when switching parts", async () => {
  let finish!: (value: SectionStudyViewResponse) => void; api.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<ExamTraining {...props} />); await waitFor(() => expect(api.read).toHaveBeenCalledTimes(1));
  const oldSignal = api.read.mock.calls[0][4] as AbortSignal;
  api.read.mockResolvedValueOnce({ ...fixture(), section_name: "Часть Б", cards: [{ ...fixture().cards[0], question: "Другая часть" }] });
  view.rerender(<ExamTraining {...props} location={{ ...location, partId: 4 }} />); await screen.findByText("Другая часть");
  await act(async () => finish(fixture())); expect(oldSignal.aborted).toBe(true); expect(screen.queryByText("Вопрос 1")).toBeNull();
});
it("shows a retryable page failure without automatically reading other pages", async () => {
  api.read.mockRejectedValueOnce(new Error("Временно недоступно")); render(<ExamTraining {...props} />);
  await screen.findByRole("alert"); expect(api.read).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" })); await screen.findByText("Вопрос 1"); expect(api.read).toHaveBeenCalledTimes(2);
});


it.each(["mark", "settings"])("blocks page changes until a pending %s and its refresh finish", async kind => {
  let finish!: (value: unknown) => void;
  if (kind === "mark") api.mark.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  else api.settings.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<ExamTraining {...props} />); await screen.findByText("Вопрос 1");
  fireEvent.click(screen.getByRole("button", { name: "Далее" })); await screen.findByText("Вопрос 21");
  if (kind === "mark") fireEvent.click(screen.getAllByRole("button", { name: "Выучено" })[0]);
  else fireEvent.change(screen.getByRole("combobox", { name: "По сколько карточек учить" }), { target: { value: "20" } });
  for (const name of ["Назад", "Далее", "Обновить", "← К частям экзамена"]) expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Далее" })); expect(api.read).toHaveBeenCalledTimes(2);
  let refreshed!: (value: SectionStudyViewResponse) => void; api.read.mockImplementationOnce(() => new Promise(resolve => { refreshed = resolve; }));
  await act(async () => finish({ success: true, settings: { ...fixture().settings, batch_size: 20 } }));
  await waitFor(() => expect(api.read).toHaveBeenCalledTimes(3)); expect(api.read.mock.calls[2][2]).toEqual({ page: 2, limit: 20 });
  expect((screen.getByRole("button", { name: "Далее" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => refreshed(fixture(2)));
  expect((screen.getByRole("button", { name: "Далее" }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Далее" })); await screen.findByText("Вопрос 41"); expect(screen.getByText("Страница 3 из 250")).toBeTruthy();
});
it.each(["mark", "settings"])("never reloads an obsolete part when an old %s completes after navigation", async kind => {
  let finish!: (value: unknown) => void;
  if (kind === "mark") api.mark.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  else api.settings.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<ExamTraining {...props} />); await screen.findByText("Вопрос 1");
  if (kind === "mark") fireEvent.click(screen.getAllByRole("button", { name: "Выучено" })[0]);
  else fireEvent.change(screen.getByRole("combobox", { name: "По сколько карточек учить" }), { target: { value: "20" } });
  api.read.mockResolvedValueOnce({ ...fixture(), section_name: "Часть Б", cards: [{ ...fixture().cards[0], question: "Другая часть" }] });
  view.rerender(<ExamTraining {...props} location={{ ...location, partId: 4 }} />); await screen.findByText("Другая часть");
  await act(async () => finish({ success: true, settings: { ...fixture().settings, batch_size: 20 } }));
  expect(api.read).toHaveBeenCalledTimes(2); expect(screen.getByText("Другая часть")).toBeTruthy();
  expect((screen.getByRole("combobox", { name: "По сколько карточек учить" }) as HTMLSelectElement).value).toBe("10");
  expect((screen.getByRole("button", { name: "Далее" }) as HTMLButtonElement).disabled).toBe(false);
});
