import { describe, expect, it } from "vitest";
import { searchDraftQuestions } from "@/lib/admin/admin-test-draft-question-search";
import type { DraftQuestionNode } from "@/lib/admin/admin-test-drafts-types";

function makeQuestion(
  id: string,
  text: string,
  answers: DraftQuestionNode["answers"] = [],
): DraftQuestionNode {
  return {
    id,
    type: "single",
    text,
    points: 1,
    answers,
  };
}

describe("searchDraftQuestions", () => {
  const questions: DraftQuestionNode[] = [
    makeQuestion("q1", "Какой язык используется во фронтенде?", [
      { id: "a1", kind: "answer", text: "JavaScript", isCorrect: true },
      { id: "a2", kind: "answer", text: "Python", isCorrect: false },
    ]),
    makeQuestion("q2", "Что такое React?", [
      { id: "a3", kind: "answer", text: "Библиотека UI", isCorrect: true },
    ]),
    makeQuestion("q3", "Опишите архитектуру backend сервиса"),
  ];

  it("returns empty list for empty query", () => {
    expect(searchDraftQuestions(questions, "")).toEqual([]);
    expect(searchDraftQuestions(questions, "   ")).toEqual([]);
  });

  it("matches partial text in the middle of a question", () => {
    const results = searchDraftQuestions(questions, "backend");
    expect(results).toHaveLength(1);
    expect(results[0]?.questionId).toBe("q3");
  });

  it("prioritizes question text over answer text", () => {
    const results = searchDraftQuestions(questions, "react");
    expect(results[0]?.questionId).toBe("q2");
  });

  it("finds questions by answer text with secondary match info", () => {
    const results = searchDraftQuestions(questions, "python");
    expect(results).toHaveLength(1);
    expect(results[0]?.questionId).toBe("q1");
    expect(results[0]?.matchedAnswers).toHaveLength(1);
    expect(results[0]?.matchedAnswers[0]?.snippet.toLowerCase()).toContain("python");
  });

  it("requires all tokens to match somewhere", () => {
    expect(searchDraftQuestions(questions, "react backend")).toEqual([]);
    expect(searchDraftQuestions(questions, "react ui")).toHaveLength(1);
    expect(searchDraftQuestions(questions, "react ui")[0]?.questionId).toBe("q2");
  });

  it("matches question number token", () => {
    const results = searchDraftQuestions(questions, "2");
    expect(results.some((item) => item.questionId === "q2")).toBe(true);
  });
});
