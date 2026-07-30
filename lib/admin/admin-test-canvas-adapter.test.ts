import { describe, expect, it } from "vitest";
import {
  allocateStableQuestionIds,
  canvasStateToTestFormData,
  parseAnswerIdFromCanvasId,
  parseQuestionIdFromCanvasId,
  testDetailToCanvasState,
} from "@/lib/admin/admin-test-canvas-adapter";
import { nextQuestionId } from "@/lib/admin/admin-tests-utils";
import type { AdminTestDetail } from "@/lib/admin/admin-tests-types";
import type { AdminTestDraft } from "@/lib/admin/admin-test-drafts-types";

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

  it("allocates free ids for newly added canvas questions without colliding", () => {
    // Не заполняем дырку 2 — иначе новый вопрос может склеиться со старыми session answers.
    expect(allocateStableQuestionIds(["q_1", "q_3", "q_171000_abc"])).toEqual([
      1, 3, 4,
    ]);
    expect(nextQuestionId([{ questionId: 1 }, { questionId: 3 }])).toBe(4);

    const draft: AdminTestDraft = {
      id: "t1",
      title: "T",
      direction: "Python",
      startDate: "",
      endDate: "",
      timeLimitMinutes: 30,
      published: true,
      visible: false,
      status: "active",
      canvas: {
        questions: [
          {
            id: "q_1",
            type: "single",
            text: "A",
            points: 1,
            answers: [
              { id: "q_1_a", kind: "answer", text: "x", isCorrect: true },
            ],
          },
          {
            id: "q_3",
            type: "single",
            text: "B",
            points: 1,
            answers: [
              { id: "q_3_a", kind: "answer", text: "y", isCorrect: true },
            ],
          },
          {
            id: "q_1739123456789_xyz",
            type: "text",
            text: "New",
            points: 1,
            answers: [
              { id: "t1", kind: "textAnswer", text: "ok", isCorrect: true },
            ],
          },
        ],
        layout: {
          q_1: { x: 0, y: 0 },
          q_3: { x: 100, y: 0 },
          q_1739123456789_xyz: { x: 200, y: 0 },
        },
      },
    };

    const payload = canvasStateToTestFormData(draft);
    expect(payload.questions.map((q) => q.questionId)).toEqual([1, 3, 4]);
    expect(payload.questions[2]?.text).toBe("New");
  });

  it("omits questions marked for deletion from save payload", () => {
    const draft: AdminTestDraft = {
      id: "t1",
      title: "T",
      direction: "Python",
      startDate: "",
      endDate: "",
      timeLimitMinutes: 30,
      published: true,
      visible: false,
      status: "active",
      canvas: {
        questions: [
          {
            id: "q_1",
            type: "single",
            text: "Keep",
            points: 1,
            answers: [
              { id: "q_1_a", kind: "answer", text: "x", isCorrect: true },
            ],
          },
          {
            id: "q_2",
            type: "single",
            text: "Drop",
            points: 1,
            markedForDeletion: true,
            answers: [
              { id: "q_2_a", kind: "answer", text: "y", isCorrect: true },
            ],
          },
        ],
        layout: {
          q_1: { x: 0, y: 0 },
          q_2: { x: 100, y: 0 },
        },
      },
    };

    const payload = canvasStateToTestFormData(draft);
    expect(payload.questions).toHaveLength(1);
    expect(payload.questions[0]?.questionId).toBe(1);
    expect(payload.questions[0]?.text).toBe("Keep");
  });
});
