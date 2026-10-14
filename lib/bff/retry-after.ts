/** Standard Retry-After accepts a delay in seconds or an HTTP-date. */
export function parseRetryAfterMs(value: string | null | undefined, now = Date.now()): number | undefined {
  if (!value?.trim()) return undefined;
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    const delay = Number(text) * 1000;
    return Number.isFinite(delay) ? delay : undefined;
  }
  // Do not let Date.parse interpret a malformed numeric delay as a year/date.
  if (!/^[A-Za-z]{3},/.test(text)) return undefined;
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : undefined;
}
