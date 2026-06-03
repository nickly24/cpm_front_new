import type { UserRole } from "./types";
import { navigationByRole } from "../navigation";

export const ROLE_LABELS: Record<UserRole, string> = {
  student: "ученика",
  proctor: "проктора",
  admin: "администратора",
  examinator: "экзаменатора",
  supervisor: "супервайзера",
};

export function getCabinetPath(role: UserRole): string {
  return `/cabinet/${role}/${navigationByRole[role].groups[0].items[0].id}`;
}

export function isUserRole(value: string): value is UserRole {
  return value in navigationByRole;
}
