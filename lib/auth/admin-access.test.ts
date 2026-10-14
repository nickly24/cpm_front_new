import { describe, expect, it } from "vitest";
import { adminHref, canAccessSection } from "./admin-access";
import type { User } from "./types";
import { getNavigation, isValidSection } from "@/lib/navigation";
import { getSearchableSections } from "@/lib/navigation/search";

const user: User = { role: "staff_admin", id: 7, full_name: "Offline", group_id: null, permissions: { tests: { view: true, edit: false }, schools: { view: true, edit: true } } };
describe("delegated administrative cabinet", () => {
  it("recognizes the owner results permission alias without granting catalog access", () => {
    const resultsOnly = { ...user, permissions: { test_results: { view: true, edit: false } } };
    expect(canAccessSection(resultsOnly, "test-results")).toBe(true);
    expect(canAccessSection(resultsOnly, "test-results", "edit")).toBe(false);
    expect(canAccessSection(resultsOnly, "tests")).toBe(false);
    expect(getNavigation("staff_admin", resultsOnly).groups.flatMap(g => g.items.map(i => i.id))).toEqual(["test-results"]);
  });
  it("denies missing permissions and separates view from edit", () => {
    expect(canAccessSection(user, "tests")).toBe(true);
    expect(canAccessSection(user, "tests", "edit")).toBe(false);
    expect(canAccessSection(user, "schools", "edit")).toBe(true);
    expect(canAccessSection(user, "users")).toBe(false);
    expect(canAccessSection(null, "tests")).toBe(false);
  });
  it("keeps an explicit canonical results denial ahead of a permissive legacy alias", () => {
    const denied={...user,permissions:{"test-results":{view:false,edit:false},test_results:{view:true,edit:true}}};
    expect(canAccessSection(denied,"test-results")).toBe(false);
    expect(canAccessSection(denied,"test-results","edit")).toBe(false);
    expect(getNavigation("staff_admin",denied).groups.flatMap(group=>group.items.map(item=>item.id))).toEqual([]);
  });
  it("uses canonical view-only results rights even if the legacy alias grants edit", () => {
    const readonly={...user,permissions:{"test-results":{view:true,edit:false},test_results:{view:true,edit:true}}};
    expect(canAccessSection(readonly,"test-results")).toBe(true);
    expect(canAccessSection(readonly,"test-results","edit")).toBe(false);
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
  it("does not expose the new Core organization workspace in production navigation", () => {
    const ids = getNavigation("admin", { ...user, role: "admin" }).groups.flatMap(group => group.items.map(item => item.id));
    expect(ids).not.toContain("organizations"); expect(ids).not.toContain("divisions"); expect(ids).not.toContain("directions");
  });
});
