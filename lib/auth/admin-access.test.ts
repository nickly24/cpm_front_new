import { describe, expect, it } from "vitest";
import { adminHref, canAccessSection } from "./admin-access";
import type { User } from "./types";
import { getNavigation, isValidSection } from "@/lib/navigation";
import { getSearchableSections } from "@/lib/navigation/search";

const user: User = { role: "staff_admin", id: 7, full_name: "Offline", group_id: null, permissions: { tests: { view: true, edit: false }, schools: { view: true, edit: true } } };
describe("delegated administrative cabinet", () => {
  it("denies missing permissions and separates view from edit", () => {
    expect(canAccessSection(user, "tests")).toBe(true);
    expect(canAccessSection(user, "tests", "edit")).toBe(false);
    expect(canAccessSection(user, "schools", "edit")).toBe(true);
    expect(canAccessSection(user, "users")).toBe(false);
    expect(canAccessSection(null, "tests")).toBe(false);
  });
  it("edit includes view, but access management is reserved to admin", () => {
    const edited = { ...user, permissions: { tests: { view: false, edit: true }, access: { view: true, edit: true } } };
    expect(canAccessSection(edited, "tests")).toBe(true);
    expect(canAccessSection(edited, "access")).toBe(false);
    expect(isValidSection("staff_admin", "access")).toBe(false);
    expect(canAccessSection({ ...user, role: "admin" }, "access", "edit")).toBe(true);
  });
  it("menu and search include only allowed sections", () => {
    const ids = getNavigation(user.role, user).groups.flatMap(g => g.items.map(i => i.id));
    expect(ids.sort()).toEqual(["schools", "tests"]);
    expect(getSearchableSections(user.role, user).map(s => s.id).sort()).toEqual(ids);
    expect(getNavigation("staff_admin").groups).toEqual([]);
  });
  it("uses the delegated cabinet in internal links", () => {
    expect(adminHref(user, "tests")).toBe("/cabinet/staff_admin/tests");
    expect(adminHref({ ...user, role: "admin" }, "tests")).toBe("/cabinet/admin/tests");
  });
});
