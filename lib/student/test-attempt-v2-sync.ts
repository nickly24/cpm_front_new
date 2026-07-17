import { syncTestAttemptCommits } from "./test-attempt-api";
import {
  applyCommitAcks,
  loadV2Bundle,
  moscowNowIso,
  reanchorV2Time,
  updateSyncState,
  type AttemptV2Bundle,
} from "./test-attempt-v2-store";

const inFlight = new Map<string, Promise<AttemptV2Bundle | null>>();
const timers = new Map<string, number>();
const listeners = new Map<string, (bundle: AttemptV2Bundle) => void>();
const BACKOFF_MS = [15_000, 45_000, 120_000, 300_000];

function jitter(base: number) {
  return base + Math.floor(Math.random() * Math.max(1000, base * 0.5));
}

export function cancelScheduledOfficialSync(attemptId: string) {
  const timer = timers.get(attemptId);
  if (timer != null) window.clearTimeout(timer);
  timers.delete(attemptId);
}

export function scheduleOfficialSync(
  attemptId: string,
  onUpdate?: (bundle: AttemptV2Bundle) => void,
  delayMs = 3000,
) {
  if (onUpdate) listeners.set(attemptId, onUpdate);
  cancelScheduledOfficialSync(attemptId);
  timers.set(attemptId, window.setTimeout(() => {
    timers.delete(attemptId);
    void syncOfficialNow(attemptId).then((bundle) => bundle && listeners.get(attemptId)?.(bundle));
  }, delayMs));
}

export function syncOfficialNow(attemptId: string, manual = false): Promise<AttemptV2Bundle | null> {
  const existing = inFlight.get(attemptId);
  if (existing) return existing;
  const task = (async () => {
    let bundle = await loadV2Bundle(attemptId);
    if (!bundle || bundle.localStatus !== "active" || bundle.pendingCommitIds.length === 0) return bundle;
    if (!manual && bundle.syncSummary.paused) return bundle;
    if (typeof navigator !== "undefined" && !navigator.onLine) return bundle;
    const pending = new Set(bundle.pendingCommitIds);
    const commits = Object.values(bundle.committedByQuestion)
      .filter((commit) => pending.has(commit.commitId))
      .sort((a, b) => a.sequence - b.sequence)
      .slice(0, 25);
    if (!commits.length) return bundle;

    bundle = await updateSyncState(attemptId, {
      syncing: true, lastAttemptAtMoscow: moscowNowIso(), lastError: undefined,
      paused: manual ? false : bundle.syncSummary.paused,
    });
    try {
      const response = await syncTestAttemptCommits(attemptId, commits);
      const terminalCommitIds = [
        ...(response.ackedCommitIds ?? []),
        ...(response.conflicts ?? []).map((item) => item.commitId).filter((id): id is string => Boolean(id)),
        ...(response.errors ?? []).map((item) => item.commitId).filter((id): id is string => Boolean(id)),
      ];
      bundle = await applyCommitAcks(
        attemptId,
        terminalCommitIds,
        response.serverAnswerCount ?? bundle.syncSummary.serverAnswerCount,
      );
      if (response.serverNowEpochMs) {
        bundle = await reanchorV2Time(attemptId, response.serverNowEpochMs);
      }
      if (response.conflicts?.length || response.errors?.length) {
        bundle = await updateSyncState(attemptId, {
          lastError: "Часть промежуточной копии отклонена сервером. Финальный локальный слепок сохранён.",
        });
      }
      listeners.get(attemptId)?.(bundle);
      if (bundle.pendingCommitIds.length) scheduleOfficialSync(attemptId, undefined, 3000);
      return bundle;
    } catch (error) {
      const failures = bundle.syncSummary.failures + 1;
      const paused = failures >= BACKOFF_MS.length;
      bundle = await updateSyncState(attemptId, {
        syncing: false, failures, paused,
        lastError: error instanceof Error ? error.message : "sync_failed",
      });
      if (!paused && navigator.onLine) {
        scheduleOfficialSync(attemptId, undefined, jitter(BACKOFF_MS[failures - 1]));
      }
      return bundle;
    }
  })().finally(() => inFlight.delete(attemptId));
  inFlight.set(attemptId, task);
  return task;
}
