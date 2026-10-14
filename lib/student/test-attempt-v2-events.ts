import { attemptDatabaseName } from "./test-attempt-db";

const source = crypto.randomUUID();

// Only announce identities. Answer data is read from the account/division-scoped database.
export function announceAttemptChange(attemptId: string) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(`${attemptDatabaseName()}:changes`);
  channel.postMessage({ attemptId, source });
  channel.close();
}

export function subscribeAttemptChanges(attemptId: string, refresh: () => void) {
  const scope = attemptDatabaseName();
  const scopedRefresh = () => { if (attemptDatabaseName() === scope) refresh(); };
  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(`${scope}:changes`);
  if (channel) channel.onmessage = (event) => { if (event.data?.attemptId === attemptId && event.data.source !== source) scopedRefresh(); };
  const visible = () => { if (document.visibilityState === "visible") scopedRefresh(); };
  window.addEventListener("focus", scopedRefresh);
  document.addEventListener("visibilitychange", visible);
  return () => {
    channel?.close();
    window.removeEventListener("focus", scopedRefresh);
    document.removeEventListener("visibilitychange", visible);
  };
}
