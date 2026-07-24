import { describe, expect, it } from "vitest";
import { scannerCanvasFilter } from "./image-filters";

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
});
