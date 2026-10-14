import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

describe("production BFF cutover", () => {
  it("uses the configured HTTPS BFF for JSON and downloads with cookie credentials", async () => {
    vi.stubEnv("NEXT_PUBLIC_CPM_BFF_ENABLED", "1");
    vi.stubEnv("NEXT_PUBLIC_CPM_BFF_DEV", "0");
    vi.stubEnv("NEXT_PUBLIC_CPM_BFF_BASE_URL", "https://back1.cpm-lms.ru/bff/");
    vi.stubEnv("NEXT_PUBLIC_CPM_BFF_EXTERNAL_TESTS_ENABLED", "1");
    const config = await import("@/lib/config");
    expect(config.BFF_DEV).toBe(true);
    expect(config.BFF_EXTERNAL_TESTS_DEV).toBe(true);
    const blob = new Blob(["download"]);
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true }), blob: async () => blob });
    vi.stubGlobal("fetch", fetcher);
    const { bffRequest, bffBlobRequest } = await import("./client");
    await bffRequest("/auth/me", { headers: { Authorization: "Bearer must-not-leak" } });
    expect(await bffBlobRequest("/uploads/files/id/download")).toBe(blob);
    expect(fetcher.mock.calls.map(call => call[0])).toEqual([
      "https://back1.cpm-lms.ru/bff/auth/me",
      "https://back1.cpm-lms.ru/bff/uploads/files/id/download",
    ]);
    for (const [, options] of fetcher.mock.calls) {
      expect(options.credentials).toBe("include");
      expect(options.headers.has("Authorization")).toBe(false);
      expect(options.headers.get("X-CPM-Request")).toBe("1");
    }
  });

  it("does not enable the local rewrite or development CSP in a production build", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CPM_BFF_DEV", "1");
    const { default: config } = await import("@/next.config");
    expect(config.distDir).toBe(".next");
    expect(await config.rewrites!()).toEqual([]);
    expect(await config.headers!()).toEqual([]);
  });
});
