import type { User, UserRole } from "./types";
import { BFF_DEV } from "@/lib/config";

export function isAdminCabinet(role?: UserRole): boolean {
  return role === "admin" || role === "staff_admin";
}

export function canAccessSection(user: User | null, section: string, action: "view" | "edit" = "view"): boolean {
  // Core exposes these scoped catalogs for reading; delegated edit flags do not grant organization writes.
  if (BFF_DEV && ["organizations", "divisions", "directions"].includes(section)) {
    return action === "edit" ? user?.role === "admin" && user.organization_admin === true : isAdminCabinet(user?.role);
  }
  if (user?.role === "admin") return true;
  if (user?.role !== "staff_admin" || section === "access") return false;
  // Groups share the users workspace, but Core grants their rights separately.
  if (BFF_DEV && section === "users") {
    const flags = [user.permissions?.users, user.permissions?.groups];
    return flags.some(flag => action === "edit" ? flag?.edit === true : flag?.view === true || flag?.edit === true);
  }
  // A legacy alias may fill a missing permission, never replace an explicit denial.
  const flags = section === "test-results" && !Object.hasOwn(user.permissions ?? {}, section)
    ? user.permissions?.test_results : user.permissions?.[section];
  return action === "edit" ? flags?.edit === true : flags?.view === true || flags?.edit === true;
}

export function adminHref(user: User | null, section: string): string {
  return `/cabinet/${user?.role === "staff_admin" ? "staff_admin" : "admin"}/${section}`;
}
