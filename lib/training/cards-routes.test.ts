import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/config", () => ({ BFF_DEV: true }));
import { parseTrainingPath, trainingSectionPath, trainingStudyPath } from "./training-routes";
import type { TrainingDirection, TrainingSectionNode } from "./training-types";
const manual: TrainingSectionNode = { kind: "manual", refId: "15", name: "Одинаковое / название", stats: { total: 0, learned: 0, unlearned: 0, answer_changed: 0 }, total_cards: 0, learned_cards: 0, progress_percent: 0 };
const test = { ...manual, kind: "test" as const, refId: "a".repeat(24) };
const direction: TrainingDirection = { id: 4, name: "Направление", sections: [manual, test], total_cards: 0, learned_cards: 0, progress_percent: 0 };
describe("Cards routes in BFF", () => {
  it("keeps kind/ID URLs distinct when names collide or change", () => {
    expect(trainingSectionPath("student", direction, manual)).toBe("/cabinet/student/train/manual/15");
    expect(trainingSectionPath("student", direction, test)).toBe(`/cabinet/student/train/test/${test.refId}`);
    expect(trainingSectionPath("student", direction, { ...manual, name: "Новое название" })).toBe("/cabinet/student/train/manual/15");
    expect(parseTrainingPath(["test", test.refId], [direction], new URLSearchParams()).section).toBe(test);
  });
  it("retains the all-cards study sentinel and validates malformed study mode", () => {
    expect(trainingStudyPath("student", direction, manual, { batch: -1, mode: "stale" })).toBe("/cabinet/student/train/manual/15/study?batch=-1&mode=stale");
    expect(parseTrainingPath(["manual", "15", "study"], [direction], new URLSearchParams("batch=-1&mode=stale"))).toMatchObject({ batch: -1, studyMode: "stale", isValid: true });
    expect(parseTrainingPath(["manual", "15", "study"], [direction], new URLSearchParams("batch=1.5&mode=unsupported"))).toMatchObject({ batch: 0, studyMode: "unlearned" });
    expect(parseTrainingPath(["manual", "16"], [direction], new URLSearchParams()).isValid).toBe(false);
  });
});
