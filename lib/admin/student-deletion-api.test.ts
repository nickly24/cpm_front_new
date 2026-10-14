import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api/client";
import { createStudentDeletionJob, fetchStudentDeletionJob, fetchStudentDeletionJobs, fetchStudentDeletionPreview, retryStudentDeletionJob } from "./student-deletion-api";
import { jobFixture, previewFixture } from "./student-deletion-test-fixtures";

vi.mock("@/lib/api/client", () => ({ apiRequest: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
describe("student deletion API", () => {
  it("reads a fresh preview", async () => {
    vi.mocked(apiRequest).mockResolvedValue(previewFixture);
    expect(await fetchStudentDeletionPreview(42)).toEqual(previewFixture);
    expect(apiRequest).toHaveBeenCalledWith("/api/students/42/deletion-preview", { cache: "no-store" });
  });
  it("creates with the snapshot token and stable idempotency key", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ job: jobFixture });
    expect(await createStudentDeletionJob(42, "token", "stable-key")).toEqual(jobFixture);
    expect(apiRequest).toHaveBeenCalledWith("/api/students/42/deletion-jobs", {
      method: "POST", body: JSON.stringify({ confirmation_token: "token", idempotency_key: "stable-key" }),
    });
  });
  it("reads latest jobs and progress without caching", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ jobs: [jobFixture] }).mockResolvedValueOnce({ job: jobFixture });
    expect(await fetchStudentDeletionJobs(42)).toEqual([jobFixture]);
    expect(await fetchStudentDeletionJob(jobFixture.id)).toEqual(jobFixture);
    expect(apiRequest).toHaveBeenNthCalledWith(1, "/api/students/42/deletion-jobs", { cache: "no-store" });
    expect(apiRequest).toHaveBeenNthCalledWith(2, `/api/student-deletion-jobs/${jobFixture.id}`, { cache: "no-store" });
  });
  it("retries the existing job without creating another deletion", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ job: jobFixture });
    expect(await retryStudentDeletionJob("job/with spaces")).toEqual(jobFixture);
    expect(apiRequest).toHaveBeenCalledWith("/api/student-deletion-jobs/job%2Fwith%20spaces/retry", { method: "POST" });
  });
});
