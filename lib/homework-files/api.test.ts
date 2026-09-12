import { afterEach, describe, expect, it, vi } from "vitest";
import { homeworkFilesApi, homeworkErrorMessage } from "./api";

afterEach(() => vi.unstubAllGlobals());
describe("homework assessment boundary", () => {
  it.each([NaN, Infinity, -1, 101, 90.5, null, "90,5"])("rejects invalid score %s before serialization", async result => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(homeworkFilesApi.transition(1, "grade", { result })).rejects.toThrow("целое число");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("gives actionable PDF rejection messages", () => {
    expect(homeworkErrorMessage("too_many_pages")).toContain("35");
    expect(homeworkErrorMessage("upload_expired")).toContain("заново");
    expect(homeworkErrorMessage("Some transport failure")).toBe("Some transport failure");
  });
});
