import { describe, expect, it } from "vitest";
import {
  canvasStateToTestFormData,
  parseAnswerIdFromCanvasId,
  parseQuestionIdFromCanvasId,
  testDetailToCanvasState,
} from "@/lib/admin/admin-test-canvas-adapter";
import type { AdminTestDetail } from "@/lib/admin/admin-tests-types";

const sampleTest: AdminTestDetail = {
  _id: "665abc123",
  title: "Контрольная",
  direction: "Python",
  startDate: "2026-03-01T10:00:00.000Z",
  endDate: "2026-03-01T12:00:00.000Z",
  timeLimitMinutes: 45,
  published: true,
  visible: false,
  questions: [
    {
      questionId: 12,
      type: "single",
      text: "Вопрос 1",
      points: 2,
      answers: [
        { id: "a", text: "Да", isCorrect: true },
        { id: "b", text: "Нет", isCorrect: false },
      ],
      correctAnswers: [],
    },
    {
      questionId: 7,
      type: "text",
      text: "Вопрос 2",
      points: 1,
      answers: [],
      correctAnswers: ["print", "вывод"],
    },
  ],
};

describe("admin-test-canvas-adapter", () => {
  it("converts test detail to canvas ids", () => {
    const canvasState = testDetailToCanvasState(sampleTest);

    expect(canvasState.id).toBe("665abc123");
    expect(canvasState.canvas.questions).toHaveLength(2);
    expect(canvasState.canvas.questions[0]?.id).toBe("q_12");
    expect(canvasState.canvas.questions[0]?.answers[0]?.id).toBe("q_12_a");
    expect(canvasState.canvas.questions[1]?.answers[0]?.id).toBe("q_7_text_1");
    expect(canvasState.canvas.layout["q_12"]).toEqual({
      x: 120,
      y: 120,
    });
  });

  it("round-trips question and answer ids back to test payload", () => {
    const canvasState = testDetailToCanvasState(sampleTest);
    const payload = canvasStateToTestFormData(canvasState);

    expect(payload.title).toBe("Контрольная");
    expect(payload.questions).toHaveLength(2);
    expect(payload.questions[0]).toMatchObject({
      questionId: 12,
      type: "single",
      text: "Вопрос 1",
      points: 2,
      answers: [
        { id: "a", text: "Да", isCorrect: true },
        { id: "b", text: "Нет", isCorrect: false },
      ],
    });
    expect(payload.questions[1]).toMatchObject({
      questionId: 7,
      type: "text",
      correctAnswers: ["print", "вывод"],
    });
  });

  it("parses canvas ids with fallbacks", () => {
    expect(parseQuestionIdFromCanvasId("q_42", 0)).toBe(42);
    expect(parseQuestionIdFromCanvasId("custom", 3)).toBe(4);
    expect(parseAnswerIdFromCanvasId("q_12_b", "q_12")).toBe("b");
    expect(parseAnswerIdFromCanvasId("q_7_text_2", "q_7")).toBe("text_2");
  });
});
