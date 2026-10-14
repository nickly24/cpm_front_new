// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./student-deletion-api";
import { jobFixture } from "./student-deletion-test-fixtures";
import { DELETION_POLL_MS, deletionStorageKey, useStudentDeletionJobs } from "./use-student-deletion-jobs";
import type { StudentDeletionJob } from "./student-deletion";

vi.mock("./student-deletion-api", () => ({
  fetchStudentDeletionJob: vi.fn(), fetchStudentDeletionJobs: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function storeJob(owner: string, job: StudentDeletionJob) {
  localStorage.setItem(deletionStorageKey(owner), JSON.stringify([
    { student_id: job.student_id, job_id: job.id, idempotency_key: `key:${job.id}` },
  ]));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  localStorage.clear();
  vi.mocked(api.fetchStudentDeletionJob).mockResolvedValue(jobFixture);
  vi.mocked(api.fetchStudentDeletionJobs).mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("student deletion monitoring lifecycle", () => {
  it("clears another administrator's state and restores their own operations", async () => {
    const first = { ...jobFixture, status: "completed" as const, percent: 100 };
    const second = { ...jobFixture, id: "other-owner-job", student: { ...jobFixture.student, name: "Другой администратор" } };
    storeJob("admin:1", first);
    storeJob("admin:2", second);
    vi.mocked(api.fetchStudentDeletionJob).mockImplementation(async (id) => id === first.id ? first : second);
    const completed = vi.fn();
    const { result, rerender } = renderHook(({ owner }) => useStudentDeletionJobs(owner, completed), {
      initialProps: { owner: "admin:1" },
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.jobs).toEqual([first]);

    rerender({ owner: "admin:2" });
    expect(result.current.jobs).toEqual([]);
    expect(result.current.saved).toEqual([]);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(api.fetchStudentDeletionJob).toHaveBeenCalledWith(second.id);
    expect(result.current.jobs).toEqual([second]);
    expect(result.current.errors).toEqual({});
    expect(completed).toHaveBeenCalledExactlyOnceWith(42);
  });

  it("ignores a stale accepted POST callback after switching administrators", async () => {
    const completed = vi.fn();
    const { result, rerender } = renderHook(({ owner }) => useStudentDeletionJobs(owner, completed), {
      initialProps: { owner: "admin:1" },
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const oldAccepted = result.current.acceptJob;
    const oldPending = result.current.rememberPending;
    rerender({ owner: "admin:2" });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    act(() => {
      oldPending(42, "old-post-key");
      oldAccepted({ ...jobFixture, status: "completed", percent: 100 });
    });
    expect(result.current.jobs).toEqual([]);
    expect(result.current.saved).toEqual([]);
    expect(localStorage.getItem(deletionStorageKey("admin:2"))).toBeNull();
    expect(completed).not.toHaveBeenCalled();
  });

  it("does not reactivate an old callback when returning to the same account", async () => {
    const completed = vi.fn();
    const { result, rerender } = renderHook(({ owner }) => useStudentDeletionJobs(owner, completed), {
      initialProps: { owner: "admin:1" },
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const oldAccepted = result.current.acceptJob;
    rerender({ owner: "admin:2" });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    rerender({ owner: "admin:1" });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    act(() => { oldAccepted({ ...jobFixture, status: "completed", percent: 100 }); });
    expect(result.current.saved).toEqual([]);
    expect(result.current.jobs).toEqual([]);
    expect(completed).not.toHaveBeenCalled();
  });

  it("ignores a late accepted POST after the monitor unmounts", async () => {
    const completed = vi.fn();
    const { result, unmount } = renderHook(() => useStudentDeletionJobs("admin:1", completed));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const oldAccepted = result.current.acceptJob;
    unmount();
    act(() => { oldAccepted({ ...jobFixture, status: "completed", percent: 100 }); });
    expect(localStorage.getItem(deletionStorageKey("admin:1"))).toBeNull();
    expect(completed).not.toHaveBeenCalled();
  });

  it("does not restore a pending operation forgotten while its GET was in flight", async () => {
    const pending = deferred<StudentDeletionJob[]>();
    vi.mocked(api.fetchStudentDeletionJobs).mockReturnValue(pending.promise);
    const completed = vi.fn();
    const { result } = renderHook(() => useStudentDeletionJobs("admin:1", completed));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    act(() => { result.current.rememberPending(42, "rejected-post-key"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(DELETION_POLL_MS); });
    expect(api.fetchStudentDeletionJobs).toHaveBeenCalledWith(42);
    act(() => { result.current.forget(42); });
    await act(async () => { pending.resolve([{ ...jobFixture, status: "completed", percent: 100 }]); });
    expect(result.current.saved).toEqual([]);
    expect(result.current.jobs).toEqual([]);
    expect(completed).not.toHaveBeenCalled();
  });

  it("does not show a late GET error for a forgotten pending operation", async () => {
    const pending = deferred<StudentDeletionJob[]>();
    vi.mocked(api.fetchStudentDeletionJobs).mockReturnValue(pending.promise);
    const completed = vi.fn();
    const { result } = renderHook(() => useStudentDeletionJobs("admin:1", completed));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    act(() => { result.current.rememberPending(42, "rejected-post-key"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(DELETION_POLL_MS); });
    act(() => { result.current.forget(42); });
    await act(async () => { pending.reject(new Error("Late polling failure")); });
    expect(result.current.errors).toEqual({});
  });

  it("keeps the same pending key until a lost POST is recovered by later polling", async () => {
    const completed = vi.fn();
    const { result } = renderHook(() => useStudentDeletionJobs("admin:1", completed));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    act(() => { result.current.rememberPending(42, "original-post-key"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(DELETION_POLL_MS); });
    expect(result.current.saved).toEqual([{ student_id: 42, job_id: null, idempotency_key: "original-post-key" }]);
    vi.mocked(api.fetchStudentDeletionJobs).mockResolvedValue([jobFixture]);
    await act(async () => { await vi.advanceTimersByTimeAsync(DELETION_POLL_MS); });
    expect(result.current.jobs).toEqual([jobFixture]);
    expect(result.current.saved).toEqual([{ student_id: 42, job_id: jobFixture.id, idempotency_key: "original-post-key" }]);
  });
});
