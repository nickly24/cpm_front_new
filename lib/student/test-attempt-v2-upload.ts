import { finalizeTestAttemptV2 } from "./test-attempt-api";
import { attemptDatabaseName } from "./test-attempt-db";
import { effectiveNowAfterReload, loadV2Bundle, updateLocalStatus, updateFinalUploadState, type AttemptV2Bundle } from "./test-attempt-v2-store";
import type { SubmitAttemptResponse } from "./test-attempt-types";
import { officialUploadRetryAt, officialUploadRetryDelay } from "./test-attempt-v2-upload-policy";

const inFlight = new Map<string, Promise<UploadResult>>();
export interface UploadResult {
  bundle: AttemptV2Bundle | null;
  response?: SubmitAttemptResponse;
  error?: string;
}

export function isRetryableUploadError(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  // Connection failures, request timeouts, rate limits and unavailable dependencies are transient.
  // Validation, authorization and immutable-answer conflicts need user intervention.
  return status == null ? error instanceof TypeError || (error instanceof Error && /network|fetch|load failed|timeout|abort/i.test(error.message))
    : status === 0 || status === 408 || status === 429 || status >= 500;
}

export function uploadOfficialSnapshot(attemptId: string, { manual = true }: { manual?: boolean } = {}): Promise<UploadResult> {
  const scope = attemptDatabaseName();
  const key = `${scope}:${attemptId}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const send = async (): Promise<UploadResult> => {
    // Re-read after acquiring the cross-tab lock. The other tab may already have delivered it.
    let bundle = await loadV2Bundle(attemptId);
    if (!bundle?.finalSnapshot || bundle.localStatus === "uploaded" || bundle.localStatus === "upload_window_closed") return { bundle };
    const now = effectiveNowAfterReload(bundle.time);
    if (now >= bundle.time.uploadDeadlineEpochMs) {
      bundle = await updateLocalStatus(attemptId, "upload_window_closed");
      return { bundle, error: "upload_deadline_passed" };
    }
    // The state may have changed in another tab while this call waited for its Web Lock.
    if (!manual && (bundle.finalUpload?.paused || (bundle.finalUpload?.nextAttemptEpochMs ?? 0) > now)) return { bundle };
    if (!navigator.onLine) return { bundle, error: "transport_error" };
    bundle = await updateLocalStatus(attemptId, "uploading");
    try {
      const response = await finalizeTestAttemptV2(attemptId, bundle.finalSnapshot);
      bundle = await updateLocalStatus(attemptId, "uploaded");
      return { bundle, response };
    } catch (cause) {
      const error = (cause as { code?: string })?.code ?? (cause instanceof Error ? cause.message : "answers_not_synced");
      const retryNow = effectiveNowAfterReload(bundle.time);
      const closed = error === "upload_window_closed" || error === "upload_deadline_passed" || retryNow >= bundle.time.uploadDeadlineEpochMs;
      const failures = (bundle.finalUpload?.failures ?? 0) + 1;
      bundle = await updateFinalUploadState(attemptId, {
        failures,
        paused: !isRetryableUploadError(cause), lastError: error,
        nextAttemptEpochMs: officialUploadRetryAt(retryNow, bundle.time.uploadDeadlineEpochMs,
          officialUploadRetryDelay(failures, (cause as { retryAfterMs?: number })?.retryAfterMs)),
      });
      bundle = await updateLocalStatus(attemptId, closed ? "upload_window_closed" : "sealed_pending_upload");
      return { bundle, error };
    }
  };
  const task = (async () => navigator.locks ? await navigator.locks.request(`${key}:final-upload`, send) : await send())()
    .finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return task;
}
