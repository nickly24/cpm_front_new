const DB_NAME = "cpm_test_attempts";
const DB_VERSION = 3;

export const LEGACY_ATTEMPT_STORE = "bundles";
export const OFFICIAL_ATTEMPT_STORE = "bundles_v2";

export function openAttemptDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("indexeddb_unsupported"));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
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
