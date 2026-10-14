import { afterEach, describe, expect, it, vi } from "vitest";
import { bffBlobRequest, bffRequest } from "./client";
afterEach(() => vi.unstubAllGlobals());
describe("local BFF boundary", () => {
  it("downloads binary data through the same cookie boundary without forwarding a bearer", async () => {
    const blob = new Blob(["file"]), fetcher = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob }); vi.stubGlobal("fetch", fetcher);
    expect(await bffBlobRequest("/uploads/files/id/download", { headers: { Authorization: "Bearer must-not-leak" } })).toBe(blob);
    expect(fetcher.mock.calls[0][0]).toBe("/bff/uploads/files/id/download"); expect(fetcher.mock.calls[0][1].headers.has("Authorization")).toBe(false);
    expect(fetcher.mock.calls[0][1].credentials).toBe("include");
  });
  it("keeps download access errors as JSON failures without treating them as file bytes", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: "owner_access_denied" }) }); vi.stubGlobal("fetch", fetcher);
    await expect(bffBlobRequest("/uploads/files/id/download")).rejects.toMatchObject({ status: 403, code: "owner_access_denied" });
  });
  it("never forwards an injected bearer or a remote URL", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true }) });
    vi.stubGlobal("fetch", fetcher);
    await bffRequest("/homework/types", { headers: { Authorization: "Bearer must-not-leak" } });
    expect(fetcher.mock.calls[0][0]).toBe("/bff/homework/types");
    const options = fetcher.mock.calls[0][1];
    expect(options.credentials).toBe("include"); expect(options.headers.has("Authorization")).toBe(false);
    await expect(bffRequest("https://example.invalid")).rejects.toThrow("Недопустимый"); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("leaves the multipart boundary to fetch even with an inherited JSON header", async () => {
    vi.stubGlobal("navigator", {});
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true }) });
    vi.stubGlobal("fetch", fetcher);
    const form = new FormData(); form.append("file", new Blob(["student,grade\n91,3"], { type: "text/csv" }), "results.csv");
    await bffRequest("/exams/15/imports/outside", { method: "POST", body: form, headers: { "Content-Type": "application/json", "Idempotency-Key": "c9f17869-bc18-4bdb-8a1e-315a39c7d718", Authorization: "Bearer must-not-leak" } });
    const options = fetcher.mock.calls[0][1];
    expect(options.body).toBe(form); expect(options.headers.has("Content-Type")).toBe(false);
    expect(options.headers.has("Authorization")).toBe(false); expect(options.headers.get("Idempotency-Key")).toBe("c9f17869-bc18-4bdb-8a1e-315a39c7d718");
    expect(options.credentials).toBe("include"); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("still uses JSON content type for regular command bodies", async () => {
    vi.stubGlobal("navigator", {});
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true }) }); vi.stubGlobal("fetch", fetcher);
    await bffRequest("/exams/15/training", { method: "PUT", body: '{"training_enabled":true,"expected_revision":3}' });
    expect(fetcher.mock.calls[0][1].headers.get("Content-Type")).toBe("application/json");
  });
  it("marks a lost command response as uncertain without replaying the mutation", async () => {
    vi.stubGlobal("navigator", {});
    const fetcher = vi.fn().mockRejectedValue(new TypeError("fetch failed")); vi.stubGlobal("fetch", fetcher);
    await expect(bffRequest("/exams/15/copy", { method: "POST", body: "{}", headers: { "Idempotency-Key": "c9f17869-bc18-4bdb-8a1e-315a39c7d718" } })).rejects.toMatchObject({ status: 0, code: "transport_error" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("preserves a confirmed conflict instead of treating it as transport uncertainty", async () => {
    vi.stubGlobal("navigator", {});
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "version_conflict" }) }); vi.stubGlobal("fetch", fetcher);
    await expect(bffRequest("/exams/15/training", { method: "PUT", body: "{}" })).rejects.toMatchObject({ status: 409, code: "version_conflict" }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("exposes Retry-After without replaying an uncertain mutation", async () => {
    vi.stubGlobal("navigator", {});
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 429, headers: new Headers({ "Retry-After": "120" }), json: async () => ({ error: "overloaded" }) });
    vi.stubGlobal("fetch", fetcher);
    await expect(bffRequest("/tests/attempts/attempt/finalize", { method: "POST", body: "{}" })).rejects.toMatchObject({ status: 429, code: "overloaded", retryAfterMs: 120_000 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
