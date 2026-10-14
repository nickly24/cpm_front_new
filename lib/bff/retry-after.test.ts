import { describe, expect, it } from "vitest";
import { parseRetryAfterMs } from "./retry-after";
describe("HTTP Retry-After", () => {
  it("parses a delay and a future HTTP date", () => {
    expect(parseRetryAfterMs("120")).toBe(120_000);
    const now = Date.parse("Tue, 13 Oct 2026 12:00:00 GMT");
    expect(parseRetryAfterMs("Tue, 13 Oct 2026 12:02:00 GMT", now)).toBe(120_000);
    expect(parseRetryAfterMs("Tue, 13 Oct 2026 11:00:00 GMT", now)).toBe(0);
  });
  it("ignores malformed and missing values", () => {
    for (const value of [null, undefined, "", "nonsense", "-2", "1.5"]) expect(parseRetryAfterMs(value)).toBeUndefined();
  });
});
