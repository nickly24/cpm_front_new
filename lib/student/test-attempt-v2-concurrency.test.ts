import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
vi.mock("@/lib/config", () => ({ BFF_DEV: false }));
vi.mock("./test-attempt-v2-events", () => ({ announceAttemptChange: vi.fn() }));
import { commitDraft, createV2Bundle, loadV2Bundle, saveDraft, saveV2Bundle, sealV2Bundle, updateLocalStatus } from "./test-attempt-v2-store";
import type { TestAttempt } from "./test-attempt-types";

function initial() {
  const now = Date.now();
  return createV2Bundle({ attemptId: "shared", testId: "test", testVersionId: "version",
    status: "in_progress", remainingSeconds: 60, timeExpired: false, answeredCount: 0, totalQuestions: 2,
    serverNowEpochMs: now, answerDeadlineEpochMs: now + 60_000, uploadDeadlineEpochMs: now + 86400_000,
    answers: [], questionOrder: [1,2], questions: [
      {questionId: 1, type: "single", locked: false, text: "Choose", answers: [{id:"a",text:"A"},{id:"b",text:"B"}]},
      {questionId: 2, type: "text", locked: false, text: "City"},
    ],
  } as TestAttempt, "Test");
}
beforeEach(() => { vi.stubGlobal("indexedDB", new IDBFactory()); });
describe("same attempt in two tabs", () => {
  it("a second start cannot overwrite a locked answer or final snapshot", async () => {
    const stale = initial();
    await saveV2Bundle(stale);
    await saveDraft("shared",1,{type:"single",selectedAnswer:"b"});
    await commitDraft("shared",1,2);
    const sealed = await sealV2Bundle("shared","manual");
    const resumed = await saveV2Bundle(stale);
    expect(resumed.finalSnapshot).toEqual(sealed.finalSnapshot);
    expect(resumed.committedByQuestion[1].selectedAnswer).toBe("b");
  });
  it("a stale writer cannot change a committed answer", async () => {
    await saveV2Bundle(initial());
    await saveDraft("shared",1,{type:"single",selectedAnswer:"b"});
    await commitDraft("shared",1,2);
    await saveDraft("shared",1,{type:"single",selectedAnswer:"a"});
    const next = await commitDraft("shared",1,2);
    expect(next.committedByQuestion[1].selectedAnswer).toBe("b");
    expect(next.draftsByQuestion[1]).toBeUndefined();
  });
  it("concurrent finalizations freeze one snapshot and prevent subsequent commits", async () => {
    await saveV2Bundle(initial());
    await saveDraft("shared",1,{type:"single",selectedAnswer:"a"});
    const [first, second] = await Promise.all([
      sealV2Bundle("shared","manual",1), sealV2Bundle("shared","timeout",1),
    ]);
    expect(first.finalSnapshot).toEqual(second.finalSnapshot);
    expect(first.finalSnapshot?.answers).toHaveLength(1);
    await expect(commitDraft("shared",2)).rejects.toThrow("attempt_not_active");
  });
  it("late upload failure cannot reopen an already delivered attempt", async () => {
    await saveV2Bundle(initial());
    await sealV2Bundle("shared","manual");
    await updateLocalStatus("shared","uploaded");
    await updateLocalStatus("shared","sealed_pending_upload");
    expect((await loadV2Bundle("shared"))?.localStatus).toBe("uploaded");
  });
});
