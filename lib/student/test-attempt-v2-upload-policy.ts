const MAX_BACKOFF_MS = 60_000;

function spread(minimum: number, maximum: number, random: () => number) {
  const sample = Math.max(0, Math.min(1, random()));
  return minimum + Math.floor((maximum - minimum) * sample);
}

/** Equal jitter keeps a minimum pause and distributes clients across the backoff window. */
export function officialUploadRetryDelay(failures: number, retryAfterMs = 0, random = Math.random) {
  const ceiling = Math.min(MAX_BACKOFF_MS, 3000 * 2 ** Math.min(Math.max(1, failures), 5));
  const backoff = spread(ceiling / 2, ceiling, random);
  // Spread a common Retry-After too, without sending before the server permits a retry.
  return Math.max(backoff, Math.max(0, retryAfterMs) + spread(0, 1000, random));
}

export function officialUploadInitialDelay(random = Math.random) {
  return spread(250, 1250, random);
}

export function officialUploadRecoveryDelay(random = Math.random) {
  return spread(1000, 15_000, random);
}

/** A deadline-valued timestamp means expire locally; never send beyond the upload window. */
export function officialUploadRetryAt(now: number, deadline: number, delay: number) {
  return Math.min(deadline, now + Math.max(0, delay));
}
