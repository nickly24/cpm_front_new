import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiFormRequest,
  apiRequest,
  ApiError,
  responseError,
} from "@/lib/api/client";
import { examGet, examMutate, parseExamImport, attemptCommand } from "./api";
import { isUncertain } from "./hooks";

vi.mock("@/lib/auth/storage", () => ({ getToken: () => "offline-test-token" }));
const fetchMock = vi.fn<typeof fetch>();
const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("exam transport contracts — no network", () => {
  it("unwraps only v2 data, fetches no-store and sends auth", async () => {
    fetchMock.mockResolvedValue(ok({ items: [] }));
    expect(await examGet("/api/exams", { grade: 0 })).toEqual({ items: [] });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/exams?grade=0");
    expect(options?.cache).toBe("no-store");
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      "Bearer offline-test-token",
    );
  });
  it("rejects an incompatible legacy success payload", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: true, exams: [] })),
    );
    await expect(examGet("/api/exams")).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
  it("sends stable idempotency and CAS values without changing payload", async () => {
    fetchMock.mockImplementation(async () =>
      ok({ receipt: { commandId: 7 }, attempt: { id: 8 } }),
    );
    const command = {
      path: "/api/exams/3/classic/config",
      method: "PATCH" as const,
      body: { startAt: null, expectedConfigVersion: 4 },
      key: "c28be609-0a52-4f8d-a7fa-c68920220f55",
    };
    await examMutate(command);
    await examMutate(command);
    const first = fetchMock.mock.calls[0][1],
      second = fetchMock.mock.calls[1][1];
    expect(new Headers(first?.headers).get("Idempotency-Key")).toBe(
      command.key,
    );
    expect(first?.body).toBe(second?.body);
    expect(new Headers(second?.headers).get("Idempotency-Key")).toBe(
      command.key,
    );
  });
  it("handles 204 physical delete and keeps confirmation out of URL", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(
      examMutate({
        path: "/api/exams/3",
        method: "DELETE",
        key: "same-key",
        confirmationToken: "signed-preview",
      }),
    ).resolves.toBeUndefined();
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("signed-preview");
    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).get(
        "X-Exam-Confirmation",
      ),
    ).toBe("signed-preview");
  });
  it("retains all structured JSON and multipart failure details", async () => {
    const payload = {
      success: false,
      error: "import_conflict",
      message: "Изменились записи",
      details: { rowIds: ["row-2"], retry_after_seconds: 3 },
      correlationId: "request-123",
    };
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify(payload), { status: 409 }),
    );
    for (const request of [
      () => apiRequest("/api/exams"),
      () => apiFormRequest("/api/exams/parse", new FormData()),
    ]) {
      await expect(request()).rejects.toMatchObject({
        status: 409,
        code: "import_conflict",
        message: payload.message,
        details: payload.details,
        correlationId: payload.correlationId,
        retryAfterSeconds: 3,
      });
    }
  });
  it("lets the browser produce multipart boundaries", async () => {
    fetchMock.mockResolvedValue(ok({ session: { id: 1 } }));
    await parseExamImport(
      3,
      "outside",
      new File(["fixture"], "results.xlsx"),
      "parse-key",
    );
    const options = fetchMock.mock.calls[0][1];
    expect(new Headers(options?.headers).has("Content-Type")).toBe(false);
    expect((options?.body as FormData).get("exam_id")).toBe("3");
    expect(new Headers(options?.headers).get("Idempotency-Key")).toBe(
      "parse-key",
    );
  });
  it("keeps ready independent of global version", async () => {
    fetchMock.mockResolvedValue(ok({ attempt: { id: 3 } }));
    await attemptCommand(3, "ready", {}, "ready-key");
    expect(fetchMock.mock.calls[0][1]?.body).toBe("{}");
  });
  it("classifies transport/5xx as uncertain, validation/CAS as resolved failure", async () => {
    expect(isUncertain(new ApiError("offline"))).toBe(true);
    expect(isUncertain(responseError({ error: "server_error" }, 500))).toBe(
      true,
    );
    expect(isUncertain(responseError({ error: "stale_state" }, 409))).toBe(
      false,
    );
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(examGet("/api/exams")).rejects.toBeInstanceOf(ApiError);
  });
});
