import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
vi.mock("@/lib/config", () => ({ BFF_DEV: false }));
vi.mock("./test-attempt-v2-events", () => ({ announceAttemptChange: vi.fn() }));
vi.mock("./test-attempt-api", () => ({ finalizeTestAttemptV2: vi.fn() }));
import { finalizeTestAttemptV2 } from "./test-attempt-api";
import { isRetryableUploadError, uploadOfficialSnapshot } from "./test-attempt-v2-upload";
import { loadV2Bundle, saveV2Bundle, sealV2Bundle, updateFinalUploadState, type AttemptV2Bundle } from "./test-attempt-v2-store";

beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("navigator", { onLine: true });
  vi.mocked(finalizeTestAttemptV2).mockReset();
  const now = Date.now();
  await saveV2Bundle({schemaVersion:2,attemptId:"upload",testId:"test",testVersionId:"version",
    questions:[{questionId:1}], committedByQuestion:{}, draftsByQuestion:{}, pendingCommitIds:[], localStatus:"active",
    time:{answerDeadlineEpochMs:now+60_000,uploadDeadlineEpochMs:now+86400_000,lastEffectiveNowEpochMs:now,serverOffsetMs:0},
    syncSummary:{failures:0,paused:false},finalSnapshot:null,
  } as unknown as AttemptV2Bundle);
  await sealV2Bundle("upload","manual");
});
describe("saved final delivery", () => {
  it("keeps the exact snapshot after a network failure and delivers it on the next attempt", async () => {
    vi.mocked(finalizeTestAttemptV2).mockRejectedValueOnce(Object.assign(new Error("Failed to fetch"), {status:0,code:"transport_error"})).mockResolvedValue({success:true});
    const failed = await uploadOfficialSnapshot("upload");
    expect(failed.bundle?.localStatus).toBe("sealed_pending_upload");
    expect(failed.bundle?.finalUpload?.paused).toBe(false);
    const delivered = await uploadOfficialSnapshot("upload");
    expect(delivered.bundle?.localStatus).toBe("uploaded");
    expect(vi.mocked(finalizeTestAttemptV2).mock.calls[0][1]).toEqual(vi.mocked(finalizeTestAttemptV2).mock.calls[1][1]);
  });
  it("coalesces manual and automatic delivery and does not resend an accepted snapshot", async () => {
    vi.mocked(finalizeTestAttemptV2).mockResolvedValue({success:true});
    await Promise.all([uploadOfficialSnapshot("upload"),uploadOfficialSnapshot("upload")]);
    await uploadOfficialSnapshot("upload");
    expect(finalizeTestAttemptV2).toHaveBeenCalledTimes(1);
  });
  it("explains offline delivery and preserves the frozen snapshot without a request", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const result = await uploadOfficialSnapshot("upload");
    expect(result.error).toBe("transport_error");
    expect(result.bundle?.localStatus).toBe("sealed_pending_upload");
    expect(result.bundle?.finalSnapshot).not.toBeNull();
    expect(finalizeTestAttemptV2).not.toHaveBeenCalled();
  });
  it("does not retry answer conflicts or expired authorization automatically", async () => {
    vi.mocked(finalizeTestAttemptV2).mockRejectedValue(Object.assign(new Error("answer_locked"),{status:409,code:"answer_locked"}));
    expect((await uploadOfficialSnapshot("upload")).bundle?.finalUpload?.paused).toBe(true);
    expect(isRetryableUploadError({status:401})).toBe(false);
    expect(isRetryableUploadError({status:503})).toBe(true);
    expect(isRetryableUploadError({status:0})).toBe(true);
  });
  it("persists server backoff and rejects automatic retries from another tab or a reload", async () => {
    vi.mocked(finalizeTestAttemptV2).mockRejectedValueOnce(Object.assign(new Error("busy"), { status: 429, retryAfterMs: 120_000 })).mockResolvedValue({ success: true });
    const failed = await uploadOfficialSnapshot("upload", { manual: false });
    expect(failed.bundle?.finalUpload?.nextAttemptEpochMs).toBeGreaterThanOrEqual(Date.now() + 119_000);
    await uploadOfficialSnapshot("upload", { manual: false });
    expect(finalizeTestAttemptV2).toHaveBeenCalledTimes(1);
    // An explicit button press still sends immediately, without another confirmation.
    await uploadOfficialSnapshot("upload");
    expect(finalizeTestAttemptV2).toHaveBeenCalledTimes(2);
    expect((await loadV2Bundle("upload"))?.localStatus).toBe("uploaded");
  });
  it("rechecks pause state after acquiring the cross-tab Web Lock", async () => {
    vi.stubGlobal("navigator", { onLine: true, locks: { request: vi.fn(async (_name, run) => {
      await updateFinalUploadState("upload", { failures: 1, paused: true });
      return run();
    }) } });
    const result = await uploadOfficialSnapshot("upload", { manual: false });
    expect(result.bundle?.finalUpload?.paused).toBe(true);
    expect(finalizeTestAttemptV2).not.toHaveBeenCalled();
  });
  it("rechecks a retry deadline saved by the other tab while waiting for its Web Lock", async () => {
    vi.stubGlobal("navigator", { onLine: true, locks: { request: vi.fn(async (_name, run) => {
      await updateFinalUploadState("upload", { failures: 1, paused: false, nextAttemptEpochMs: Date.now() + 60_000 });
      return run();
    }) } });
    const result = await uploadOfficialSnapshot("upload", { manual: false });
    expect(result.bundle?.localStatus).toBe("sealed_pending_upload");
    expect(finalizeTestAttemptV2).not.toHaveBeenCalled();
  });
});
