import type { UserRole } from "@/lib/auth/types";
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
};

export function getNavigation(role: UserRole): RoleNavigation {
  return navigationByRole[role];
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
