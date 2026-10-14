import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/config", () => ({ BFF_DEV: true }));
import { homeworkUploadLimits, homeworkWorkspaceLimits } from "./limits";
const limits = { max_source_bytes: 1048576, max_output_bytes: 524288, max_pages: 3, dpi: 120, jpeg_quality: 75 };
describe("native Homework accepted limits", () => {
  it("uses all exact fields from the current workspace policy", () => { expect(homeworkWorkspaceLimits(limits)).toEqual(limits); });
  it.each([null, undefined, { max_bytes: 10485760, max_pages: 35 }, { ...limits, max_pages: 0 }, { ...limits, max_output_bytes: NaN }, { ...limits, jpeg_quality: 101 }])("does not fall back for an unknown/invalid snapshot %s", value => { expect(homeworkUploadLimits(value)).toBeNull(); expect(homeworkWorkspaceLimits(value)).toBeNull(); });
});
