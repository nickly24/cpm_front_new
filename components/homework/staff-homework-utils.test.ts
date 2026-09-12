import { describe, expect, it } from "vitest";
import { parseHomeworkScore } from "./staff-homework-utils";

describe("manual homework grade input", () => {
  it.each(["abc", "90,5", "90.5", "1e2", "Infinity", "", "   ", "-1", "101", "1000"])("rejects %j instead of turning it into an automatic or rounded grade", (input) => {
    expect(parseHomeworkScore(input)).toBeNull();
  });
  it.each([["0", 0], ["100", 100], [" 87 ", 87]])("accepts %j", (input, expected) => {
    expect(parseHomeworkScore(String(input))).toBe(expected);
  });
});
