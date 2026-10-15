import { describe, expect, it } from "vitest";
import { assertTestTextAnswers, testTextAnswerIssue, textAnswerIssue } from "./admin-test-text-answers";
import type { AdminTestQuestion } from "./admin-tests-types";

const question = (answers: string[]): AdminTestQuestion => ({ questionId: 7, type: "text", text: "Вопрос", points: 1, answers: [], correctAnswers: answers });

describe("text answer validation before saving a test", () => {
  it.each([
    [[], "хотя бы один"], [["Москва", "  "], "пустой вариант"], [["Москва", " МОСКВА "], "повторяет вариант №1"],
    [["x".repeat(1001)], "1000 символов"], [["a\0b"], "недопустимый символ"], [["\uD800"], "недопустимый символ"],
    [Array.from({length: 51}, (_, i) => String(i)), "50 правильных"],
  ] as [string[], string][]) ("rejects invalid aliases %j", (answers, message) => {
    expect(textAnswerIssue(question(answers))?.message).toContain(message);
  });
  it("matches Go's Unicode whitespace and simple lowercase", () => {
    for (const aliases of [["\u0085"], ["İ", "i"], ["ΟΣ", "οσ"], ["Москва", "\u0085МОСКВА\u0085"]]) expect(textAnswerIssue(question(aliases))).not.toBeNull();
    for (const aliases of [["\uFEFF"], ["ΟΣ", "ος"], ["😀".repeat(1000)], ["Москва", "Moscow"]]) expect(textAnswerIssue(question(aliases))).toBeNull();
  });
  it("names question and alias, without mutating or silently deleting answers", () => {
    const questions = [question(["OK"]), question(["a", "A"])], before = JSON.stringify(questions);
    expect(testTextAnswerIssue(questions)).toMatchObject({questionIndex: 1, answerIndex: 1});
    expect(() => assertTestTextAnswers(questions)).toThrow("Вопрос №2, ответ №2");
    expect(JSON.stringify(questions)).toBe(before);
    expect(textAnswerIssue({...question([]), type: "single"})).toBeNull();
  });
});
