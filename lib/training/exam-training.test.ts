import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { examPeriod, filterStudyCards, studyBatches, trainingError, trainingStats } from "./exam-training";
import { examTrainingPath, parseExamTrainingPath, parseTrainingPath, trainingSectionPath } from "./training-routes";
import type { TrainingCard, TrainingDirection } from "./training-types";
import { getProgressLabel } from "./training-utils";

const cards: TrainingCard[] = Array.from({ length: 40 }, (_, index) => ({ card_ref: `exam:7:${index + 1}`, question: `Вопрос ${index + 1}`, answer: "Первая строка\n\nВторая строка", content_fingerprint: String(index), part_id: index < 10 ? 1 : 2, part_code: index < 10 ? "A" : "B", status: index < 20 ? "learned" : index < 25 ? "answer_changed" : "unlearned" }));

describe("exam training navigation and progress contracts", () => {
  it("addresses exams and parts by IDs independently of mutable names", () => {
    const path = trainingSectionPath("student", { name: "Математика" }, { kind: "exam", name: "Математика", refId: "7" });
    expect(path).toBe("/cabinet/student/train/exam/7");
    expect(examTrainingPath("student", 8)).not.toBe(path);
    expect(examTrainingPath("student", 7, { partId: 19, area: true, study: true, batch: -1, mode: "stale" })).toBe("/cabinet/student/train/exam/7/part/19/study?batch=-1&mode=stale");
    expect(parseExamTrainingPath(["exam", "7", "part", "19", "study"], new URLSearchParams("batch=-1&mode=stale"))).toEqual({ examId: 7, partId: 19, area: true, study: true, batch: -1, mode: "stale" });
  });
  it("rejects ambiguous or malformed exam URLs and normalizes unsupported modes", () => {
    for (const segments of [["exam", "0"], ["exam", "7", "unknown"], ["exam", "7", "part", "-2"], ["exam", "7", "all", "study", "extra"]]) expect(parseExamTrainingPath(segments, new URLSearchParams())).toBeNull();
    expect(parseExamTrainingPath(["exam", "7", "all", "study"], new URLSearchParams("batch=1.5&mode=bad"))).toMatchObject({ batch: 0, mode: "unlearned" });
  });
  it("keeps old manual/test name routes working", () => {
    const section = { kind: "manual", refId: "2", name: "Старый раздел" };
    const directions = [{ id: 1, name: "Математика", sections: [section] }] as TrainingDirection[];
    expect(trainingSectionPath("student", directions[0], section as never)).toBe(`/cabinet/student/train/${encodeURIComponent("Математика")}/${encodeURIComponent("Старый раздел")}`);
    expect(parseTrainingPath([encodeURIComponent("Математика"), encodeURIComponent("Старый раздел"), "study"], directions, new URLSearchParams())).toMatchObject({ isValid: true, view: "flashcards", section });
  });
  it("counts aggregate progress by questions, not average part percentages", () => {
    expect(trainingStats(cards)).toEqual({ total: 40, learned: 20, unlearned: 15, answer_changed: 5, progress_percent: 50 });
    expect(trainingStats(cards.slice(0, 10)).progress_percent).toBe(100);
    expect(trainingStats(cards.slice(10)).progress_percent).toBe(33);
  });
  it("does not call 999 of 1000 cards fully learned despite rounding to 100%", () => {
    expect(getProgressLabel(Math.round(999 * 100 / 1000), false)).toBe("Почти готово");
    expect(getProgressLabel(100, true)).toBe("Изучено");
    expect(getProgressLabel(0, false)).toBe("Не начато");
  });
  it("keeps changed cards in unlearned mode for both batches and whole exam", () => {
    const whole = filterStudyCards(cards, "unlearned");
    expect(whole).toHaveLength(20);
    expect(filterStudyCards(cards, "stale")).toHaveLength(5);
    const batches = studyBatches(cards, 10);
    expect(batches[2]).toMatchObject({ from: 21, to: 30, stats: { learned: 0, answer_changed: 5, unlearned: 5 } });
    expect(batches.flatMap((batch) => filterStudyCards(cards.slice(batch.from - 1, batch.to), "unlearned"))).toEqual(whole);
    expect(cards[0].answer).toBe("Первая строка\n\nВторая строка");
  });
  it("shows access failures as unavailable rather than an empty deck", () => {
    expect(trainingError(new ApiError("backend", 403, undefined, "training_disabled"))).toBe("Подготовка по этому экзамену сейчас недоступна");
    expect(trainingError(new ApiError("backend", 409, undefined, "content_changed"))).toContain("Содержание карточки изменилось");
    expect(examPeriod(null, null)).toBe("Период не задан");
  });
});
