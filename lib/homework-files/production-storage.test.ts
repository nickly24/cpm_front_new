import { afterEach, describe, expect, it, vi } from "vitest";
import type { UploadInitialization } from "./types";

vi.mock("@/lib/config", () => ({ BFF_DEV: true }));
const { domain } = vi.hoisted(() => ({ domain: vi.fn() }));
vi.mock("@/lib/bff/client", () => ({ domain, getIdentity: () => null }));

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("production Homework file transfers", () => {
  it("opens a file URL issued by the Homework owner for external S3", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CPM_S3_ORIGINS", "");
    const url = "https://s3.twcstorage.ru/demo/existing.pdf?X-Amz-Signature=test";
    domain.mockResolvedValue({ url });
    const { filesHomework } = await import("@/lib/bff/homework");
    await expect(filesHomework("/api/submissions/50/file-url")).resolves.toEqual({ url });
    expect(domain).toHaveBeenCalledWith("/homework/submissions/50/file-url", {});
  });

  it("uploads to the external S3 URL with the owner fields and without session credentials", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CPM_S3_ORIGINS", "");
    let request: FakeXHR;
    class FakeXHR {
      upload = {};
      status = 204;
      withCredentials = true;
      open = vi.fn();
      onload?: () => void;
      send = vi.fn((_body: FormData) => this.onload?.());
      constructor() { request = this; }
    }
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    const file = new File(["synthetic pdf bytes"], "demo.pdf", { type: "application/pdf" });
    const initialization = { job: { id: "synthetic-job", limits: null }, upload: {
      method: "POST", url: "https://s3.twcstorage.ru/demo", fields: { key: "demo/file.pdf", policy: "signed-test-policy" },
    } } as unknown as UploadInitialization;
    const { postFileToS3 } = await import("./api");
    await expect(postFileToS3(initialization, file, vi.fn())).resolves.toBeUndefined();
    expect(request!.open).toHaveBeenCalledWith("POST", initialization.upload!.url);
    expect(request!.withCredentials).toBe(false);
    const body = request!.send.mock.calls[0][0] as unknown as FormData;
    expect(body.get("key")).toBe("demo/file.pdf");
    expect(body.get("policy")).toBe("signed-test-policy");
    expect(body.get("file")).toBe(file);
  });

  it("rejects local MinIO before initiating a production upload", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CPM_S3_ORIGINS", "");
    const xhr = vi.fn(); vi.stubGlobal("XMLHttpRequest", xhr);
    const { postFileToS3 } = await import("./api");
    await expect(postFileToS3({ job: { limits: null }, upload: { method: "POST", url: "http://127.0.0.1:19000/demo", fields: {} } } as unknown as UploadInitialization, new File(["demo"], "demo.pdf"), vi.fn())).rejects.toThrow("адрес хранилища");
    expect(xhr).not.toHaveBeenCalled();
  });
});
