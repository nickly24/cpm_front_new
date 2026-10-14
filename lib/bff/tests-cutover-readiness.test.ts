import { beforeEach, describe, expect, it, vi } from "vitest";

const { domain, externalCatalog, externalResultItems } = vi.hoisted(() => ({
  domain: vi.fn(),
  externalCatalog: vi.fn(async () => { throw new Error("external owner unavailable"); }),
  externalResultItems: vi.fn(async () => { throw new Error("external owner unavailable"); }),
}));
vi.mock("@/lib/config", () => ({ BFF_DEV: true, BFF_EXTERNAL_TESTS_DEV: false }));
vi.mock("./client", () => ({ domain, getIdentity: () => ({ user: { account_id: 9, organization_id: 1, division_id: 1001 } }) }));
vi.mock("./external-tests", () => ({ externalCatalog, externalResultItems, externalAdminItem: vi.fn(), externalStudentItem: vi.fn() }));

import { testsCatalog, testsResultsStudents } from "./tests-admin";
import { studentCatalog } from "./tests-student";

beforeEach(() => { vi.clearAllMocks(); domain.mockReset(); });

describe("Dev tests before the external owner handoff", () => {
  it("loads the internal catalog without contacting the unfinished external source", async () => {
    domain.mockResolvedValue({ items: [], total: 0 });
    await expect(testsCatalog()).resolves.toEqual([]);
    expect(domain).toHaveBeenCalledWith(expect.stringMatching(/^\/tests\/catalog\?/));
    expect(externalCatalog).not.toHaveBeenCalled();
  });

  it("keeps the internal results roster available when the external results owner is unavailable", async () => {
    domain.mockImplementation(async (path: string) => path.startsWith("/core/users")
      ? [{ account_id: 9, full_name: "Ученик" }]
      : { items: [{ account_id: 9 }], total: 1 });
    await expect(testsResultsStudents()).resolves.toEqual([{ id: 9, account_id: 9, full_name: "Ученик", class: null, group_id: null }]);
    expect(externalResultItems).not.toHaveBeenCalled();
  });

  it("retains an actual ready zero in the student list without requiring the external catalog", async () => {
    domain.mockResolvedValue({
      items: [{ id: "test", organization_id: 1, division_id: 1001, account_id: 9,
        title: "В системе", direction_name: "Математика", status: "completed", is_external: false,
        access: { test_id: "test", division_id: 1001, submission_id: "submission", calculation_status: "ready", official_reason: "already_submitted" },
        session: { id: "submission", calculation_status: "ready", score: 0 }, active_attempt: null }],
      total: 1, limit: 20, offset: 0, server_time: "2026-10-14T09:00:00Z",
    });
    const response = await studentCatalog(null, 1, 20, false);
    expect(response.tests.map(test => test.id)).toEqual(["test"]);
    expect(response.sessions[0].score).toBe(0);
    expect(domain).toHaveBeenCalledTimes(1);
    expect(domain.mock.calls[0][0]).toContain("/tests/student-catalog?");
    expect(domain.mock.calls[0][0]).toContain("include_external=false");
    expect(externalCatalog).not.toHaveBeenCalled();
  });
});
