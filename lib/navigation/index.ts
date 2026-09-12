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
  const navigation = navigationByRole[role];
  if (role !== "staff_admin") return navigation;
  return { ...navigation, groups: navigation.groups.map((group) => ({ ...group, items: group.items.filter((item) => canAccessSection(user ?? null, item.id)) })).filter((group) => group.items.length > 0) };
}

export function getDefaultSection(role: UserRole): string {
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
