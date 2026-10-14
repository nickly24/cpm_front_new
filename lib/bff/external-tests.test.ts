import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExternalTest } from "./external-tests";
vi.mock("@/lib/config", () => ({ BFF_DEV: true, BFF_EXTERNAL_TESTS_DEV: true }));
const { domain, identity } = vi.hoisted(() => ({ domain: vi.fn(), identity: { context_revision: "one", user: { organization_id: 10, division_id: 1001, account_id: 99, role: "student" } } }));
vi.mock("./client", () => ({ domain, getIdentity: () => identity }));
const id = "a".repeat(24);
const test = { id, revision: 3, organization_id: 10, division_id: 1001, name: "Олимпиада", direction_id: 5, direction_name: "Математика", date: "2026-10-09", is_deleted: false,
  created_at: "2026-10-09T10:00:00Z", updated_at: "2026-10-09T10:00:00Z", actions: { can_edit: true, can_delete: true, can_view_results: true }, result: null };
const result = { id: "b".repeat(24), revision: 2, account_id: 99, student_id: 1234, full_name: "Ученик", score: 0 };
beforeEach(() => { domain.mockReset(); vi.resetModules(); identity.context_revision = "one"; identity.user.organization_id = 10; identity.user.division_id = 1001; identity.user.account_id = 99; identity.user.role = "student"; });
describe("external tests boundary", () => {
  it("preserves zero, unknown score and absence as three different states", async () => {
    const { externalStudentItem } = await import("./external-tests");
    expect(externalStudentItem({ ...test, result })).toMatchObject({ hasResult: true, rate: 0, status: "external", canStart: false, canPractice: false });
    expect(externalStudentItem({ ...test, result: { ...result, score: null } })).toMatchObject({ hasResult: true, rate: null });
    expect(externalStudentItem(test)).toMatchObject({ hasResult: false, rate: null });
    expect(externalStudentItem({ ...test, result: { ...result, score: 71.5 } })).toMatchObject({ hasResult: true, rate: 71.5 });
  });
  it("uses the owner's corrected manual percentage without recomputing from imported answer counts", async () => {
    const { externalStudentItem } = await import("./external-tests");
    const imported = { ...result, correct_count: 60, completed_at: "2026-10-09T10:00:00Z", time_spent: "15:12", source_row_id: "row-42" };
    expect(externalStudentItem({ ...test, result: { ...imported, score: 17.75 } })).toMatchObject({ hasResult: true, rate: 17.75 });
    expect(externalStudentItem({ ...test, result: { ...imported, score: null } })).toMatchObject({ hasResult: true, rate: null });
    expect(externalStudentItem({ ...test, result: { ...imported, score: 0 } })).toMatchObject({ hasResult: true, rate: 0 });
    expect(externalStudentItem({ ...test, result: undefined })).toMatchObject({ hasResult: false, rate: null });
  });
  it("rejects missing or invalid result scores rather than substituting imported counts or a zero", async () => {
    const { externalCatalog, externalResultItems, externalStudentItem } = await import("./external-tests");
    for (const score of [undefined, -1, 101, NaN, Infinity, "0"]) {
      const malformed = { ...result, score, correct_count: 10 };
      expect(() => externalStudentItem({ ...test, result: malformed } as unknown as ExternalTest)).toThrow("Некорректный балл");
    }
    domain.mockResolvedValue({ items: [{ ...test, result: { ...result, score: undefined } }], total: 1 });
    await expect(externalCatalog()).rejects.toThrow("Некорректный балл");
    domain.mockResolvedValue({ items: [{ test, result: { ...result, score: "0" } }], total: 1 });
    await expect(externalResultItems()).rejects.toThrow("Некорректный балл");
  });
  it("does not render another account's manually corrected score through the student adapter", async () => {
    const { externalStudentItem } = await import("./external-tests");
    expect(() => externalStudentItem({ ...test, result: { ...result, account_id: 100, score: 21.25 } })).toThrow("Некорректный результат");
    expect(() => externalStudentItem({ ...test, division_id: 1002, result: { ...result, score: 21.25 } })).toThrow("Кабинет изменился");
  });
  it("never sends organization or division selectors, and preserves account/profile IDs", async () => {
    domain.mockResolvedValue({ items: [{ test, result }], total: 1 });
    const { externalResultItems } = await import("./external-tests");
    const rows = await externalResultItems({ accountId: 99, directionId: 5 });
    expect(rows[0].result).toMatchObject({ account_id: 99, student_id: 1234 });
    expect(domain.mock.calls[0][0]).toContain("account_id=99");
    expect(domain.mock.calls[0][0]).not.toMatch(/organization_id|division_id/);
  });
  it("rejects records from another division or organization even if an owner response is malformed", async () => {
    const { externalCatalog } = await import("./external-tests");
    domain.mockResolvedValue({ items: [{ ...test, division_id: 1002 }], total: 1 });
    await expect(externalCatalog()).rejects.toThrow("Кабинет изменился");
    domain.mockResolvedValue({ items: [{ ...test, organization_id: 11 }], total: 1 });
    await expect(externalCatalog()).rejects.toThrow("Кабинет изменился");
  });
  it("does not display another student's result in a self-only response", async () => {
    const { externalCatalog, externalResultItems } = await import("./external-tests");
    domain.mockResolvedValue({ items: [{ ...test, result: { ...result, account_id: 100 } }], total: 1 });
    await expect(externalCatalog()).rejects.toThrow("Некорректный результат");
    domain.mockResolvedValue({ items: [{ test, result: { ...result, account_id: 100 } }], total: 1 });
    await expect(externalResultItems()).rejects.toThrow("Некорректный результат");
  });
  it("retains create idempotency after a lost reply and changes it with cabinet", async () => {
    const keys: string[] = []; let succeed = false;
    domain.mockImplementation(async (_path, options: RequestInit) => { keys.push(new Headers(options.headers).get("Idempotency-Key")!); if (!succeed) throw new TypeError("lost"); return test; });
    const { createExternalTest } = await import("./external-tests");
    const payload = { name: "Олимпиада", direction_id: 5, date: "2026-10-09" };
    await expect(createExternalTest(payload)).rejects.toThrow("lost");
    succeed = true; await createExternalTest(payload); expect(keys[1]).toBe(keys[0]);
    identity.context_revision = "two"; await createExternalTest(payload); expect(keys[2]).not.toBe(keys[0]);
  });
  it("uses the reviewed revision/token for deletion and requires a new preview after a conflict", async () => {
    const { externalDeletePreview, deleteExternalTest } = await import("./external-tests");
    await expect(deleteExternalTest(id)).rejects.toThrow("Сначала откройте");
    domain.mockResolvedValueOnce({ test, results_count: 2, confirmation_token: "confirmed", expires_at: "2026-10-09T11:00:00Z" });
    await externalDeletePreview(id);
    domain.mockImplementation(async (_path, options: RequestInit) => { expect(JSON.parse(String(options.body))).toEqual({ expected_revision: 3, confirmation_token: "confirmed" }); throw Object.assign(new Error("conflict"), { code: "stale_revision", status: 409 }); });
    await expect(deleteExternalTest(id)).rejects.toThrow("Данные изменились");
    await expect(deleteExternalTest(id)).rejects.toThrow("Сначала откройте");
  });
  it("does not reuse a preview after switching the selected cabinet", async () => {
    domain.mockResolvedValue({ test, results_count: 1, confirmation_token: "confirmed" });
    const { externalDeletePreview, deleteExternalTest } = await import("./external-tests");
    await externalDeletePreview(id); identity.context_revision = "two";
    await expect(deleteExternalTest(id)).rejects.toThrow("Сначала откройте"); expect(domain).toHaveBeenCalledTimes(1);
  });
  it("keeps correction's captured test and result revisions, including a score of zero", async () => {
    domain.mockImplementation(async (_path, options?: RequestInit) => options?.method ? test : { ...test, revision: 4 });
    const { correctExternalResult } = await import("./external-tests");
    const updated = await correctExternalResult(test, 99, 2, 0);
    const call = domain.mock.calls[0]; expect(call[0]).toBe(`/tests/external-tests/${id}/results/99`);
    expect(JSON.parse(call[1].body)).toEqual({ expected_revision: 3, expected_result_revision: 2, score: 0 });
    expect(new Headers(call[1].headers).get("Idempotency-Key")).toMatch(/^[a-f0-9-]{36}$/); expect(updated.revision).toBe(4);
  });
  it("sends unknown explicitly as null and rejects invalid scores/account IDs before HTTP", async () => {
    domain.mockImplementation(async (_path, options?: RequestInit) => options?.method ? test : test);
    const { correctExternalResult } = await import("./external-tests");
    await correctExternalResult(test, 99, 0, null); expect(JSON.parse(domain.mock.calls[0][1].body).score).toBeNull();
    domain.mockReset(); for (const score of [-1, 101, NaN, Infinity]) await expect(correctExternalResult(test, 99, 0, score)).rejects.toThrow();
    await expect(correctExternalResult(test, 0, 0, 1)).rejects.toThrow(); expect(domain).not.toHaveBeenCalled();
  });
  it("retains correction idempotency after an uncertain reply", async () => {
    const keys: string[] = [];
    domain.mockImplementation(async (_path, options: RequestInit) => { keys.push(new Headers(options.headers).get("Idempotency-Key")!); throw new TypeError("lost"); });
    const { correctExternalResult } = await import("./external-tests");
    await expect(correctExternalResult(test, 99, 2, 50)).rejects.toThrow("lost"); await expect(correctExternalResult(test, 99, 2, 50)).rejects.toThrow("lost"); expect(keys[0]).toBe(keys[1]);
  });
  it("continues past the first page and aborts traversal on context cancellation", async () => {
    const { externalCatalog } = await import("./external-tests");
    domain.mockImplementation(async (resource: string) => ({ items: resource.includes("offset=100") ? [test] : Array.from({ length: 100 }, () => test), total: 101 }));
    expect(await externalCatalog()).toHaveLength(101); expect(domain.mock.calls[1][0]).toContain("offset=100");
    domain.mockReset(); const controller = new AbortController(); controller.abort(); await expect(externalCatalog({ signal: controller.signal })).rejects.toThrow(); expect(domain).not.toHaveBeenCalled();
  });
  it("fails closed on missing source or an inconsistent pagination response", async () => {
    const { externalCatalog } = await import("./external-tests");
    domain.mockRejectedValue(Object.assign(new Error("unavailable"), { status: 503 })); await expect(externalCatalog()).rejects.toThrow("unavailable");
    domain.mockResolvedValue({ items: [], total: 1 }); await expect(externalCatalog()).rejects.toThrow("Список изменился");
  });
  it("reads external entries from the server page and preserves own zero", async () => {
    domain.mockImplementation(async (resource: string) => {
      const params = new URL(resource, "https://bff.invalid").searchParams;
      return { items: [{ id, organization_id: 10, division_id: 1001, account_id: 99,
        title: test.name, direction_name: test.direction_name, date: test.date,
        is_external: true, status: "external", access: null, active_attempt: null, session: null,
        has_result: true, rate: 0 }], total: params.get("overview") === "true" ? 1 : 2,
        limit: Number(params.get("limit")), offset: Number(params.get("offset")), server_time: test.created_at };
    });
    const { studentCatalog } = await import("./tests-student");
    const page = await studentCatalog(null, 1, 1, false, { status: "external", dates: { startDate: "2026-10-09", endDate: "2026-10-09" } });
    expect(page.pagination?.total_items).toBe(2); expect(page.tests[0]).toMatchObject({ hasResult: true, rate: 0, canStart: false });
    const overview = await studentCatalog(null, 1, 5, true); expect(overview.tests).toHaveLength(1);
    expect(domain).toHaveBeenCalledTimes(2);
    expect(domain.mock.calls.every(([resource]) => resource.startsWith("/tests/student-catalog?"))).toBe(true);
    expect(domain.mock.calls[0][0]).toContain("include_external=true");
    expect(domain.mock.calls[0][0]).toContain("status=external");
    expect(domain.mock.calls[0][0]).toContain("date_from=2026-10-09");
  });
  it("keeps external records out of the bank, archive and connection filters", async () => {
    domain.mockImplementation(async (resource: string) => resource.startsWith("/tests/external-tests") ? { items: [test], total: 1 } : { items: [], total: 0 });
    const { testsCatalog } = await import("./tests-admin");
    expect(await testsCatalog({ relation: "owned" })).toHaveLength(1);
    for (const filter of [{ bank: true }, { relation: "attached" }, { relation: "copy" }, { archived: "true" }, { ownerDivisionId: "1002" }]) {
      domain.mockClear(); expect(await testsCatalog(filter)).toHaveLength(0); expect(domain.mock.calls.some(([resource]) => resource.startsWith("/tests/external-tests"))).toBe(false);
    }
  });
  it("captures metadata revision and never adds a placement to an update", async () => {
    domain.mockResolvedValue({ ...test, revision: 4, name: "Новое название" });
    const { updateExternalTest } = await import("./external-tests");
    await updateExternalTest(test, { name: "Новое название", direction_id: 6, date: "2026-10-10" });
    expect(JSON.parse(domain.mock.calls[0][1].body)).toEqual({ expected_revision: 3, name: "Новое название", direction_id: 6, date: "2026-10-10" });
  });
});
