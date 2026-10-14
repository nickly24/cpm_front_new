import { beforeEach, describe, expect, it, vi } from "vitest";
const identity = vi.hoisted(() => ({ user: { account_id: 9, organization_id: 1, division_id: 1001 } }));
vi.mock("@/lib/config", () => ({ BFF_DEV: true }));
vi.mock("@/lib/bff/client", () => ({ getIdentity: () => identity }));
import { attemptDatabaseName } from "./test-attempt-db";

beforeEach(() => { identity.user = { account_id: 9, organization_id: 1, division_id: 1001 }; });
describe("local official attempt scope", () => {
  it("keeps organization, division, and account in separate stores", () => {
    const initial = attemptDatabaseName();
    identity.user.division_id = 1002;
    expect(attemptDatabaseName()).not.toBe(initial);
    identity.user.organization_id = 2;
    const secondOrg = attemptDatabaseName();
    identity.user.account_id = 10;
    expect(attemptDatabaseName()).not.toBe(secondOrg);
  });
  it("refuses an unselected division instead of using a global draft store", () => {
    identity.user.division_id = 0;
    expect(attemptDatabaseName).toThrow("attempt_context_missing");
  });
});
