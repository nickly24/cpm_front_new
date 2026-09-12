import type { User, UserRole } from "./types";

export function isAdminCabinet(role?: UserRole): boolean {
  return role === "admin" || role === "staff_admin";
}

export function canAccessSection(user: User | null, section: string, action: "view" | "edit" = "view"): boolean {
  if (user?.role === "admin") return true;
  if (user?.role !== "staff_admin" || section === "access") return false;
  const flags = user.permissions?.[section];
  return action === "edit" ? flags?.edit === true : flags?.view === true || flags?.edit === true;
}

export function adminHref(user: User | null, section: string): string {
  return `/cabinet/${user?.role === "staff_admin" ? "staff_admin" : "admin"}/${section}`;
}
