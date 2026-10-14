import { afterEach, describe, expect, it, vi } from "vitest";
import { assertHomeworkStorageURL } from "./storage-url";

afterEach(() => vi.unstubAllEnvs());
describe("Homework production storage", () => {
  it("accepts the actual HTTPS production storage without a local-mode flag", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CPM_S3_ORIGINS", "");
    expect(() => assertHomeworkStorageURL("https://s3.twcstorage.ru/bucket/file.pdf?X-Amz-Signature=test")).not.toThrow();
  });
  it.each(["http://127.0.0.1:19000/bucket/file", "http://s3.twcstorage.ru/file", "https://s3.twcstorage.ru.attacker.invalid/file", "https://user:secret@s3.twcstorage.ru/file", "https://unconfigured.invalid/file", "//s3.twcstorage.ru/file", "invalid"])("rejects an incorrect production endpoint %s", value => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CPM_S3_ORIGINS", "");
    expect(() => assertHomeworkStorageURL(value)).toThrow("адрес хранилища");
  });
  it("uses a configured HTTPS storage instead of implicitly allowing all HTTPS hosts", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CPM_S3_ORIGINS", "https://files.example.invalid");
    expect(() => assertHomeworkStorageURL("https://files.example.invalid/file.pdf")).not.toThrow();
    expect(() => assertHomeworkStorageURL("https://s3.twcstorage.ru/file.pdf")).toThrow();
  });
  it("keeps local MinIO confined to development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_CPM_S3_ORIGINS", "");
    expect(() => assertHomeworkStorageURL("http://127.0.0.1:19000/bucket/file.pdf")).not.toThrow();
  });
});
