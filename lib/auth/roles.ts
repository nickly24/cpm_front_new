import { BFF_DEV } from "@/lib/config";
import type { User, UserRole } from "./types";
import { getDefaultSection, navigationByRole } from "../navigation";

export const ROLE_LABELS: Record<UserRole, string> = {
  student: "ученика",
  proctor: "проктора",
  admin: "администратора",
  examinator: "экзаменатора",
  supervisor: "супервайзера",
  staff_admin: "сотрудника",
};

export function getCabinetPath(role: UserRole, user?: User | null): string {
  if (role === "student") return "/cabinet/student/menu";
  if (BFF_DEV) return `/cabinet/${role}/${getDefaultSection(role, user)}`;
  return `/cabinet/${role}/${navigationByRole[role].groups[0].items[0].id}`;
}

export function isUserRole(value: string): value is UserRole {
  return value in navigationByRole;
}
