import { describe, expect, it } from "vitest";
import { responseError } from "@/lib/api/client";
import {
  deletionCanStart, deletionCountLabel, deletionIsActive, deletionProgress, latestDeletionJob, parseSavedDeletions,
  type StudentDeletionPreview,
} from "./student-deletion";

import { previewFixture, jobFixture } from "./student-deletion-test-fixtures";

describe("student deletion contract", () => {
  it("only permits a complete, current, unblocked preview", () => {
    expect(deletionCanStart(previewFixture)).toBe(true);
    expect(deletionCanStart(null)).toBe(false);
    expect(deletionCanStart({ ...previewFixture, available: false })).toBe(false);
    expect(deletionCanStart({ ...previewFixture, blockers: ["Storage unavailable"] })).toBe(false);
    expect(deletionCanStart({ ...previewFixture, active_job: jobFixture })).toBe(false);
    expect(deletionCanStart({ ...previewFixture, confirmation_token: null })).toBe(false);
    expect(deletionCanStart({ ...previewFixture, expires_at: "invalid" })).toBe(false);
    expect(deletionCanStart(previewFixture, Date.parse(previewFixture.expires_at!))).toBe(false);
  });
  it("fails closed for unknown, omitted or invalid counts and details", () => {
    for (const value of [null, undefined, -1, Infinity, 1.5]) {
      expect(deletionCanStart({ ...previewFixture, counts: { ...previewFixture.counts, homeworks: value } } as StudentDeletionPreview)).toBe(false);
    }
    expect(deletionCanStart({ ...previewFixture, details: [{ key: "x", label: "X", count: null }] })).toBe(false);
    expect(deletionCountLabel(null)).toBe("Неизвестно");
    expect(deletionCountLabel(undefined)).toBe("Неизвестно");
    expect(deletionCountLabel(0)).toBe("0");
  });
  it("uses server progress and never shows 100% before completed", () => {
    expect(deletionProgress(jobFixture)).toBe(40);
    expect(deletionProgress({ ...jobFixture, percent: 100 })).toBe(99);
    expect(deletionProgress({ ...jobFixture, status: "failed", percent: 100 })).toBe(99);
    expect(deletionProgress({ ...jobFixture, status: "waiting", percent: NaN })).toBe(0);
    expect(deletionProgress({ ...jobFixture, status: "completed", percent: 100 })).toBe(100);
    expect(deletionIsActive({ ...jobFixture, status: "waiting" })).toBe(true);
    expect(deletionIsActive({ ...jobFixture, status: "failed" })).toBe(false);
  });
  it("restores only valid minimal operation references", () => {
    expect(parseSavedDeletions("broken")).toEqual([]);
    expect(parseSavedDeletions('{"student_id":42}')).toEqual([]);
    expect(parseSavedDeletions(JSON.stringify([
      { student_id: 42, job_id: "job", idempotency_key: "key", name: "not persisted" },
      { student_id: 42, job_id: "duplicate", idempotency_key: "key" },
      { student_id: -1, job_id: null, idempotency_key: "key" },
      { student_id: 43, job_id: null, idempotency_key: "pending" },
    ]))).toEqual([{ student_id: 42, job_id: "job", idempotency_key: "key" }, { student_id: 43, job_id: null, idempotency_key: "pending" }]);
  });
  it("selects the latest server job without mutating the response", () => {
    const newer = { ...jobFixture, id: "new", created_at: "2026-10-03T11:00:00Z" };
    const jobs = [jobFixture, newer];
    expect(latestDeletionJob(jobs)?.id).toBe("new");
    expect(jobs[0].id).toBe(jobFixture.id);
    expect(latestDeletionJob([])).toBeNull();
  });
  it("preserves explicit machine codes while retaining legacy error codes", () => {
    expect(responseError({ error: "Preview changed", code: "preview_changed" }, 409).code).toBe("preview_changed");
    expect(responseError({ error: "confirmation_expired", message: "Expired" }, 409).code).toBe("confirmation_expired");
  });
});
