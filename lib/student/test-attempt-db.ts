import { BFF_DEV } from "@/lib/config";
import { getIdentity } from "@/lib/bff/client";
export function attemptDatabaseName() {
  if (!BFF_DEV) return "cpm_test_attempts";
  const user = getIdentity()?.user;
  if (!user?.account_id || !user.organization_id || !user.division_id) throw new Error("attempt_context_missing");
  return `cpm_test_attempts_dev_${user.account_id}_${user.organization_id}_${user.division_id}`;
}
const DB_VERSION = 3;

export const LEGACY_ATTEMPT_STORE = "bundles";
export const OFFICIAL_ATTEMPT_STORE = "bundles_v2";

export function openAttemptDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("indexeddb_unsupported"));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(attemptDatabaseName(), DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("indexeddb_upgrade_blocked"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LEGACY_ATTEMPT_STORE)) {
        db.createObjectStore(LEGACY_ATTEMPT_STORE, { keyPath: "attemptId" });
      }
      if (!db.objectStoreNames.contains(OFFICIAL_ATTEMPT_STORE)) {
        db.createObjectStore(OFFICIAL_ATTEMPT_STORE, { keyPath: "attemptId" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}
