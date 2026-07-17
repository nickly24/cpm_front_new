import { describe, expect, it } from "vitest";

import {
  effectiveNowAfterReload,
  hasSeriousClockRollback,
  moscowNowIso,
  type AttemptV2Bundle,
} from "./test-attempt-v2-store";

const time: AttemptV2Bundle["time"] = {
  serverNowEpochMs: 1_000_000,
  serverOffsetMs: 10_000,
  startedAtMoscow: "2026-07-17T10:00:00+03:00",
  answerDeadlineMoscow: "2026-07-17T10:30:00+03:00",
  answerDeadlineEpochMs: 2_800_000,
  uploadDeadlineMoscow: "2026-07-18T10:30:00+03:00",
  uploadDeadlineEpochMs: 89_200_000,
  lastEffectiveNowEpochMs: 1_100_000,
};

describe("offline attempt clock", () => {
  it("never moves effective time backwards after reload", () => {
    expect(effectiveNowAfterReload(time, 1_000_000)).toBe(1_100_000);
  });

  it("continues from corrected client time when it is ahead", () => {
    expect(effectiveNowAfterReload(time, 1_200_000)).toBe(1_210_000);
  });

  it("detects a serious backwards clock change", () => {
    expect(hasSeriousClockRollback(time, 1_000_000)).toBe(true);
    expect(hasSeriousClockRollback(time, 1_100_000)).toBe(false);
  });

  it("serializes display time with Moscow offset", () => {
    expect(moscowNowIso(Date.UTC(2026, 6, 17, 7, 0, 0))).toBe("2026-07-17T10:00:00+03:00");
  });
});
