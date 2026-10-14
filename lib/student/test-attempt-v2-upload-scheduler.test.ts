import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/config", () => ({ BFF_DEV: false }));
vi.mock("./test-attempt-v2-events", () => ({ announceAttemptChange: vi.fn() }));
import type { AttemptV2Bundle } from "./test-attempt-v2-store";
import { createOfficialUploadScheduler } from "./test-attempt-v2-upload-scheduler";

let disposers: (() => void)[];
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10_000); disposers = []; });
afterEach(() => { disposers.forEach(dispose => dispose()); vi.useRealTimers(); });
function pending(deadline = Date.now() + 60_000) {
  return { attemptId: "attempt", localStatus: "sealed_pending_upload", finalSnapshot: {},
    time: { serverOffsetMs: 0, lastEffectiveNowEpochMs: Date.now(), uploadDeadlineEpochMs: deadline },
  } as unknown as AttemptV2Bundle;
}
function setup(initial = pending(), random = () => 0) {
  let state: AttemptV2Bundle | null = initial;
  let connected = true;
  const events = new EventTarget();
  const send = vi.fn(async () => { state = state && { ...state, localStatus: "uploaded" }; });
  const expire = vi.fn(async () => { state = state && { ...state, localStatus: "upload_window_closed" }; });
  const onError = vi.fn();
  const read = vi.fn(async () => state);
  const scheduler = createOfficialUploadScheduler({ read, send, expire, onError, online: () => connected, events, random });
  disposers.push(scheduler.dispose);
  scheduler.update(state);
  return { scheduler, send, expire, onError, read, events,
    get state() { return state; }, set state(value) { state = value; },
    offline() { connected = false; events.dispatchEvent(new Event("offline")); },
    online() { connected = true; events.dispatchEvent(new Event("online")); },
  };
}
describe("automatic official delivery lifecycle", () => {
  it("does not postpone delivery on repeated renders/storage broadcasts", async () => {
    const harness = setup();
    await vi.advanceTimersByTimeAsync(200);
    for (let i = 0; i < 20; i++) harness.scheduler.update({ ...harness.state! });
    await vi.advanceTimersByTimeAsync(49);
    expect(harness.send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(harness.send).toHaveBeenCalledTimes(1);
    expect(harness.expire).not.toHaveBeenCalled();
  });
  it("spreads recovery, ignores repeated online events and resumes without a confirmation", async () => {
    const harness = setup(pending(), () => 0.5);
    harness.offline();
    await vi.advanceTimersByTimeAsync(2000);
    expect(harness.send).not.toHaveBeenCalled();
    harness.online();
    await vi.advanceTimersByTimeAsync(100);
    harness.online(); harness.scheduler.update(harness.state);
    await vi.advanceTimersByTimeAsync(7899);
    expect(harness.send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.send).toHaveBeenCalledTimes(1);
  });
  it("preserves a server/backoff deadline across reload and network recovery", async () => {
    const bundle = { ...pending(), finalUpload: { failures: 3, paused: false, nextAttemptEpochMs: 30_000 } };
    const harness = setup(bundle);
    harness.offline(); harness.online();
    await vi.advanceTimersByTimeAsync(19_999);
    expect(harness.send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.send).toHaveBeenCalledTimes(1);
  });
  it("keeps transient failures retrying throughout the window with the saved schedule", async () => {
    const harness = setup();
    harness.send.mockImplementationOnce(async () => {
      harness.state = { ...harness.state!, finalUpload: { failures: 1, paused: false, nextAttemptEpochMs: Date.now() + 4000 } };
    });
    await vi.advanceTimersByTimeAsync(250);
    expect(harness.send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3999);
    expect(harness.send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.send).toHaveBeenCalledTimes(2);
    expect(harness.state?.localStatus).toBe("uploaded");
  });
  it("backs off unexpected errors that could not be saved in IndexedDB", async () => {
    const harness = setup();
    harness.send.mockRejectedValueOnce(new Error("storage_error"));
    await vi.advanceTimersByTimeAsync(250);
    expect(harness.send).toHaveBeenCalledTimes(1);
    expect(harness.onError).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2999);
    expect(harness.send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.send).toHaveBeenCalledTimes(2);
  });
  it("retains backoff for a pre-upgrade bundle without a stored retry timestamp", async () => {
    const harness = setup({ ...pending(), finalUpload: { failures: 2, paused: false } });
    await vi.advanceTimersByTimeAsync(5999);
    expect(harness.send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.send).toHaveBeenCalledTimes(1);
  });
  it("never resumes a paused validation/authentication error on recovery", async () => {
    const harness = setup({ ...pending(), finalUpload: { failures: 1, paused: true } });
    harness.offline(); harness.online();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(harness.send).not.toHaveBeenCalled();
    harness.state = { ...harness.state!, finalUpload: { failures: 1, paused: false } };
    harness.scheduler.update(harness.state);
    await vi.advanceTimersByTimeAsync(3000);
    expect(harness.send).toHaveBeenCalledTimes(1);
  });
  it("rechecks shared state when the other tab paused or completed the upload", async () => {
    const paused = setup();
    paused.state = { ...paused.state!, finalUpload: { failures: 1, paused: true } };
    const delivered = setup(); delivered.state = { ...delivered.state!, localStatus: "uploaded" };
    await vi.advanceTimersByTimeAsync(2000);
    expect(paused.send).not.toHaveBeenCalled();
    expect(delivered.send).not.toHaveBeenCalled();
  });
  it("does not start two deliveries while one asynchronous request is running", async () => {
    const harness = setup();
    let release!: () => void;
    harness.send.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => { release = resolve; });
      harness.state = { ...harness.state!, localStatus: "uploaded" };
    });
    await vi.advanceTimersByTimeAsync(250);
    for (let i = 0; i < 5; i++) harness.scheduler.update(harness.state);
    harness.offline(); harness.online();
    await vi.advanceTimersByTimeAsync(5000);
    expect(harness.send).toHaveBeenCalledTimes(1);
    release(); await vi.advanceTimersByTimeAsync(0);
    expect(harness.onError).not.toHaveBeenCalled();
  });
  it("expires offline and does not send past the deadline even if backoff is longer", async () => {
    const harness = setup({ ...pending(11_000), finalUpload: { failures: 1, paused: false, nextAttemptEpochMs: 11_000 } });
    harness.offline();
    await vi.advanceTimersByTimeAsync(1000);
    expect(harness.expire).toHaveBeenCalledTimes(1);
    expect(harness.state?.localStatus).toBe("upload_window_closed");
    harness.online(); await vi.advanceTimersByTimeAsync(5000);
    expect(harness.send).not.toHaveBeenCalled();
  });
  it("clears listeners/timers when unmounted and suppresses a pending recovery read", async () => {
    const harness = setup();
    harness.offline(); harness.online(); harness.scheduler.dispose();
    await vi.advanceTimersByTimeAsync(100_000);
    expect(harness.send).not.toHaveBeenCalled();
    expect(harness.expire).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
