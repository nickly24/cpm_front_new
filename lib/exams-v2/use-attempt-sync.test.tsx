// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("./api", () => ({ examGet: get }));
import { useAttemptSync } from "./use-attempt-sync";
const digest = { id: 2, stateVersion: 1, ovRevision: 0, serverNow: "2026-11-13T09:00:00Z" };
const base = { path: "/api/examiner/exams/1/attempts/2/state", stateVersion: 1, ovRevision: 0, suspended: false };
const advance = async (ms = 3500) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => { vi.useFakeTimers(); get.mockReset().mockResolvedValue(digest); Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("bounded visible workspace synchronization", () => {
  it("polls a small state and reloads only when state or OV advances", async () => {
    const changed = vi.fn();
    const { rerender } = renderHook(props => useAttemptSync(props), { initialProps: { ...base, onChange: changed } });
    expect(get).not.toHaveBeenCalled();
    await advance();
    expect(get).toHaveBeenCalledTimes(1); expect(changed).not.toHaveBeenCalled();
    get.mockResolvedValue({ ...digest, ovRevision: 1 });
    await advance(); expect(changed).toHaveBeenCalledTimes(1);
    rerender({ ...base, ovRevision: 1, onChange: changed });
    await advance(); expect(changed).toHaveBeenCalledTimes(1);
    get.mockResolvedValue({ ...digest, ovRevision: 1, stateVersion: 2 });
    await advance(); expect(changed).toHaveBeenCalledTimes(2);
  });
  it("stops while a command or edit is pending and while hidden", async () => {
    const changed = vi.fn();
    const { rerender } = renderHook(props => useAttemptSync(props), { initialProps: { ...base, suspended: true, onChange: changed } });
    await advance(15000); expect(get).not.toHaveBeenCalled();
    rerender({ ...base, suspended: false, onChange: changed });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await advance(15000); expect(get).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(get).toHaveBeenCalledTimes(1);
  });
  it("refreshes changed settings and window boundaries without a new attempt version", async () => {
    const changed = vi.fn();
    get.mockResolvedValue({ ...digest, workspaceRevision: "config-1:before-window" });
    const { rerender } = renderHook(props => useAttemptSync(props), { initialProps: { ...base, workspaceRevision: "config-1:before-window", onChange: changed } });
    await advance(); expect(changed).not.toHaveBeenCalled();
    get.mockResolvedValue({ ...digest, workspaceRevision: "config-2:before-window" });
    await advance(); expect(changed).toHaveBeenCalledTimes(1);
    rerender({ ...base, workspaceRevision: "config-2:before-window", onChange: changed });
    await advance(); expect(changed).toHaveBeenCalledTimes(1);
    get.mockResolvedValue({ ...digest, workspaceRevision: "config-2:inside-window" });
    await advance(); expect(changed).toHaveBeenCalledTimes(2);
    rerender({ ...base, workspaceRevision: "config-2:inside-window", onChange: changed });
    await advance(); expect(changed).toHaveBeenCalledTimes(2);
  });
  it("refreshes once when a legacy workspace lacks the digest token", async () => {
    const changed = vi.fn();
    get.mockResolvedValue({ ...digest, workspaceRevision: "config-1" });
    renderHook(() => useAttemptSync({ ...base, onChange: changed }));
    await advance(); expect(changed).toHaveBeenCalledTimes(1);
    await advance(); expect(changed).toHaveBeenCalledTimes(1);
    get.mockResolvedValue({ ...digest, workspaceRevision: "config-2" });
    await advance(); expect(changed).toHaveBeenCalledTimes(2);
  });
  it("keeps at most one request in flight and aborts it on navigation", async () => {
    get.mockImplementation(() => new Promise(() => {}));
    const { unmount } = renderHook(() => useAttemptSync({ ...base, onChange: vi.fn() }));
    await advance(); await advance(30000); expect(get).toHaveBeenCalledTimes(1);
    const signal = get.mock.calls[0][2] as AbortSignal;
    unmount(); expect(signal.aborted).toBe(true);
  });
  it("backs off transport failures and stops polling after access is revoked", async () => {
    get.mockRejectedValue(new ApiError("Unavailable", 503));
    const { result } = renderHook(() => useAttemptSync({ ...base, onChange: vi.fn() }));
    await advance(); expect(result.current.error).toBeInstanceOf(ApiError);
    await advance(3000); expect(get).toHaveBeenCalledTimes(1);
    get.mockRejectedValue(new ApiError("Forbidden", 403));
    await advance(4000); expect(get).toHaveBeenCalledTimes(2);
    await advance(90000); expect(get).toHaveBeenCalledTimes(2);
  });
});
