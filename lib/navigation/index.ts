import { BFF_DEV } from "@/lib/config";
import type { User, UserRole } from "@/lib/auth/types";
import { canAccessSection } from "@/lib/auth/admin-access";
import { adminNavigation } from "./admin";
import { examinatorNavigation } from "./examinator";
import { proctorNavigation } from "./proctor";
import { studentNavigation } from "./student";
import { supervisorNavigation } from "./supervisor";
import type { RoleNavigation } from "./types";

export const navigationByRole: Record<UserRole, RoleNavigation> = {
  student: studentNavigation,
  proctor: proctorNavigation,
  admin: adminNavigation,
  examinator: examinatorNavigation,
  supervisor: supervisorNavigation,
  staff_admin: { ...adminNavigation, brand: "CPM Кабинет", groups: adminNavigation.groups.map((group) => ({ ...group, items: group.items.filter((item) => item.id !== "access") })) },
};

export function getNavigation(role: UserRole, user?: User | null): RoleNavigation {
  const original = navigationByRole[role];
  const navigation = { ...original, groups: original.groups.map(g=>({...g,items:g.items.filter(i=>BFF_DEV ? i.id!=="telegram-bot" : !["organizations","divisions","directions"].includes(i.id))})) };
  if (role !== "staff_admin") return navigation;
  return { ...navigation, groups: navigation.groups.map((group) => ({ ...group, items: group.items.filter((item) => canAccessSection(user ?? null, item.id) || BFF_DEV && (item.id==="schedule" || ["attendance","scan","zaps"].includes(item.id) && (user?.organizations?.find(o=>o.id===user.organization_id)?.divisions as {permissions?:Record<string,{view:boolean}>}[]|undefined)?.some(d=>d.permissions?.[item.id]?.view))) })).filter((group) => group.items.length > 0) };
}

export function getDefaultSection(role: UserRole, user?: User | null): string {
  if (BFF_DEV) {
    if (role === "staff_admin" && user) {
      return ["assignments", "tests", "test-results", "exams", "ratings", "users", "schools", "train", "dashboard", "review-queue", "homework-archive", "monitoring", "schedule", "attendance", "zaps", "scan", "organizations", "divisions", "directions"].find(section => canAccessSection(user, section)) ?? "assignments";
    }
    return role === "admin" || role === "staff_admin" ? "assignments" : role === "examinator" ? "exams" : role === "supervisor" ? "ratings" : "homework";
  }
  return navigationByRole[role].groups[0].items[0].id;
}

export function isValidSection(role: UserRole, sectionId: string): boolean {
  return navigationByRole[role].groups.some((group) =>
    group.items.some((item) => item.id === sectionId),
  );
}

export function getSectionLabel(role: UserRole, sectionId: string): string | null {
  for (const group of navigationByRole[role].groups) {
    const item = group.items.find((entry) => entry.id === sectionId);
    if (item) {
      return item.label;
    }
  }

  return null;
}

export function getSectionHref(role: UserRole, sectionId: string): string {
  return `/cabinet/${role}/${sectionId}`;
}
