import { afterEach, describe, expect, it, vi } from "vitest";
import { homeworkFilesApi, homeworkErrorMessage, postFileToS3 } from "./api";

afterEach(() => vi.unstubAllGlobals());
describe("homework assessment boundary", () => {
  it.each([NaN, Infinity, -1, 101, 90.5, null, "90,5"])("rejects invalid score %s before serialization", async result => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(homeworkFilesApi.transition(1, "grade", { result })).rejects.toThrow("целое число");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("gives actionable PDF rejection messages", () => {
    expect(homeworkErrorMessage("too_many_pages")).toContain("разрешено для этой загрузки");
    expect(homeworkErrorMessage("upload_expired")).toContain("заново");
    expect(homeworkErrorMessage("Some transport failure")).toBe("Some transport failure");
  });
  it("distinguishes accepted source, compressed output and page limits without fixed defaults", () => {
    const limits = { max_source_bytes: 2.5 * 1048576, max_output_bytes: 1.25 * 1048576, max_pages: 7, dpi: 100, jpeg_quality: 60 };
    expect(homeworkErrorMessage("source_too_large", limits)).toContain("2,5 МиБ");
    expect(homeworkErrorMessage("processed_too_large", limits)).toContain("1,25 МиБ");
    expect(homeworkErrorMessage("too_many_pages", limits)).toContain("7 страниц");
    expect(homeworkErrorMessage("source_too_large", null)).not.toMatch(/10|35/);
    expect(homeworkErrorMessage("too_many_pages", null)).not.toMatch(/10|35/);
  });
  it("checks the newly accepted source snapshot before file transfer if settings changed after workspace load", async () => {
    const xhr = vi.fn(); vi.stubGlobal("XMLHttpRequest", xhr);
    await expect(postFileToS3({ job: { id: "job", status: "uploading", stage: "uploading", progress: 0, limits: { max_source_bytes: 1048576, max_output_bytes: 524288, max_pages: 3, dpi: 120, jpeg_quality: 75 } }, upload: { method: "POST", url: "http://127.0.0.1:19000/", fields: {} }, max_bytes: 999999999, poll_after_seconds: 10 }, { size: 2 * 1048576 } as File, vi.fn())).rejects.toThrow("1 МиБ");
    expect(xhr).not.toHaveBeenCalled();
  });
});
