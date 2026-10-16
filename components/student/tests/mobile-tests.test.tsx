// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { useState } from "react";
import { useTestViewport } from "./use-test-viewport";
import { QuestionPagination } from "./question-pagination";
import { TestReviewScreen } from "./review/test-review-screen";
import { OfficialTestAttemptScreen } from "./attempt/official-test-attempt-screen";
import { createV2Bundle, loadV2Bundle, saveDraft, saveV2Bundle, commitDraft } from "@/lib/student/test-attempt-v2-store";
import type { TestAttempt } from "@/lib/student/test-attempt-types";
import type { TestSessionReview } from "@/lib/student/test-review-types";

const mocks = vi.hoisted(() => ({ review: vi.fn(), fetchAttempt: vi.fn(), schedule: vi.fn() }));
vi.mock("@/lib/config", () => ({ BFF_DEV: false }));
vi.mock("@/lib/student/test-review-api", () => ({ fetchTestSessionReview: mocks.review, getReviewErrorMessage: (message: string) => message }));
vi.mock("@/lib/student/test-attempt-api", () => ({ fetchTestAttempt: mocks.fetchAttempt, startTestAttempt: vi.fn(), getAttemptErrorMessage: (message: string) => message }));
vi.mock("@/lib/student/test-attempt-v2-sync", () => ({ cancelScheduledOfficialSync: vi.fn(), scheduleOfficialSync: mocks.schedule, syncOfficialNow: vi.fn() }));
vi.mock("@/lib/student/test-attempt-v2-events", () => ({ announceAttemptChange: vi.fn(), subscribeAttemptChanges: () => () => {} }));
vi.mock("@/lib/student/test-attempt-v2-upload-scheduler", () => ({ createOfficialUploadScheduler: () => ({ update: vi.fn(), dispose: vi.fn() }) }));
vi.mock("@/lib/student/test-attempt-v2-upload", () => ({ uploadOfficialSnapshot: vi.fn() }));
vi.mock("@/lib/bff/use-context-guard", () => ({ useContextGuard: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("phone keyboard viewport", () => {
  it("keeps the field in the scroller as the keyboard resizes/pans the viewport and cleans up", async () => {
    const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0 });
    vi.stubGlobal("visualViewport", viewport);
    document.body.style.overflow = "auto";
    function Harness() { const ref = useTestViewport(); return <div ref={ref} data-testid="overlay"><main data-test-scroll><textarea aria-label="Ответ" /></main></div>; }
    const mounted = render(<Harness />);
    const field = screen.getByRole("textbox");
    const scroller = field.parentElement!;
    field.getBoundingClientRect = () => ({ top: 380, bottom: 490, height: 110 } as DOMRect);
    scroller.getBoundingClientRect = () => ({ top: 100, bottom: 350, height: 250 } as DOMRect);
    field.focus();
    act(() => { viewport.height = 430; viewport.offsetTop = 36; viewport.dispatchEvent(new Event("resize")); });
    expect(screen.getByTestId("overlay").style.height).toBe("430px");
    expect(screen.getByTestId("overlay").style.top).toBe("36px");
    await waitFor(() => expect(scroller.scrollTop).toBe(152));
    act(() => { viewport.height = 844; viewport.offsetTop = 0; viewport.dispatchEvent(new Event("scroll")); });
    expect(screen.getByTestId("overlay").style.height).toBe("844px");
    mounted.unmount();
    expect(document.body.style.overflow).toBe("auto");
  });
});

describe("question pages", () => {
  it("marks the active question, keeps future official questions locked and allows available jumps", () => {
    const select = vi.fn();
    function Harness() { const [index, setIndex] = useState(1); return <QuestionPagination pages={[{ id: 1, status: "answered" }, { id: 2, status: "empty" }, { id: 3, status: "empty", disabled: true }]} currentIndex={index} summary="Зафиксировано 1 из 3" onSelect={next => { select(next); setIndex(next); }} />; }
    render(<Harness />); fireEvent.click(screen.getByRole("button", { name: "Все вопросы" }));
    expect(screen.getByRole("button", { name: "Вопрос 3. Пока недоступен" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Вопрос 2. Без ответа" }).getAttribute("aria-current")).toBe("step");
    fireEvent.click(screen.getByRole("button", { name: "Вопрос 1. Ответ зафиксирован" }));
    expect(select).toHaveBeenCalledWith(0);
  });

  it("renders one review question at a time and never exposes hidden correct answers", async () => {
    const review: TestSessionReview = { sessionId: "review", testId: "test", questionOrder: [1, 2], visible: true, showCorrectAnswers: false, items: [1, 2].map(id => ({ questionId: id, question: { questionId: id, type: "text", text: `Условие ${id}` }, studentAnswer: { questionId: id, type: "text", textAnswer: `Мой ответ ${id}` }, isCorrect: false, points: 0, correct: { correctAnswers: ["Скрытый ответ"] } })) };
    mocks.review.mockResolvedValue({ success: true, review });
    const exit = vi.fn(); render(<TestReviewScreen sessionId="review" testTitle="Тест" onExit={exit} />);
    expect(await screen.findByText("Условие 1")).toBeTruthy();
    expect(screen.queryByText("Условие 2")).toBeNull();
    expect(screen.queryByText("Скрытый ответ")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.getByText("Условие 2")).toBeTruthy();
    expect(screen.queryByText("Условие 1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Назад" }));
    expect(screen.getByText("Мой ответ 1")).toBeTruthy();
    expect(exit).not.toHaveBeenCalled();
  });
});

it("retains the latest typed draft across back/forward navigation without changing the locked official answer", async () => {
  const now = Date.now();
  const attempt = { attemptId: "mobile-attempt", testId: "test", testVersionId: "version", schemaVersion: 2, status: "in_progress", remainingSeconds: 1800, timeExpired: false, answeredCount: 0, totalQuestions: 3, serverNowEpochMs: now, answerDeadlineEpochMs: now + 1800000, uploadDeadlineEpochMs: now + 3600000, answers: [], questionOrder: [1, 2, 3], questions: [{ questionId: 1, type: "single", locked: false, text: "Первый вопрос", answers: [{ id: "a", text: "Первый ответ" }] }, { questionId: 2, type: "text", locked: false, text: "Второй вопрос" }, { questionId: 3, type: "text", locked: false, text: "Третий вопрос" }] } as TestAttempt;
  await saveV2Bundle(createV2Bundle(attempt, "Тест"));
  await saveDraft(attempt.attemptId, 1, { type: "single", selectedAnswer: "a" });
  await commitDraft(attempt.attemptId, 1, 2);
  render(<OfficialTestAttemptScreen testId="test" testTitle="Тест" resumeAttemptId={attempt.attemptId} onExit={vi.fn()} onCompleted={vi.fn()} />);
  const input = await screen.findByRole("textbox", { name: "Ваш ответ" });
  expect(screen.queryByRole("heading", { name: "Тест" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Состояние сохранения" })).toBeNull();
  expect(screen.queryByText(/Зафиксировано 1 из 3/)).toBeNull();
  expect(screen.getByLabelText("Осталось времени")).toBeTruthy();
  fireEvent.change(input, { target: { value: "Черновик перед немедленным переходом" } });
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  const locked = await screen.findByRole("button", { name: "Первый ответ" });
  expect(locked).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("button", { name: "Далее" }));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Ваш ответ" })).toHaveProperty("value", "Черновик перед немедленным переходом"));
  const stored = await loadV2Bundle(attempt.attemptId);
  expect(stored?.committedByQuestion[1].selectedAnswer).toBe("a");
  expect(stored?.committedByQuestion[2]).toBeUndefined();
  expect(mocks.schedule).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Завершить тест" }));
  expect(await screen.findByText(/Будет зафиксировано ответов: 2 из 3. Пропущено: 1/)).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Отмена" }));
  fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
  expect(screen.getByRole("textbox", { name: "Ваш ответ" })).toHaveProperty("value", "Черновик перед немедленным переходом");
  const nextButton = screen.getByRole("button", { name: "Далее" });
  fireEvent.click(nextButton); fireEvent.click(nextButton);
  expect(await screen.findByRole("heading", { name: "Третий вопрос" })).toBeTruthy();
  const committed = await loadV2Bundle(attempt.attemptId);
  expect(Object.keys(committed!.committedByQuestion)).toHaveLength(2);
  expect(committed?.committedByQuestion[2].textAnswer).toBe("Черновик перед немедленным переходом");
  expect(committed?.committedByQuestion[2].sequence).toBe(2);
  expect(screen.getByRole("textbox", { name: "Ваш ответ" })).toHaveProperty("value", "");
  expect(mocks.schedule).toHaveBeenCalledTimes(1);
});
