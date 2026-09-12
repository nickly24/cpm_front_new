import { describe, expect, it } from "vitest";
import { filterHomeworkByStatus, getHomeworkDeadlineState, isHomeworkSubmitted } from "./homework-api";
import type { StudentHomeworkItem } from "./homework-types";

const base: StudentHomeworkItem = { homework_id: 1, homework_name: "Практика", homework_type: "ОВ", deadline: "2020-01-01", status: "ДЗ не сделано", result: null };
describe("homework list uses the actual file workflow", () => {
  it("does not call a submitted PDF overdue while the legacy journal is pending", () => {
    const item = { ...base, submission_state: "submitted" as const };
    expect(isHomeworkSubmitted(item)).toBe(true);
    expect(getHomeworkDeadlineState(item)).toBe("submitted");
    expect(filterHomeworkByStatus([item], "in_review")).toEqual([item]);
    expect(filterHomeworkByStatus([item], "done")).toEqual([]);
  });
  it("returns revisions and drafts to the actionable list", () => {
    const items = [{ ...base, submission_state: "revision_requested" as const }, { ...base, homework_id: 2, submission_state: "draft" as const }];
    expect(filterHomeworkByStatus(items, "undone")).toEqual(items);
    expect(filterHomeworkByStatus(items, "revision")).toEqual([items[0]]);
  });
  it("keeps a zero score as a completed result", () => {
    const item = { ...base, submission_state: "graded" as const, result: 0 };
    expect(filterHomeworkByStatus([item], "done")).toEqual([item]);
  });
  it("preserves manual journal entries without a PDF", () => {
    const item = { ...base, status: "ДЗ сдано", submission_state: "none" as const, result: 95 };
    expect(isHomeworkSubmitted(item)).toBe(true);
    expect(filterHomeworkByStatus([item], "done")).toEqual([item]);
  });
});
