import { describe, expect, it } from "vitest";
import { conductAttempt } from "@/lib/bff/exams-conduct";
import { mergeAttempt } from "./utils";
const attempt = (state: number, ov: number, extra = {}) => conductAttempt({ id: 5, state_version: state, ov_revision: ov, ...extra });
describe("independent attempt and OV revisions", () => {
  it("keeps a newer vote state when an older OV response arrives, but accepts the OV", () => {
    const current = attempt(12, 1, { ov_status: "missing", phase: "regular_questions" });
    const incoming = attempt(11, 2, { ov_status: "accepted", phase: "preparation" });
    expect(mergeAttempt(current, incoming, 5)).toMatchObject({ stateVersion: 12, phase: "regular_questions", ovRevision: 2, ovStatus: "accepted" });
  });
  it("keeps saved OV when a late workspace response has newer exam state", () => {
    const current = attempt(11, 3, { ov_status: "remarks", ov_comment: "Комментарий" });
    expect(mergeAttempt(current, attempt(12, 2, { ov_status: "missing" }), 5)).toMatchObject({ stateVersion: 12, ovRevision: 3, ovStatus: "remarks", ovComment: "Комментарий" });
  });
  it("never merges another student's payload", () => {
    const current = attempt(12, 3);
    expect(mergeAttempt(current, conductAttempt({ id: 6, state_version: 99, ov_revision: 99 }), 5)).toBe(current);
    expect(mergeAttempt(current, null, 6)).toBeNull();
  });
});
