import { describe, expect, it } from "vitest";
import {
  applyScannerFilterToPixels,
  scannerCanvasFilter,
} from "./image-filters";

describe("scannerCanvasFilter", () => {
  it("keeps brightness and contrast within safe canvas ranges", () => {
    expect(scannerCanvasFilter("auto", -100, -100)).toBe(
      "brightness(40%) contrast(40%)",
    );
  });

  it("adds the selected document treatment", () => {
    expect(scannerCanvasFilter("color", 0, 0)).toContain("saturate(118%)");
    expect(scannerCanvasFilter("gray", 0, 0)).toContain("grayscale(100%)");
    expect(scannerCanvasFilter("bw", 0, 0)).toContain("contrast(175%)");
  });

  it("applies filters directly to pixels for browsers without canvas filters", () => {
    const gray = new Uint8ClampedArray([200, 100, 50, 255]);
    applyScannerFilterToPixels(gray, "gray", 0, 0);
    expect(gray[0]).toBe(gray[1]);
    expect(gray[1]).toBe(gray[2]);

    const document = new Uint8ClampedArray([
      245, 245, 245, 255,
      40, 40, 40, 255,
    ]);
    applyScannerFilterToPixels(document, "bw", 0, 0);
    expect(document[0]).toBe(255);
    expect(document[4]).toBeLessThan(40);
  });
});
