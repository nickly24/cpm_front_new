import { describe, expect, it, vi } from "vitest";
import type { User } from "@/lib/auth/types";

vi.mock("@/lib/config", () => ({ BFF_DEV: true }));

import { canAccessSection } from "@/lib/auth/admin-access";
import { getDefaultSection, getNavigation } from "./index";

const staff = (permissions: User["permissions"]): User => ({ role: "staff_admin", id: 7, full_name: "Scoped", group_id: null, permissions });

describe("Core-only delegated cabinets", () => {
  it("opens the groups workspace without granting profile administration", () => {
    const user = staff({ groups: { view: true, edit: false } });
    expect(canAccessSection(user, "users")).toBe(true);
    expect(canAccessSection(user, "users", "edit")).toBe(false);
    expect(user.permissions?.users).toBeUndefined();
    expect(getNavigation(user.role, user).groups.flatMap(group => group.items.map(item => item.id))).toContain("users");
    expect(getDefaultSection(user.role, user)).toBe("users");
    expect(canAccessSection(user, "access")).toBe(false);
  });

  it.each(["users", "schools", "train"])("lands in the granted %s section", section => {
    const user = staff({ [section]: { view: true, edit: true } });
    expect(getDefaultSection(user.role, user)).toBe(section);
  });

  it("keeps group mutations separate from unrelated cabinets", () => {
    const user = staff({ groups: { view: true, edit: true } });
    expect(canAccessSection(user, "users", "edit")).toBe(true);
    expect(canAccessSection(user, "schools", "edit")).toBe(false);
    expect(canAccessSection(user, "tests")).toBe(false);
  });

  it("shows owner-readable organization catalogs without turning delegated edit flags into organization writes", () => {
    const user = staff({ organizations: { view: true, edit: true }, divisions: { view: true, edit: true }, directions: { view: true, edit: true } });
    const ids = getNavigation(user.role, user).groups.flatMap(group => group.items.map(item => item.id));
    for (const section of ["organizations", "divisions", "directions"]) {
      expect(ids).toContain(section);
      expect(canAccessSection(user, section)).toBe(true);
      expect(canAccessSection(user, section, "edit")).toBe(false);
      expect(canAccessSection({ ...user, role: "admin", organization_admin: false }, section, "edit")).toBe(false);
      expect(canAccessSection({ ...user, role: "admin", organization_admin: true }, section, "edit")).toBe(true);
    }
  });

  it("lands staff without other live grants in an accessible readonly catalog instead of a denied assignments page", () => {
    const user = staff({});
    expect(getDefaultSection(user.role, user)).toBe("organizations");
    expect(canAccessSection(user, "organizations")).toBe(true);
    expect(canAccessSection(user, "organizations", "edit")).toBe(false);
    expect(canAccessSection(user, "access")).toBe(false);
  });
});
