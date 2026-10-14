import { effectiveNowAfterReload, type AttemptV2Bundle } from "./test-attempt-v2-store";
import { officialUploadInitialDelay, officialUploadRecoveryDelay, officialUploadRetryAt, officialUploadRetryDelay } from "./test-attempt-v2-upload-policy";

interface Options {
  read: () => Promise<AttemptV2Bundle | null>;
  send: (bundle: AttemptV2Bundle) => Promise<void>;
  expire: () => Promise<void>;
  online: () => boolean;
  events: Pick<EventTarget, "addEventListener" | "removeEventListener">;
  onError: (cause: unknown) => void;
  random?: () => number;
}

/** One scheduler per mounted attempt; ordinary render/state updates never postpone its timer. */
export function createOfficialUploadScheduler(options: Options) {
  let bundle: AttemptV2Bundle | null = null;
  let sendTimer: ReturnType<typeof setTimeout> | undefined;
  let sendAt: number | undefined;
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  let deadlineAt: number | undefined;
  let running = false;
  let disposed = false;
  let wasOnline = options.online();
  let unexpectedFailures = 0;
  let unexpectedRetryAt = 0;
  const random = options.random ?? Math.random;
  const pending = () => Boolean(bundle?.finalSnapshot && ["sealed_pending_upload", "uploading"].includes(bundle.localStatus));
  const cancelSend = () => { clearTimeout(sendTimer); sendTimer = undefined; sendAt = undefined; };
  const cancelDeadline = () => { clearTimeout(deadlineTimer); deadlineTimer = undefined; deadlineAt = undefined; };

  const expire = async () => {
    if (disposed || !bundle || !pending()) return;
    cancelSend();
    // Recheck shared storage: the other tab may have finished before this timer fired.
    const current = await options.read();
    if (disposed) return;
    bundle = current;
    if (current && pending()) {
      if (effectiveNowAfterReload(current.time) >= current.time.uploadDeadlineEpochMs) await options.expire();
      else { cancelDeadline(); update(current); }
    }
  };

  const send = async () => {
    if (disposed || running) return;
    running = true;
    try {
      const current = await options.read();
      if (disposed) return;
      bundle = current;
      if (!bundle || !pending()) return;
      const now = effectiveNowAfterReload(bundle.time);
      if (now >= bundle.time.uploadDeadlineEpochMs) { await expire(); return; }
      if (!options.online() || bundle.finalUpload?.paused || (bundle.finalUpload?.nextAttemptEpochMs ?? 0) > now) return;
      await options.send(bundle);
      unexpectedFailures = 0; unexpectedRetryAt = 0;
    } catch (cause) {
      options.onError(cause);
      // Storage/lifecycle errors may occur before a retry can be persisted. Avoid a tight loop.
      if (bundle) unexpectedRetryAt = officialUploadRetryAt(effectiveNowAfterReload(bundle.time), bundle.time.uploadDeadlineEpochMs,
        officialUploadRetryDelay(++unexpectedFailures, 0, random));
    } finally {
      running = false;
      if (!disposed) {
        try { update(await options.read()); }
        catch (cause) { options.onError(cause); }
      }
    }
  };

  const update = (current: AttemptV2Bundle | null, recovery = false) => {
    if (disposed) return;
    bundle = current;
    if (!bundle || !pending()) { cancelSend(); cancelDeadline(); return; }
    const now = effectiveNowAfterReload(bundle.time);
    const deadline = bundle.time.uploadDeadlineEpochMs;
    if (deadlineAt !== deadline || now >= deadline) {
      cancelDeadline(); deadlineAt = deadline;
      deadlineTimer = setTimeout(() => { void expire().catch(options.onError); }, Math.max(0, deadline - now));
    }
    if (!options.online() || bundle.finalUpload?.paused || running || now >= deadline) { cancelSend(); return; }
    const retryAt = Math.max(bundle.finalUpload?.nextAttemptEpochMs ?? 0, unexpectedRetryAt);
    // Preserve an existing timer when IndexedDB broadcasts or React renders update the bundle.
    if (sendTimer !== undefined && !recovery && (sendAt ?? 0) >= retryAt) return;
    const persistedFailures = bundle.finalUpload?.failures ?? 0;
    let delay = recovery ? officialUploadRecoveryDelay(random) : officialUploadInitialDelay(random);
    // Old bundles have the failure count but no persisted retry timestamp yet.
    if (persistedFailures && bundle.finalUpload?.nextAttemptEpochMs == null) {
      delay = Math.max(delay, officialUploadRetryDelay(persistedFailures, 0, random));
    }
    const at = officialUploadRetryAt(now, deadline, Math.max(retryAt - now, delay));
    cancelSend();
    // The deadline timer closes the local window instead of ignoring a longer Retry-After.
    if (at >= deadline) return;
    sendAt = at;
    sendTimer = setTimeout(() => { sendTimer = undefined; sendAt = undefined; void send(); }, Math.max(0, at - now));
  };
  const offline = () => { wasOnline = false; cancelSend(); };
  const online = () => {
    if (wasOnline || disposed) return;
    wasOnline = true;
    void options.read().then(current => { if (!disposed) update(current, true); }).catch(options.onError);
  };
  options.events.addEventListener("offline", offline);
  options.events.addEventListener("online", online);
  return {
    update,
    dispose: () => {
      disposed = true; cancelSend(); cancelDeadline();
      options.events.removeEventListener("offline", offline);
      options.events.removeEventListener("online", online);
    },
  };
}
