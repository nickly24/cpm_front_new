import { describe, expect, it } from "vitest";
import {
  ANSWER_SPLIT_DELIMITER_OPTIONS,
  answerSplitDelimiterLabel,
  applyAnswerSplitToQuestion,
  applyBulkAnswerSplit,
  buildBulkSplitPreview,
  detectDelimiter,
  findBulkSplitCandidates,
  resolveAnswerSplitDelimiter,
  splitAnswerWithMode,
} from "./admin-answer-split";
import type { DraftQuestionNode } from "./admin-test-drafts-types";

function question(id: string, text: string): DraftQuestionNode {
  return {
    id, type: "text", text: "Вопрос", points: 1,
    answers: [{ id: `${id}-answer`, kind: "textAnswer", text, isCorrect: true }],
  };
}

function uidFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-${++index}`;
}

describe("explicit line-by-line answer splitting", () => {
  it.each(["\n", "\r\n", "\r"])("splits %j but keeps punctuation within each line", (newline) => {
    const source = `  Один; два${newline}${newline}Три / четыре, пять${newline}ОДИН; ДВА  `;
    expect(splitAnswerWithMode(source, "newline")).toEqual({
      delimiter: "\n", parts: ["Один; два", "Три / четыре, пять"],
    });
  });

  it("recognizes mixed newline formats in automatic mode", () => {
    const source = "Один\rДва\r\nТри\nЧетыре";
    expect(detectDelimiter(source)).toBe("\n");
    expect(splitAnswerWithMode(source, "auto").parts).toEqual(["Один", "Два", "Три", "Четыре"]);
  });

  it("retains the custom delimiter and existing punctuation choices", () => {
    expect(splitAnswerWithMode("Один<->Два", "custom", "<->").parts).toEqual(["Один", "Два"]);
    expect(splitAnswerWithMode("Один;Два", ";").parts).toEqual(["Один", "Два"]);
    expect(ANSWER_SPLIT_DELIMITER_OPTIONS.map((option) => option.value)).toEqual([
      "auto", ",", ";", "/", "|", "newline", "custom",
    ]);
    expect(ANSWER_SPLIT_DELIMITER_OPTIONS.find((option) => option.value === "newline")?.label)
      .toBe("Новая строка — разделить построчно");
  });

  it("uses a readable label when newline is chosen explicitly", () => {
    const delimiter = resolveAnswerSplitDelimiter("Один\nДва", "newline");
    expect(delimiter).toBe("\n");
    expect(answerSplitDelimiterLabel(delimiter)).toBe("новая строка");
    expect(answerSplitDelimiterLabel("")).toBe("не задан");
    expect(answerSplitDelimiterLabel("<->")).toBe("<->");
  });

  it("creates a non-mutating preview and changes only the selected answer on apply", () => {
    const original = question("q1", "Один\n\nДва");
    original.answers.push({ id: "other", kind: "textAnswer", text: "Другой ответ", isCorrect: true });
    const { parts } = splitAnswerWithMode(original.answers[0].text, "newline");
    expect(original.answers[0].text).toBe("Один\n\nДва");
    expect(original.answers).toHaveLength(2);
    const result = applyAnswerSplitToQuestion(original, "q1-answer", parts, "text", uidFactory());
    expect(result.answers.map((answer) => answer.text)).toEqual(["Один", "Два", "Другой ответ"]);
    expect(original.answers[0].text).toBe("Один\n\nДва");
  });

  it("bulk preview leaves source cards unchanged until apply and skips unsplit answers", () => {
    const questions = [question("q1", "Один\r\nДва"), question("q2", "Один; два")];
    const snapshot = structuredClone(questions);
    const rows = buildBulkSplitPreview(findBulkSplitCandidates(questions), "newline");
    expect(questions).toEqual(snapshot);
    expect(rows.map((row) => row.splitOk)).toEqual([true, false]);
    const result = applyBulkAnswerSplit(questions, rows, "multiple", uidFactory());
    expect(result[0].type).toBe("multiple");
    expect(result[0].answers.map((answer) => [answer.text, answer.isCorrect])).toEqual([
      ["Один", true], ["Два", true],
    ]);
    expect(result[1]).toBe(questions[1]);
    expect(questions).toEqual(snapshot);
  });
});
