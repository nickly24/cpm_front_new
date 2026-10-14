import { describe, expect, it } from "vitest";
import { formatPublishedScore, ratingPublicationState } from "./read-only";

describe("published rating presentation", () => {
  it("keeps a published zero visible when freshness is stale or never calculated", () => {
    expect(formatPublishedScore(0)).toBe("0");
    expect(ratingPublicationState(true, { scope: "ratings", isStale: true, reason: "source_changed", activeJobId: null })).toBe("published");
    expect(ratingPublicationState(true, { scope: "ratings", isStale: true, reason: "never_calculated", activeJobId: null })).toBe("published");
  });

  it("distinguishes first calculation from a participant absent in an existing version", () => {
    expect(ratingPublicationState(false, { scope: "ratings", isStale: true, reason: "never_calculated", activeJobId: null })).toBe("never_calculated");
    expect(ratingPublicationState(false, { scope: "ratings", isStale: false, reason: null, activeJobId: null })).toBe("not_in_publication");
  });

  it("does not fabricate scores for missing or nonfinite values", () => {
    expect(formatPublishedScore(null)).toBe("—");
    expect(formatPublishedScore(undefined)).toBe("—");
    expect(formatPublishedScore(Number.NaN)).toBe("—");
    expect(formatPublishedScore(Number.POSITIVE_INFINITY)).toBe("—");
  });
});
