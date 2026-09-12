import { describe, expect, it } from "vitest";
import {
  acceptAttempt,
  formatDate,
  formatScore,
  fromMoscowInput,
  GRADES,
  selectionBody,
  thresholdError,
  toMoscowInput,
  typeLabel,
  voteBody,
} from "./utils";
import { queryString, importPrefix, updateExamQuery } from "./api";
import { importCellValue } from "@/components/exams-v2/import";
import type { AttemptState, Threshold } from "./types";
import { ratingFreshnessMessage } from "@/lib/ratings/freshness";

describe("exam v2 value contracts", () => {
  it("resets page on date/direction changes without dropping other URL filters", () => {
    const source = new URLSearchParams(
      "page=9&type=classic&search=Алгебра&sort=date_asc&dateTo=2026-09-30&directionId=2",
    );
    const updated = updateExamQuery(source, {
      page: null,
      dateFrom: "2026-09-01",
      directionId: 7,
    });
    expect(Object.fromEntries(updated)).toEqual({
      type: "classic",
      search: "Алгебра",
      sort: "date_asc",
      dateTo: "2026-09-30",
      dateFrom: "2026-09-01",
      directionId: "7",
    });
    expect(source.get("page")).toBe("9");
    expect(updateExamQuery(updated, { dateFrom: null }).get("dateTo")).toBe(
      "2026-09-30",
    );
  });
  it("keeps zero and false in query strings and encodes search", () => {
    const query = new URLSearchParams(
      queryString({
        grade: 0,
        hasAppeal: false,
        search: "А & Б",
        absent: undefined,
        nil: null,
        empty: "",
      }),
    );
    expect(Object.fromEntries(query)).toEqual({
      grade: "0",
      hasAppeal: "false",
      search: "А & Б",
    });
    expect(queryString()).toBe("");
  });
  it("handles Moscow independently of browser timezone", () => {
    expect(toMoscowInput("2026-09-12T22:30:00Z")).toBe("2026-09-13T01:30");
    expect(fromMoscowInput("2026-09-13T01:30")).toBe(
      "2026-09-13T01:30:00+03:00",
    );
    expect(toMoscowInput("2026-09-13T01:30:00+03:00")).toBe("2026-09-13T01:30");
    expect(toMoscowInput(null)).toBe("");
    expect(fromMoscowInput("")).toBeNull();
    expect(formatDate("2026-09-12")).toContain("12");
  });
  it("supports all six grades and half scores, without legacy /6", () => {
    expect(GRADES).toEqual([0, 1, 2, 3, 4, 5]);
    expect(formatScore(0)).toBe("0");
    expect(formatScore(0.5)).toBe("0,5");
    expect(formatScore(null)).toBe("—");
    expect(typeLabel("outside_lms")).toBe("Экзамен вне системы LMS");
  });
  it("validates all six increasing integer thresholds", () => {
    const rows: Threshold[] = GRADES.map((grade) => ({
      grade,
      minScore: grade,
    }));
    expect(thresholdError(rows, 5)).toBeNull();
    expect(thresholdError(rows, 4)).not.toBeNull();
    expect(thresholdError(rows.slice(1), 10)).not.toBeNull();
    expect(
      thresholdError(
        rows.map((r) => ({ ...r, minScore: 1 })),
        10,
      ),
    ).not.toBeNull();
    expect(
      thresholdError(
        rows.map((r) => (r.grade === 2 ? { ...r, minScore: 1.5 } : r)),
        10,
      ),
    ).not.toBeNull();
  });
  it("does not attach global version to parallel member votes", () => {
    expect(voteBody(11, 22, 0)).toEqual({
      presentedQuestionId: 11,
      roundId: 22,
      value: 0,
    });
    expect(voteBody(11, 22, 0.5)).not.toHaveProperty("expectedStateVersion");
    expect(selectionBody(11, 8)).toEqual({
      presentedQuestionId: 11,
      expectedStateVersion: 8,
    });
  });
  it("rejects delayed responses from another attempt or lower version", () => {
    const attempt = (id: number, stateVersion: number) =>
      ({ id, stateVersion }) as AttemptState;
    expect(acceptAttempt(attempt(1, 7), attempt(1, 6), 1)).toBe(false);
    expect(acceptAttempt(attempt(1, 7), attempt(1, 7), 1)).toBe(true);
    expect(acceptAttempt(attempt(1, 7), attempt(2, 9), 1)).toBe(false);
    expect(acceptAttempt(null, attempt(1, 1), 1)).toBe(true);
  });
  it("keeps numeric logins as strings in editable import rows", () => {
    expect(importCellValue("studentLogin", "00125", null)).toBe("00125");
    expect(importCellValue("examinator1Login", "1234", null)).toBe("1234");
    expect(importCellValue("studentId", "125", null)).toBe(125);
    expect(importCellValue("grade", "0", null)).toBe(0);
    expect(importCellValue("examinator1Id", "12", null)).toBe(12);
    expect(importCellValue("grade", "wrong", null)).toBe("wrong");
    expect(importCellValue("commissionMemberIds", "1, 2", [])).toEqual([1, 2]);
    expect(importPrefix(10, "outside")).toBe(
      "/api/outside-exam-results-import",
    );
    expect(importPrefix(10, "questions")).toBe(
      "/api/exams/10/imports/questions",
    );
  });
});

describe("exam-scoped rating freshness", () => {
  it("does not call a missing or fresh marker stale", () => {
    expect(ratingFreshnessMessage()).toBeNull();
    expect(
      ratingFreshnessMessage({
        scope: "exams",
        isStale: false,
        reason: null,
        activeJobId: null,
      }),
    ).toBeNull();
  });
  it("distinguishes failed, running and changed exam snapshots", () => {
    expect(
      ratingFreshnessMessage({
        scope: "exams",
        isStale: true,
        reason: "exam_started",
        activeJobId: null,
      }),
    ).toContain("0");
    expect(
      ratingFreshnessMessage({
        scope: "exams",
        isStale: true,
        reason: "recalculation_failed",
        activeJobId: null,
      }),
    ).toContain("Сохранён предыдущий");
    expect(
      ratingFreshnessMessage({
        scope: "exams",
        isStale: true,
        reason: "exam_data_changed",
        activeJobId: 2,
      }),
    ).toContain("Идёт пересчёт");
  });
});
