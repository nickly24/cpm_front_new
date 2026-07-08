import {
  linearizeLayout,
  sortQuestions,
} from "@/components/admin/tests/admin-test-draft-flow-layout";
import type {
  AdminTestDraft,
  DraftAnswerNode,
  DraftQuestionNode,
} from "@/lib/admin/admin-test-drafts-types";
import type {
  AdminTestDetail,
  AdminTestFormData,
  AdminTestQuestion,
} from "@/lib/admin/admin-tests-types";
import { toDatetimeLocalValue } from "@/lib/admin/admin-tests-utils";

function canvasQuestionId(questionId: number, index: number): string {
  return `q_${questionId || index + 1}`;
}

function questionToCanvasNode(
  question: AdminTestQuestion,
  index: number,
): DraftQuestionNode {
  const qid = canvasQuestionId(question.questionId, index);
  const answers: DraftAnswerNode[] = [];

  if (question.type === "text") {
    for (let i = 0; i < (question.correctAnswers || []).length; i += 1) {
      answers.push({
        id: `${qid}_text_${i + 1}`,
        kind: "textAnswer",
        text: question.correctAnswers[i] || "",
        isCorrect: true,
      });
    }
  } else {
    for (const answer of question.answers || []) {
      answers.push({
        id: `${qid}_${answer.id || String(answers.length + 1)}`,
        kind: "answer",
        text: answer.text || "",
        isCorrect: Boolean(answer.isCorrect),
      });
    }
  }

  return {
    id: qid,
    type: question.type,
    text: question.text || "",
    points: question.points || 1,
    answers,
  };
}

export function testDetailToCanvasState(test: AdminTestDetail): AdminTestDraft {
  const questions = (test.questions || []).map((question, index) =>
    questionToCanvasNode(question, index),
  );

  return {
    id: test._id,
    title: test.title || "",
    direction: test.direction || "",
    startDate: toDatetimeLocalValue(test.startDate),
    endDate: toDatetimeLocalValue(test.endDate),
    timeLimitMinutes: test.timeLimitMinutes || 30,
    published: test.published ?? true,
    visible: test.visible ?? false,
    canvas: {
      questions,
      layout: linearizeLayout(questions),
    },
    status: "active",
  };
}

export function parseQuestionIdFromCanvasId(
  canvasId: string,
  fallbackIndex: number,
): number {
  const match = /^q_(\d+)$/.exec(canvasId);
  if (match) return Number.parseInt(match[1], 10);
  return fallbackIndex + 1;
}

export function parseAnswerIdFromCanvasId(
  canvasAnswerId: string,
  questionCanvasId: string,
): string {
  const prefix = `${questionCanvasId}_`;
  if (canvasAnswerId.startsWith(prefix)) {
    return canvasAnswerId.slice(prefix.length);
  }
  return canvasAnswerId;
}

export function canvasStateToTestFormData(state: AdminTestDraft): AdminTestFormData {
  const sorted = sortQuestions(state.canvas);

  const questions = sorted.map((question, index) => {
    const questionId = parseQuestionIdFromCanvasId(question.id, index);

    if (question.type === "text") {
      return {
        questionId,
        type: question.type,
        text: question.text || "",
        points: question.points || 1,
        answers: [],
        correctAnswers: question.answers
          .filter((answer) => answer.kind === "textAnswer")
          .map((answer) => answer.text || ""),
      };
    }

    return {
      questionId,
      type: question.type,
      text: question.text || "",
      points: question.points || 1,
      answers: question.answers
        .filter((answer) => answer.kind === "answer")
        .map((answer) => ({
          id: parseAnswerIdFromCanvasId(answer.id, question.id),
          text: answer.text || "",
          isCorrect: Boolean(answer.isCorrect),
        })),
      correctAnswers: [],
    };
  });

  return {
    title: state.title || "",
    direction: state.direction || "",
    startDate: state.startDate || "",
    endDate: state.endDate || "",
    timeLimitMinutes: state.timeLimitMinutes || 30,
    questions,
    visible: state.visible ?? false,
    published: state.published ?? true,
  };
}
