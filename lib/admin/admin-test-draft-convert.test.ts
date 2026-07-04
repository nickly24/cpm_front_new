import { describe, expect, it } from "vitest";
import { convertQuestionAnswersOnTypeChange } from "@/lib/admin/admin-test-draft-convert";
import type { DraftAnswerNode } from "@/lib/admin/admin-test-drafts-types";

const uid = (prefix: string) => `${prefix}-generated`;

describe("convertQuestionAnswersOnTypeChange", () => {
  it("multiple → text keeps only correct answers with text and ids", () => {
    const answers: DraftAnswerNode[] = [
      { id: "a1", kind: "answer", text: "Right", isCorrect: true },
      { id: "a2", kind: "answer", text: "Wrong", isCorrect: false },
      { id: "a3", kind: "answer", text: "Also wrong", isCorrect: false },
    ];

    const result = convertQuestionAnswersOnTypeChange("multiple", "text", answers, uid);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "a1",
      kind: "textAnswer",
      text: "Right",
      isCorrect: true,
    });
  });

  it("text → single maps all text answers and marks only the first correct", () => {
    const answers: DraftAnswerNode[] = [
      { id: "t1", kind: "textAnswer", text: "One", isCorrect: true },
      { id: "t2", kind: "textAnswer", text: "Two", isCorrect: true },
      { id: "t3", kind: "textAnswer", text: "Three", isCorrect: true },
    ];

    const result = convertQuestionAnswersOnTypeChange("text", "single", answers, uid);

    expect(result.filter((answer) => answer.kind === "answer")).toHaveLength(3);
    expect(result.find((answer) => answer.id === "t1")?.isCorrect).toBe(true);
    expect(result.find((answer) => answer.id === "t2")?.isCorrect).toBe(false);
    expect(result.find((answer) => answer.id === "t3")?.isCorrect).toBe(false);
  });

  it("single → multiple preserves texts and ids", () => {
    const answers: DraftAnswerNode[] = [
      { id: "a1", kind: "answer", text: "Alpha", isCorrect: true },
      { id: "a2", kind: "answer", text: "Beta", isCorrect: false },
    ];

    const result = convertQuestionAnswersOnTypeChange("single", "multiple", answers, uid);

    expect(result).toEqual([
      { id: "a1", kind: "answer", text: "Alpha", isCorrect: true },
      { id: "a2", kind: "answer", text: "Beta", isCorrect: false },
    ]);
  });

  it("multiple → single keeps first correct mark only", () => {
    const answers: DraftAnswerNode[] = [
      { id: "a1", kind: "answer", text: "One", isCorrect: true },
      { id: "a2", kind: "answer", text: "Two", isCorrect: true },
      { id: "a3", kind: "answer", text: "Three", isCorrect: false },
    ];

    const result = convertQuestionAnswersOnTypeChange("multiple", "single", answers, uid);

    expect(result.find((answer) => answer.id === "a1")?.isCorrect).toBe(true);
    expect(result.find((answer) => answer.id === "a2")?.isCorrect).toBe(false);
    expect(result.find((answer) => answer.id === "a3")?.isCorrect).toBe(false);
  });

  it("pads choice questions to at least two answers", () => {
    const answers: DraftAnswerNode[] = [
      { id: "a1", kind: "answer", text: "Only", isCorrect: true },
    ];

    const result = convertQuestionAnswersOnTypeChange("single", "multiple", answers, uid);

    expect(result.filter((answer) => answer.kind === "answer")).toHaveLength(2);
    expect(result[0].text).toBe("Only");
    expect(result[1].text).toBe("");
  });

  it("choice → text with no correct answers falls back to one empty text answer", () => {
    const answers: DraftAnswerNode[] = [
      { id: "a1", kind: "answer", text: "Wrong", isCorrect: false },
      { id: "a2", kind: "answer", text: "Also wrong", isCorrect: false },
    ];

    const result = convertQuestionAnswersOnTypeChange("multiple", "text", answers, uid);

    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("textAnswer");
    expect(result[0].text).toBe("");
    expect(result[0].isCorrect).toBe(true);
  });
});
