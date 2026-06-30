import { ApiError } from "@/lib/api/client";
import { syncTestAttemptAnswersBatch } from "@/lib/student/test-attempt-api";
import {
  addPendingQuestionId,
  loadAttemptBundle,
  removePendingQuestionIds,
  saveAttemptBundle,
  upsertLocalAnswer,
} from "@/lib/student/test-attempt-store";
import type { AnswerDraft } from "@/lib/student/test-attempt-types";
import {
  draftToStoredAnswer,
  isDraftValid,
} from "@/lib/student/test-attempt-utils";
import type { TestAttempt } from "@/lib/student/test-attempt-types";
import { mergeAttemptFromServer } from "@/lib/student/test-attempt-utils";

export type SyncResult = {
  attempt: TestAttempt;
  pendingQuestionIds: number[];
  hadErrors: boolean;
};

async function getCurrentBundleState(
  attemptId: string,
  fallbackAttempt: TestAttempt,
  fallbackPendingQuestionIds: number[],
): Promise<SyncResult> {
  const current = await loadAttemptBundle(attemptId);
  return {
    attempt: current?.attempt ?? fallbackAttempt,
    pendingQuestionIds: current?.pendingQuestionIds ?? fallbackPendingQuestionIds,
    hadErrors: true,
  };
}

export async function flushPendingAnswers(
  attemptId: string,
  localAttempt?: TestAttempt | null,
): Promise<SyncResult | null> {
  const bundle = await loadAttemptBundle(attemptId);
  const sourceAttempt = bundle?.attempt ?? localAttempt;
  if (!sourceAttempt) {
    return null;
  }

  const pendingQuestionIds = bundle?.pendingQuestionIds ?? [];
  if (pendingQuestionIds.length === 0) {
    return {
      attempt: sourceAttempt,
      pendingQuestionIds: [],
      hadErrors: false,
    };
  }

  const pendingSet = new Set(pendingQuestionIds);
  const toSend = sourceAttempt.answers.filter((answer) =>
    pendingSet.has(answer.questionId),
  );

  if (toSend.length === 0) {
    return getCurrentBundleState(attemptId, sourceAttempt, pendingQuestionIds);
  }

  try {
    const response = await syncTestAttemptAnswersBatch(attemptId, toSend);
    if (!response.attempt) {
      return getCurrentBundleState(attemptId, sourceAttempt, pendingQuestionIds);
    }

    const latest = await loadAttemptBundle(attemptId);
    const baseAttempt = latest?.attempt ?? sourceAttempt;
    const latestPendingQuestionIds =
      latest?.pendingQuestionIds ?? pendingQuestionIds;
    let merged = mergeAttemptFromServer(baseAttempt, response.attempt);
    const syncedIds = [
      ...(response.syncedQuestionIds ?? []),
      ...(response.skippedQuestionIds ?? []),
    ];
    const afterSync = removePendingQuestionIds(
      latestPendingQuestionIds,
      syncedIds,
    );

    const failedIds = (response.errors ?? [])
      .map((item) => item.questionId)
      .filter((id): id is number => id != null);
    const nextPending = failedIds.length
      ? [...new Set([...afterSync, ...failedIds])]
      : afterSync;

    const nextPendingSet = new Set(nextPending);
    for (const answer of baseAttempt.answers) {
      if (
        nextPendingSet.has(answer.questionId) &&
        !merged.answers.some((item) => item.questionId === answer.questionId)
      ) {
        merged = upsertLocalAnswer(merged, answer);
      }
    }

    await saveAttemptBundle({
      attempt: merged,
      pendingQuestionIds: nextPending,
      updatedAt: Date.now(),
    });

    return {
      attempt: merged,
      pendingQuestionIds: nextPending,
      hadErrors: Boolean(response.errors?.length) || !response.success,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      const refreshed = await loadAttemptBundle(attemptId);
      if (refreshed?.attempt) {
        return {
          attempt: mergeAttemptFromServer(sourceAttempt, refreshed.attempt),
          pendingQuestionIds: refreshed.pendingQuestionIds,
          hadErrors: true,
        };
      }
    }
    return getCurrentBundleState(attemptId, sourceAttempt, pendingQuestionIds);
  }
}

export type AttemptBundleState = {
  attempt: TestAttempt;
  pendingQuestionIds: number[];
};

/** Актуальное состояние из IndexedDB + необязательный черновик текущего вопроса. */
export async function resolveAttemptBundleState(
  attemptId: string,
  fallback: AttemptBundleState,
  draftPayload?: {
    questionId: number;
    draft: AnswerDraft;
    timeExpired: boolean;
  } | null,
): Promise<AttemptBundleState> {
  const bundle = await loadAttemptBundle(attemptId);
  let attempt = bundle?.attempt ?? fallback.attempt;
  let pendingQuestionIds =
    bundle?.pendingQuestionIds ?? fallback.pendingQuestionIds;

  if (draftPayload && !draftPayload.timeExpired) {
    const { questionId, draft } = draftPayload;
    if (isDraftValid(draft)) {
      const stored = draftToStoredAnswer(questionId, draft);
      const already = attempt.answers.find(
        (answer) => answer.questionId === questionId,
      );
      const needsWrite =
        !already ||
        JSON.stringify(already) !== JSON.stringify(stored);
      if (needsWrite) {
        attempt = upsertLocalAnswer(attempt, stored);
        pendingQuestionIds = addPendingQuestionId(
          pendingQuestionIds,
          questionId,
        );
      }
    }
  }

  await saveAttemptBundle({
    attempt,
    pendingQuestionIds,
    updatedAt: Date.now(),
  });

  return { attempt, pendingQuestionIds };
}

export async function persistBundle(
  attempt: TestAttempt,
  pendingQuestionIds: number[],
): Promise<void> {
  await saveAttemptBundle({
    attempt,
    pendingQuestionIds,
    updatedAt: Date.now(),
  });
}
