import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const effect = vi.hoisted(() => ({ cleanup: undefined as undefined | (() => void) }));
vi.mock("react", () => ({ useEffect: (callback: () => void | (() => void)) => { effect.cleanup = callback() || undefined; } }));
vi.mock("@/lib/config", () => ({ BFF_DEV: true }));
import { useContextGuard } from "./use-context-guard";

describe("context guard lifecycle", () => {
  let granted: () => void | Promise<void>;
  let signal: AbortSignal;
  const request = vi.fn();
  beforeEach(() => {
    effect.cleanup = undefined;
    request.mockReset().mockImplementation((_name: string, options: { signal: AbortSignal }, callback: () => void | Promise<void>) => {
      signal = options.signal;
      granted = callback;
      return Promise.resolve();
    });
    vi.stubGlobal("navigator", { locks: { request } });
    vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });
  afterEach(() => { effect.cleanup?.(); vi.unstubAllGlobals(); });

  it("releases an already granted lock when the editor closes", async () => {
    useContextGuard(true);
    const held = granted();
    expect(held).toBeInstanceOf(Promise);
    effect.cleanup?.();
    await held;
    expect(signal.aborted).toBe(true);
  });

  it("does not hold a late granted lock after cleanup", () => {
    useContextGuard(true);
    effect.cleanup?.();
    // The grant won the abort race, but its callback runs after React cleanup.
    expect(granted()).toBeUndefined();
    expect(signal.aborted).toBe(true);
  });

  it("leaves read-only lists free to switch context", () => {
    useContextGuard(false);
    expect(request).not.toHaveBeenCalled();
  });
});
