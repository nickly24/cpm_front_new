import type {
  AnswerDraft,
  StoredAttemptAnswer,
  TestAttempt,
} from "./test-attempt-types";
import { draftToStoredAnswer, isDraftValid } from "./test-attempt-utils";
import { OFFICIAL_ATTEMPT_STORE as STORE, openAttemptDb } from "./test-attempt-db";


export type LocalAttemptStatus =
  | "initializing"
  | "active"
  | "sealing"
  | "sealed_pending_upload"
  | "uploading"
  | "uploaded"
  | "upload_window_closed"
  | "storage_error";

export interface AttemptCommit extends StoredAttemptAnswer {
  commitId: string;
  sequence: number;
  committedAtMoscow: string;
}

export interface FinalAttemptSnapshot {
  attemptId: string;
  testVersionId: string;
  answers: AttemptCommit[];
  completedAtMoscow: string;
  reason: "manual" | "timeout";
  answeredCount: number;
  unansweredCount: number;
  snapshotHash: string;
}

export interface AttemptV2Bundle {
  schemaVersion: 2;
  attemptId: string;
  studentId?: number;
  testId: string;
  testVersionId: string;
  testTitle: string;
  questions: TestAttempt["questions"];
  questionOrder: number[];
  currentQuestionId: number;
  time: {
    serverNowEpochMs: number;
    serverOffsetMs: number;
    startedAtMoscow: string;
    answerDeadlineMoscow: string;
    answerDeadlineEpochMs: number;
    uploadDeadlineMoscow: string;
    uploadDeadlineEpochMs: number;
    lastEffectiveNowEpochMs: number;
  };
  draftsByQuestion: Record<string, AnswerDraft>;
  committedByQuestion: Record<string, AttemptCommit>;
  pendingCommitIds: string[];
  syncSummary: {
    serverAnswerCount: number;
    syncing: boolean;
    failures: number;
    paused: boolean;
    lastAttemptAtMoscow?: string;
    lastSuccessAtMoscow?: string;
    lastError?: string;
  };
  finalSnapshot: FinalAttemptSnapshot | null;
  localStatus: LocalAttemptStatus;
  updatedAtMoscow: string;
}

export function effectiveNowAfterReload(
  time: AttemptV2Bundle["time"],
  clientNowEpochMs = Date.now(),
): number {
  return Math.max(clientNowEpochMs + time.serverOffsetMs, time.lastEffectiveNowEpochMs);
}

export function hasSeriousClockRollback(
  time: AttemptV2Bundle["time"],
  clientNowEpochMs = Date.now(),
): boolean {
  return clientNowEpochMs + time.serverOffsetMs < time.lastEffectiveNowEpochMs - 60_000;
}

export function moscowNowIso(epochMs = Date.now()): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date(epochMs));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}:${value.second}+03:00`;
}

export async function preflightAttemptStorage(): Promise<void> {
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    if (estimate.quota != null && estimate.usage != null && estimate.quota - estimate.usage < 5 * 1024 * 1024) {
      throw new Error("insufficient_local_storage");
    }
  }
  const db = await openAttemptDb();
  const key = `__preflight_${crypto.randomUUID()}`;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ attemptId: key, schemaVersion: 2 });
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
  if (navigator.storage?.persist) {
    await navigator.storage.persist().catch(() => false);
  }
}

export async function saveV2Bundle(bundle: AttemptV2Bundle): Promise<void> {
  const db = await openAttemptDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(bundle);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadV2Bundle(attemptId: string): Promise<AttemptV2Bundle | null> {
  const db = await openAttemptDb();
  const value = await new Promise<AttemptV2Bundle | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(attemptId);
    request.onsuccess = () => resolve((request.result as AttemptV2Bundle | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  if (value && (
    value.schemaVersion !== 2
    || value.attemptId !== attemptId
    || !Array.isArray(value.questions)
    || !value.time?.answerDeadlineEpochMs
    || !value.testVersionId
  )) {
    throw new Error("corrupted_local_bundle");
  }
  return value;
}

export async function listV2Bundles(): Promise<AttemptV2Bundle[]> {
  const db = await openAttemptDb();
  const values = await new Promise<AttemptV2Bundle[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as AttemptV2Bundle[]) ?? []);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return values.filter((value) => (
    value?.schemaVersion === 2
    && Boolean(value.attemptId)
    && Array.isArray(value.questions)
    && Boolean(value.time?.answerDeadlineEpochMs)
    && Boolean(value.testVersionId)
  ));
}

async function mutateBundle(
  attemptId: string,
  mutate: (bundle: AttemptV2Bundle) => AttemptV2Bundle,
): Promise<AttemptV2Bundle> {
  const db = await openAttemptDb();
  const result = await new Promise<AttemptV2Bundle>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const request = store.get(attemptId);
    let next: AttemptV2Bundle;
    request.onsuccess = () => {
      if (!request.result) {
        tx.abort();
        return;
      }
      try {
        next = mutate(request.result as AttemptV2Bundle);
        store.put(next);
      } catch (error) {
        tx.abort();
        reject(error);
      }
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve(next!);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("storage_transaction_aborted"));
  });
  db.close();
  return result;
}

export function createV2Bundle(attempt: TestAttempt, testTitle: string): AttemptV2Bundle {
  if (!attempt.testVersionId || !attempt.answerDeadlineEpochMs || !attempt.uploadDeadlineEpochMs) {
    throw new Error("invalid_v2_attempt");
  }
  const nowEpoch = attempt.serverNowEpochMs ?? Date.now();
  const committed = Object.fromEntries((attempt.answers ?? []).map((answer, index) => [
    String(answer.questionId),
    { ...answer, commitId: `server-${answer.questionId}`, sequence: index + 1, committedAtMoscow: attempt.startedAtMoscow ?? moscowNowIso(nowEpoch) },
  ]));
  return {
    schemaVersion: 2,
    attemptId: attempt.attemptId,
    studentId: attempt.studentId,
    testId: attempt.testId,
    testVersionId: attempt.testVersionId,
    testTitle,
    questions: attempt.questions,
    questionOrder: attempt.questionOrder,
    currentQuestionId: attempt.questions.find((q) => !committed[String(q.questionId)])?.questionId ?? attempt.questions.at(-1)!.questionId,
    time: {
      serverNowEpochMs: nowEpoch,
      serverOffsetMs: nowEpoch - Date.now(),
      startedAtMoscow: attempt.startedAtMoscow ?? moscowNowIso(nowEpoch),
      answerDeadlineMoscow: attempt.answerDeadlineMoscow!,
      answerDeadlineEpochMs: attempt.answerDeadlineEpochMs,
      uploadDeadlineMoscow: attempt.uploadDeadlineMoscow!,
      uploadDeadlineEpochMs: attempt.uploadDeadlineEpochMs,
      lastEffectiveNowEpochMs: nowEpoch,
    },
    draftsByQuestion: {},
    committedByQuestion: committed,
    pendingCommitIds: [],
    syncSummary: { serverAnswerCount: attempt.answers.length, syncing: false, failures: 0, paused: false },
    finalSnapshot: null,
    localStatus: "active",
    updatedAtMoscow: moscowNowIso(nowEpoch),
  };
}

export function saveDraft(attemptId: string, questionId: number, draft: AnswerDraft) {
  return mutateBundle(attemptId, (bundle) => {
    if (bundle.localStatus !== "active" || bundle.committedByQuestion[String(questionId)]) return bundle;
    return {
      ...bundle,
      draftsByQuestion: { ...bundle.draftsByQuestion, [questionId]: draft },
      updatedAtMoscow: moscowNowIso(),
    };
  });
}

export function commitDraft(attemptId: string, questionId: number, nextQuestionId?: number) {
  return mutateBundle(attemptId, (bundle) => {
    if (bundle.localStatus !== "active") throw new Error("attempt_not_active");
    if (bundle.committedByQuestion[String(questionId)]) return bundle;
    const draft = bundle.draftsByQuestion[String(questionId)];
    if (!draft || !isDraftValid(draft)) throw new Error("invalid_draft");
    const sequence = Math.max(0, ...Object.values(bundle.committedByQuestion).map((item) => item.sequence)) + 1;
    const commit: AttemptCommit = {
      ...draftToStoredAnswer(questionId, draft),
      commitId: crypto.randomUUID(), sequence, committedAtMoscow: moscowNowIso(),
    };
    const drafts = { ...bundle.draftsByQuestion };
    delete drafts[String(questionId)];
    return {
      ...bundle,
      draftsByQuestion: drafts,
      committedByQuestion: { ...bundle.committedByQuestion, [questionId]: commit },
      pendingCommitIds: [...bundle.pendingCommitIds, commit.commitId],
      currentQuestionId: nextQuestionId ?? questionId,
      syncSummary: { ...bundle.syncSummary, paused: false },
      updatedAtMoscow: moscowNowIso(),
    };
  });
}

export function updateV2Time(attemptId: string, effectiveNow: number) {
  return mutateBundle(attemptId, (bundle) => ({
    ...bundle,
    time: { ...bundle.time, lastEffectiveNowEpochMs: Math.max(bundle.time.lastEffectiveNowEpochMs, effectiveNow) },
    updatedAtMoscow: moscowNowIso(effectiveNow),
  }));
}

export function reanchorV2Time(attemptId: string, serverNowEpochMs: number) {
  return mutateBundle(attemptId, (bundle) => ({
    ...bundle,
    time: {
      ...bundle.time,
      serverNowEpochMs,
      serverOffsetMs: serverNowEpochMs - Date.now(),
      lastEffectiveNowEpochMs: Math.max(bundle.time.lastEffectiveNowEpochMs, serverNowEpochMs),
    },
    updatedAtMoscow: moscowNowIso(serverNowEpochMs),
  }));
}

async function hashSnapshot(value: unknown): Promise<string> {
  const canonicalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(canonicalize);
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>)
          .filter(([, child]) => child !== undefined)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, canonicalize(child)]),
      );
    }
    return item;
  };
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(value)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sealV2Bundle(attemptId: string, reason: "manual" | "timeout", draftQuestionId?: number) {
  let bundle = await loadV2Bundle(attemptId);
  if (!bundle) throw new Error("attempt_bundle_not_found");
  if (draftQuestionId != null) {
    const draft = bundle.draftsByQuestion[String(draftQuestionId)];
    if (draft && isDraftValid(draft)) bundle = await commitDraft(attemptId, draftQuestionId);
  }
  const answers = Object.values(bundle.committedByQuestion).sort((a, b) => a.sequence - b.sequence);
  const core = {
    attemptId, testVersionId: bundle.testVersionId, answers,
    completedAtMoscow: moscowNowIso(), reason,
    answeredCount: answers.length,
    unansweredCount: Math.max(0, bundle.questions.length - answers.length),
  };
  const finalSnapshot: FinalAttemptSnapshot = { ...core, snapshotHash: await hashSnapshot(core) };
  return mutateBundle(attemptId, (current) => ({
    ...current, finalSnapshot, localStatus: "sealed_pending_upload",
    updatedAtMoscow: moscowNowIso(),
  }));
}

export function applyCommitAcks(attemptId: string, acked: string[], serverAnswerCount: number) {
  return mutateBundle(attemptId, (bundle) => ({
    ...bundle,
    pendingCommitIds: bundle.pendingCommitIds.filter((id) => !acked.includes(id)),
    syncSummary: {
      ...bundle.syncSummary, syncing: false, failures: 0, paused: false,
      serverAnswerCount, lastSuccessAtMoscow: moscowNowIso(), lastError: undefined,
    },
    updatedAtMoscow: moscowNowIso(),
  }));
}

export function updateSyncState(attemptId: string, patch: Partial<AttemptV2Bundle["syncSummary"]>) {
  return mutateBundle(attemptId, (bundle) => ({
    ...bundle, syncSummary: { ...bundle.syncSummary, ...patch }, updatedAtMoscow: moscowNowIso(),
  }));
}

export function updateLocalStatus(attemptId: string, localStatus: LocalAttemptStatus) {
  return mutateBundle(attemptId, (bundle) => ({ ...bundle, localStatus, updatedAtMoscow: moscowNowIso() }));
}
