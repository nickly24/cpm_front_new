import type { StoredAttemptAnswer, TestAttempt } from "./test-attempt-types";

const DB_NAME = "cpm_test_attempts";
const DB_VERSION = 1;
const STORE = "bundles";

export interface AttemptBundle {
  attempt: TestAttempt;
  pendingQuestionIds: number[];
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "attemptId" });
      }
    };
  });
}

export async function saveAttemptBundle(bundle: AttemptBundle): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({
      attemptId: bundle.attempt.attemptId,
      ...bundle,
    });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAttemptBundle(
  attemptId: string,
): Promise<AttemptBundle | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(attemptId);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as AttemptBundle | undefined) ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAttemptBundle(attemptId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(attemptId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export function upsertLocalAnswer(
  attempt: TestAttempt,
  answer: StoredAttemptAnswer,
): TestAttempt {
  const others = attempt.answers.filter(
    (item) => item.questionId !== answer.questionId,
  );
  const answers = [...others, answer];
  const answeredIds = new Set(answers.map((item) => item.questionId));
  const questions = attempt.questions.map((question) => ({
    ...question,
    locked: answeredIds.has(question.questionId),
  }));

  return {
    ...attempt,
    answers,
    answeredCount: answers.length,
    questions,
  };
}

export function addPendingQuestionId(
  pending: number[],
  questionId: number,
): number[] {
  if (pending.includes(questionId)) {
    return pending;
  }
  return [...pending, questionId];
}

export function removePendingQuestionIds(
  pending: number[],
  questionIds: number[],
): number[] {
  const remove = new Set(questionIds);
  return pending.filter((id) => !remove.has(id));
}
