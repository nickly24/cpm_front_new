// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import { conductAttempt } from "@/lib/bff/exams-conduct";
import type { AttemptState } from "@/lib/exams-v2/types";
const { get, mutate } = vi.hoisted(() => ({ get: vi.fn(), mutate: vi.fn() }));
vi.mock("@/lib/config", () => ({ BFF_DEV: true }));
vi.mock("@/lib/bff/use-context-guard", () => ({ useContextGuard: () => {} }));
vi.mock("@/lib/exams-v2/api", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/exams-v2/api")>(), examGet: get, examMutate: mutate }));
vi.mock("@/lib/exams-v2/use-attempt-sync", () => ({ useAttemptSync: () => ({ error: null, checkedAt: null }) }));
import { AttemptWorkspace } from "./examiner";
const makeAttempt = (extra = {}) => conductAttempt({ id: 20, exam_id: 10, exam_name: "Экзамен по праву", assignment_id: 15, state_version: 1, ov_status: null, ov_revision: 0, status: "pending_ready", phase: "preparation", student: { account_id: 100, full_name: "Анна Примерова" }, members: [{ account_id: 300, full_name: "Экзаменатор", ready: false }], permissions: { can_ready: true, can_edit_ov: true }, ...extra });
const result = (attempt: AttemptState, outcome: string) => ({ attempt, receipt: { outcome, commandId: 1 }, replayed: false });
beforeEach(() => { get.mockReset(); mutate.mockReset(); sessionStorage.clear(); });
afterEach(cleanup);

describe("examiner workspace interactions", () => {
  it("conducts preparation, start, OV update and confirmed vote without refetching exam detail", async () => {
    get.mockResolvedValue({ attempt: makeAttempt() });
    const ready = makeAttempt({ state_version: 2, all_members_ready: true, permissions: { can_start: true, can_edit_ov: true } });
    const started = makeAttempt({ state_version: 3, status: "in_progress", phase: "regular_questions", permissions: { can_vote: true, can_edit_ov: true }, current_question: { id: 30, sequence_no: 1, part_code: "A", question_text: "Первый вопрос", answer_text: "Эталон", status: "open", round: { id: 40, round_no: 1, votes_count: 0, required_votes: 1, status: "open" } } });
    mutate.mockResolvedValueOnce(result(ready, "ready")).mockResolvedValueOnce(result(started, "started")).mockResolvedValueOnce(result({ ...started, ovStatus: "accepted", ovRevision: 1 }, "ov_updated")).mockResolvedValueOnce(result({ ...started, stateVersion: 4, ovStatus: "accepted", ovRevision: 1, status: "completed", currentQuestion: null, result: { attemptId: 20, attemptNo: 1, grade: 5, rawTotal: 5, roundedTotal: 5, maxScore: 5, hasAppeal: false, completedAt: "2026-11-13T09:00:00Z" } }, "completed"));
    render(<AttemptWorkspace examId={10} attemptId={20} actor="examinator:300" enabled back={vi.fn()} />);
    await screen.findByText("Анна Примерова");
    fireEvent.click(screen.getByRole("button", { name: "Я готов принимать экзамен" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Начать экзамен" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Начать экзамен" }));
    await screen.findByText("Первый вопрос");
    fireEvent.change(screen.getByLabelText("Статус OV"), { target: { value: "accepted" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить OV" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Сохранить OV" }) as HTMLButtonElement).disabled).toBe(true));
    expect(mutate.mock.calls[2][0]).toMatchObject({ path: "/api/examiner/exams/10/attempts/20/ov", body: { expectedOvRevision: 0, ovStatus: "accepted", ovComment: null } });
    fireEvent.click(screen.getByRole("button", { name: "1 · Полностью" }));
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить" }));
    await screen.findByRole("heading", { name: "Экзамен завершён" });
    expect(mutate.mock.calls[3][0]).toMatchObject({ body: { presentedQuestionId: 30, roundId: 40, value: 1 } });
    expect(get).toHaveBeenCalledTimes(1);
  });
  it("blocks new commands after an unknown OV outcome and retries the same UUID", async () => {
    get.mockResolvedValue({ attempt: makeAttempt() });
    mutate.mockRejectedValueOnce(new ApiError("Timeout", 503)).mockResolvedValueOnce(result(makeAttempt({ ov_status: "missing", ov_revision: 1 }), "ov_updated"));
    render(<AttemptWorkspace examId={10} attemptId={20} actor="examinator:300" enabled back={vi.fn()} />);
    await screen.findByLabelText("Статус OV");
    fireEvent.change(screen.getByLabelText("Статус OV"), { target: { value: "missing" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить OV" }));
    await screen.findByText(/Ответ на предыдущую команду не получен/);
    expect((screen.getByRole("button", { name: "Я готов принимать экзамен" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Повторить тот же запрос" }));
    await waitFor(() => expect(screen.queryByText(/Ответ на предыдущую команду не получен/)).toBeNull());
    expect(mutate.mock.calls[0][0]).toEqual(mutate.mock.calls[1][0]);
  });
});
