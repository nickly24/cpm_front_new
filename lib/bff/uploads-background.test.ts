import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ identity: { user: { account_id: 9, organization_id: 7, division_id: 11 } }, domain: vi.fn() }));
vi.mock("./client", () => ({ domain: state.domain, getIdentity: () => state.identity, bffBlobRequest: vi.fn() }));
import { commitUpload, pendingUploadCommand, pollUploadJob, watchedUploadJobs, recoverUploadCommand, recoverUploadJob, revokeUploadJob, retryUploadConfirmation, uploadCanRetry, uploadCanRecover, uploadCanRevoke, uploadCanRetryConfirmation, uploadCommandJournalState, type UploadJob, type UploadSession } from "./uploads";

const scope = { actor_account_id: 9, organization_id: 7, division_id: 11 }, sessionId = "a".repeat(32), jobId = "b".repeat(32);
const session: UploadSession = { ...scope, id: sessionId, type: "users.credentials", owner: "core", state: "preview", revision: 2, owner_revision: 1, expires_at: "2099-01-01", created_at: "2026-10-09" };
const authorizing: UploadJob = { ...scope, id: jobId, session_id: sessionId, type: session.type, owner: "core", status: "authorizing", attempt: 0, processed: 0, total: 0, created_at: "2026-10-09", capabilities: { retry_delivery: false, recover_receipt: false, revoke_authorization: true, retry_confirmation: true } };
const queued: UploadJob = { ...authorizing, authorization: {bound:true,mode:"apply"}, status: "queued", capabilities: { ...authorizing.capabilities!, retry_confirmation: false } };
const unknown: UploadJob = { ...queued, status: "outcome_unknown", capabilities: { ...queued.capabilities!, recover_receipt: true } };
let legacy: Map<string, string>, shared: Map<string, string>;
const storage = (map: Map<string, string>) => ({ get length() { return map.size; }, key: (index: number) => [...map.keys()][index] ?? null, getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => map.set(key, value), removeItem: (key: string) => map.delete(key) });
function receipt(resource = jobId) {
  const pending = pendingUploadCommand()!;
  return { command_id: pending.id, resource_id: resource, type: pending.type, owner: pending.owner ?? "core", scope: pending.scope, state: "completed", action: `${["edit", "commit"].includes(pending.action) ? "session" : "job"}.${pending.action}:${pending.resource}` };
}
async function reserve() { state.domain.mockResolvedValueOnce(authorizing).mockResolvedValueOnce(authorizing); await commitUpload(session, true); return pendingUploadCommand()!; }
beforeEach(() => {
  legacy = new Map(); shared = new Map(); state.domain.mockReset(); state.identity.user = { account_id: 9, organization_id: 7, division_id: 11 };
  vi.stubGlobal("sessionStorage", storage(legacy)); vi.stubGlobal("localStorage", storage(shared));
  vi.stubGlobal("navigator", { locks: { request: async (_name: string, _options: unknown, callback: (lock: object) => unknown) => callback({}) } });
});
afterEach(() => vi.unstubAllGlobals());

describe("background confirmation proof and durable command identity", () => {
  it("requires explicit consent and retains authorizing 202 across reload and completed HTTP receipt", async () => {
    expect(() => commitUpload(session, false)).toThrow("Явно"); expect(state.domain).not.toHaveBeenCalled();
    const pending = await reserve();
    expect(pending).toMatchObject({ action: "commit", resource: sessionId, job_ref: jobId, expected_revision: 2, scope });
    expect(JSON.parse(state.domain.mock.calls[0][1].body)).toEqual({ expected_revision: 2, confirmed: true });
    expect(state.domain.mock.calls[0][1].headers).toEqual({ "Idempotency-Key": pending.id });
    vi.stubGlobal("sessionStorage", storage(new Map()));
    expect(pendingUploadCommand()?.id).toBe(pending.id); expect(legacy.size).toBe(0);
    state.domain.mockResolvedValueOnce(receipt()).mockResolvedValueOnce(authorizing);
    expect(await recoverUploadCommand()).toEqual({ job: authorizing }); expect(pendingUploadCommand()?.id).toBe(pending.id);
  });
  it("repeats only the original confirmation UUID/revision and releases it after fresh binding proof", async () => {
    const pending = await reserve(); state.domain.mockResolvedValueOnce(queued).mockResolvedValueOnce(queued);
    expect(await retryUploadConfirmation(authorizing, true)).toEqual(queued);
    const posts = state.domain.mock.calls.filter(call => call[1]?.method === "POST");
    expect(posts).toHaveLength(2); expect(posts[0][1].body).toBe(posts[1][1].body); expect(posts[0][1].headers).toEqual(posts[1][1].headers);
    expect(posts[1][0]).toBe(`/uploads/sessions/${sessionId}/commit`); expect(posts[1][1].headers["Idempotency-Key"]).toBe(pending.id); expect(pendingUploadCommand()).toBeNull();
  });
  it("keeps original confirmation after later access/revision/transport denials without a new key", async () => {
    await reserve(); const raw = [...shared.values()][0];
    for (const status of [401, 403, 404, 409, 503]) {
      state.domain.mockRejectedValueOnce(Object.assign(new Error("denied"), { status }));
      await expect(retryUploadConfirmation(authorizing, true)).rejects.toThrow(); expect([...shared.values()][0]).toBe(raw);
    }
    expect(new Set(state.domain.mock.calls.filter(call => call[1]?.method === "POST").map(call => call[1].headers["Idempotency-Key"])).size).toBe(1);
  });
  it("never clears confirmation on missing capabilities, tampered tuple, or an old technical job", async () => {
    const pending = await reserve();
    for (const changed of [{ ...queued, authorization:undefined }, { ...queued, authorization:{bound:false,mode:"apply" as const} }, { ...queued, capabilities: undefined }, { ...queued, capabilities: { ...queued.capabilities!, retry_confirmation: true } }, { ...queued, session_id: "d".repeat(32) }, { ...queued, division_id: 12 }, { ...queued, owner: "tests" }, { ...queued, status: "awaiting_authorization" }]) {
      state.domain.mockResolvedValueOnce(changed); try { await pollUploadJob(jobId); } catch { /* Keeps unknown. */ }
      expect(pendingUploadCommand()?.id).toBe(pending.id);
    }
    state.domain.mockResolvedValueOnce(unknown); expect((await pollUploadJob(jobId)).status).toBe("outcome_unknown");
    expect(pendingUploadCommand()).toBeNull(); // Bound job exists; native completion remains unknown.
  });
  it("blocks another tab and cabinet while preserving the original account scope", async () => {
    await reserve(); const raw = [...shared.values()][0]; vi.stubGlobal("sessionStorage", storage(new Map()));
    await expect(commitUpload(session, true)).rejects.toThrow("предыдущей команды");
    state.identity.user.division_id = 12;
    await expect(commitUpload({ ...session, division_id: 12 }, true)).rejects.toThrow("другом исходном кабинете");
    expect([...shared.values()][0]).toBe(raw);
    state.identity.user = { account_id: 10, organization_id: 7, division_id: 11 };
    expect(pendingUploadCommand()).toBeNull(); expect([...shared.values()][0]).toBe(raw);
    expect(state.domain.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
  });
  it("refuses corrupt/unavailable/full storage and absent locks before dispatch without evicting unknown", async () => {
    shared.set("cpm-uploads-background-command:9:7:11", "corrupted");
    expect(uploadCommandJournalState().blocked).toBe(true); await expect(commitUpload(session, true)).rejects.toThrow(); expect([...shared.values()][0]).toBe("corrupted"); shared.clear();
    vi.stubGlobal("localStorage", { ...storage(shared), setItem: () => { throw new Error("quota"); } });
    await expect(commitUpload(session, true)).rejects.toThrow("Действие не отправлено");
    vi.stubGlobal("localStorage", storage(shared));
    for (let i = 0; i < 64; i++) shared.set(`cpm-uploads-background-command:${i + 100}:7:11`, "unknown");
    await expect(commitUpload(session, true)).rejects.toThrow("Неизвестные команды не удалены"); expect(shared.size).toBe(64); shared.clear();
    vi.stubGlobal("navigator", {}); await expect(commitUpload(session, true)).rejects.toThrow("не поддерживает"); expect(state.domain).not.toHaveBeenCalled();
  });
  it("blocks synchronous overlap and unavailable cross-tab WebLock before another key can be stored", async () => {
    let resolve!: (value: UploadJob) => void;
    state.domain.mockImplementationOnce(() => new Promise<UploadJob>(r => { resolve = r; }));
    const first = commitUpload(session, true); await vi.waitFor(() => expect(state.domain).toHaveBeenCalledTimes(1));
    await expect(commitUpload(session, true)).rejects.toThrow("ещё выполняется"); state.domain.mockResolvedValueOnce(authorizing); resolve(authorizing); await first;
    expect(state.domain.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
    shared.clear(); vi.stubGlobal("navigator", { locks: { request: async (_n: unknown, _o: unknown, callback: (lock: null) => unknown) => callback(null) } });
    await expect(commitUpload(session, true)).rejects.toThrow("другой вкладке"); expect(shared.size).toBe(0);
  });
  it("retains the historical credentials UUID without migration, reconstructed body or resend", async () => {
    const old = { id: "44083500-b582-4c23-bd1c-67c2e9e367a7", scope, type: "users.credentials", action: "create" }, raw = JSON.stringify(old);
    legacy.set("cpm-uploads-command:9:7:11", raw); expect(pendingUploadCommand()).toEqual(old);
    state.domain.mockRejectedValueOnce(Object.assign(new Error("missing"), { status: 404 })); await expect(recoverUploadCommand()).rejects.toThrow();
    await expect(commitUpload(session, true)).rejects.toThrow("предыдущей команды");
    expect(legacy.get("cpm-uploads-command:9:7:11")).toBe(raw); expect(shared.size).toBe(0); expect(state.domain.mock.calls.every(call => !call[1]?.method)).toBe(true);
  });
  it("requires exact completed action/owner/scope/resource instead of any successful HTTP receipt", async () => {
    state.domain.mockRejectedValueOnce(Object.assign(new Error("lost"), { status: 0 })); await expect(commitUpload(session, true)).rejects.toThrow();
    const pending = pendingUploadCommand()!, expected = receipt();
    for (const changed of [{ ...expected, action: `job.recover:${jobId}` }, { ...expected, state: "reserved" }, { ...expected, owner: "tests" }, { ...expected, scope: { ...scope, actor_account_id: 10 } }, { ...expected, resource_id: "invalid" }]) {
      state.domain.mockResolvedValueOnce(changed); await expect(recoverUploadCommand()).rejects.toThrow(); expect(pendingUploadCommand()?.id).toBe(pending.id);
    }
  });
  it("clears completed scheduling/revoke receipts independently while native outcome stays unknown", async () => {
    for (const [fn, action] of [[recoverUploadJob, "recover"], [revokeUploadJob, "revoke"]] as const) {
      state.domain.mockResolvedValueOnce(unknown).mockImplementationOnce(async () => receipt()).mockResolvedValueOnce(unknown);
      expect(await fn(unknown, true)).toEqual(unknown); expect(pendingUploadCommand()).toBeNull();
      const posts = state.domain.mock.calls.filter(call => call[1]?.method === "POST"), command = posts.at(-1)!;
      expect(command[0]).toBe(`/uploads/jobs/${jobId}/${action}`); expect(JSON.parse(command[1].body)).toEqual({ confirmed: true });
    }
    expect(state.domain.mock.calls.filter(call => call[1]?.method === "POST").every(call => !call[0].endsWith("/commit") && !call[0].endsWith("/retry"))).toBe(true);
  });
  it("denies incomplete capabilities and never infers safe retry from zero attempts/progress", () => {
    for (const value of [{ ...queued, capabilities: undefined }, { ...queued, capabilities: { retry_delivery: true } as UploadJob["capabilities"] }, { ...unknown, capabilities: { ...unknown.capabilities!, retry_delivery: true } }]) expect(uploadCanRetry(value)).toBe(false);
    expect(uploadCanRecover(queued)).toBe(false); expect(uploadCanRevoke({ ...queued, capabilities: undefined })).toBe(false); expect(uploadCanRetryConfirmation({ ...authorizing, capabilities: undefined })).toBe(false);
    expect(() => recoverUploadJob(queued, true)).toThrow("недоступна"); expect(() => revokeUploadJob({ ...queued, capabilities: undefined }, true)).toThrow("недоступен"); expect(state.domain).not.toHaveBeenCalled();
  });
  it("retains a separate outcome watch across reload, scope switching and receipt recovery until native completion", async () => {
    const pending = await reserve(); state.domain.mockResolvedValueOnce(unknown); await pollUploadJob(jobId);
    expect(pendingUploadCommand()).toBeNull();
    expect(watchedUploadJobs()).toEqual([{ id: jobId, session_id: sessionId, scope, type: session.type, owner: "core", confirmation_id: pending.id, expected_revision: 2 }]);
    vi.stubGlobal("sessionStorage", storage(new Map())); expect(watchedUploadJobs()[0].confirmation_id).toBe(pending.id);
    state.identity.user.division_id = 12; expect(watchedUploadJobs()).toEqual([]); expect(pendingUploadCommand()).toBeNull();
    state.identity.user.division_id = 11;
    const readonlyJob = { ...unknown, authorization: { bound: true, mode: "receipt" as const } };
    state.domain.mockResolvedValueOnce(readonlyJob).mockImplementationOnce(async () => receipt()).mockResolvedValueOnce(readonlyJob);
    await recoverUploadJob(unknown, true); expect(watchedUploadJobs()[0].confirmation_id).toBe(pending.id);
    state.domain.mockResolvedValueOnce({ ...readonlyJob, status: "completed" }); await pollUploadJob(jobId);
    expect(watchedUploadJobs()).toEqual([]); expect(pendingUploadCommand()).toBeNull();
  });
  it("keeps confirmation when outcome metadata cannot be saved, instead of dropping its original identity", async () => {
    const pending = await reserve(), original = [...shared.values()][0];
    vi.stubGlobal("localStorage", { ...storage(shared), setItem: (key: string, value: string) => { if (key.startsWith("cpm-uploads-background-job:")) throw new Error("quota"); shared.set(key, value); } });
    state.domain.mockResolvedValueOnce(queued); await expect(pollUploadJob(jobId)).rejects.toThrow("quota");
    expect(pendingUploadCommand()?.id).toBe(pending.id); expect([...shared.values()][0]).toBe(original);
  });
  it("does not clear a replacement command when a previously valid receipt returns", async () => {
    await reserve(); const expected = receipt(), before = pendingUploadCommand()!, replacement = { ...before, id: "c".repeat(8) + "-cccc-cccc-cccc-" + "c".repeat(12) };
    state.domain.mockResolvedValueOnce(expected).mockImplementationOnce(async () => { shared.set("cpm-uploads-background-command:9:7:11", JSON.stringify(replacement)); return queued; });
    await expect(recoverUploadCommand()).rejects.toThrow("Журнал изменился"); expect(pendingUploadCommand()?.id).toBe(replacement.id);
  });
});
