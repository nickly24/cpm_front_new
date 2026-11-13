import { afterEach, describe, expect, it, vi } from "vitest";
const { domain } = vi.hoisted(() => ({ domain: vi.fn() }));
vi.mock("./client", () => ({ domain, bffBlobRequest: vi.fn(), getIdentity: () => null }));
import { examsAdminGet, examsAdminMutate } from "./exams-admin";
import { ownerResult } from "./exams-shared";
afterEach(() => domain.mockReset());
describe("administrative OV contract", () => {
  it("maps attempt editing permission and nullable OV", async () => {
    domain.mockResolvedValue({ id: 20, ov_status: null, ov_comment: null, ov_revision: 0, permissions: { can_edit_ov: true } });
    expect(await examsAdminGet("/api/exams/10/classic/attempts/20")).toMatchObject({ attempt: { id: 20, ovStatus: null, ovComment: null, ovRevision: 0, canEditOv: true } });
  });
  it("sends the same dedicated OV command as the examiner with a stable UUID", async () => {
    domain.mockResolvedValue({ attempt: { id: 20 }, receipt: { outcome: "ov_updated" } });
    await examsAdminMutate({ path: "/api/exams/10/classic/attempts/20/ov", method: "POST", key: "same-key", body: { expectedOvRevision: 4, ovStatus: "remarks", ovComment: "Уточнить документ" } });
    expect(domain).toHaveBeenCalledWith("/exams/10/attempts/20/ov", { method: "POST", headers: { "Idempotency-Key": "same-key" }, body: JSON.stringify({ expected_ov_revision: 4, ov_status: "remarks", ov_comment: "Уточнить документ" }) });
  });
  it("preserves omission in student results but shows explicit null to staff", () => {
    expect(ownerResult({ id: 20, grade: 0 })).not.toHaveProperty("ovStatus");
    expect(ownerResult({ id: 20, grade: 0, ov_status: null, ov_revision: 0 })).toMatchObject({ ovStatus: null, ovRevision: 0 });
  });
});


describe("bounded admin protocol history", () => {
  it("fetches one native page of appeals instead of the entire attempt", async () => {
    domain.mockResolvedValue({ items: [{ id: 99, previous_grade: 0, new_grade: 1, created_at: "2026-11-13T09:00:00Z" }], total: 41, limit: 20, offset: 20 });
    const response = await examsAdminGet("/api/exams/10/classic/attempts/20/appeals", { page: 2, limit: 20 });
    expect(domain).toHaveBeenCalledTimes(1);
    expect(domain.mock.calls[0][0]).toBe("/exams/10/attempts/20/appeals?limit=20&offset=20");
    expect(response).toMatchObject({ items: [{ previousGrade: 0, newGrade: 1 }], pagination: { page: 2, total: 41 } });
  });
});
