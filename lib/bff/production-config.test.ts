import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

describe("production BFF cutover", () => {
  it("uses same-origin BFF in production even without flags", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CPM_BFF_ENABLED", "0");
    vi.stubEnv("NEXT_PUBLIC_CPM_BFF_DEV", "0");
    vi.stubEnv("NEXT_PUBLIC_CPM_BFF_BASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_CPM_BFF_EXTERNAL_TESTS_ENABLED", "0");
    vi.stubEnv("NEXT_PUBLIC_CPM_BFF_EXTERNAL_TESTS_DEV", "0");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://legacy.invalid");
    const config = await import("@/lib/config");
    expect(config.BFF_DEV).toBe(true);
    expect(config.BFF_EXTERNAL_TESTS_DEV).toBe(true);
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true }) });
    vi.stubGlobal("fetch", fetcher);
    const { bffRequest } = await import("./client");
    await bffRequest("/auth/me");
    expect(fetcher.mock.calls[0][0]).toBe("/bff/auth/me");
    expect(fetcher.mock.calls[0][1].credentials).toBe("include");
  });

  it("ignores stale external addresses in production for JSON and downloads", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CPM_BFF_ENABLED", "1");
    vi.stubEnv("NEXT_PUBLIC_CPM_BFF_DEV", "0");
    vi.stubEnv("NEXT_PUBLIC_CPM_BFF_BASE_URL", "https://back1.cpm-lms.ru:8443/bff/");
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
      "/bff/auth/me",
      "/bff/uploads/files/id/download",
    ]);
    for (const [, options] of fetcher.mock.calls) {
      expect(options.credentials).toBe("include");
      expect(options.headers.has("Authorization")).toBe(false);
      expect(options.headers.get("X-CPM-Request")).toBe("1");
    }
  });

  it("uses only the SSH loopback proxy and no development CSP in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CPM_BFF_DEV", "1");
    const { default: config } = await import("@/next.config");
    expect(config.distDir).toBe(".next");
    expect(await config.rewrites!()).toEqual([{ source: "/bff/:path*", destination: "http://127.0.0.1:19445/bff/:path*" }]);
    expect(await config.headers!()).toEqual([]);
  });
});
