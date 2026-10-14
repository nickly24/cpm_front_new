import { describe, expect, it } from "vitest";
import { officialUploadInitialDelay, officialUploadRecoveryDelay, officialUploadRetryAt, officialUploadRetryDelay } from "./test-attempt-v2-upload-policy";

function seeded(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
}
describe("official delivery retry policy", () => {
  it("spreads a population's initial delivery and recovery within bounded windows", () => {
    const random = seeded(19);
    const initial = Array.from({ length: 500 }, () => officialUploadInitialDelay(random));
    const recovery = Array.from({ length: 500 }, () => officialUploadRecoveryDelay(random));
    expect(Math.min(...initial)).toBeGreaterThanOrEqual(250);
    expect(Math.max(...initial)).toBeLessThanOrEqual(1250);
    expect(new Set(initial).size).toBeGreaterThan(300);
    expect(Math.min(...recovery)).toBeGreaterThanOrEqual(1000);
    expect(Math.max(...recovery)).toBeLessThanOrEqual(15_000);
    expect(new Set(recovery).size).toBeGreaterThan(450);
  });
  it("uses exponential equal jitter and caps ordinary backoff at one minute", () => {
    expect(officialUploadRetryDelay(1, 0, () => 0)).toBe(3000);
    expect(officialUploadRetryDelay(1, 0, () => 1)).toBe(6000);
    expect(officialUploadRetryDelay(2, 0, () => 0)).toBe(6000);
    expect(officialUploadRetryDelay(100, 0, () => 0)).toBe(30_000);
    expect(officialUploadRetryDelay(100, 0, () => 1)).toBe(60_000);
  });
  it("honors a longer server delay with additional spread", () => {
    expect(officialUploadRetryDelay(1, 120_000, () => 0)).toBe(120_000);
    expect(officialUploadRetryDelay(1, 120_000, () => 1)).toBe(121_000);
  });
  it("never plans past the upload deadline", () => {
    expect(officialUploadRetryAt(100, 1000, 3000)).toBe(1000);
    expect(officialUploadRetryAt(100, 1000, 500)).toBe(600);
  });
});
