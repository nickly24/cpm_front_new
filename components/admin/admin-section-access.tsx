"use client";

import { useAuth } from "@/contexts/AuthContext";
import { canAccessSection, isAdminCabinet } from "@/lib/auth/admin-access";
import { getNavigation, getSectionHref } from "@/lib/navigation";
import { usePathname, useRouter } from "next/navigation";
import { cloneElement, useEffect, type ReactElement, type ReactNode } from "react";
import Link from "next/link";

export function useAdminSectionAccess(sectionOverride?: string) {
  const { user } = useAuth();
  const path = usePathname();
  const section = sectionOverride ?? path.split("/")[3] ?? "dashboard";
  return {
    user, section,
    canView: user?.role !== "staff_admin" || canAccessSection(user, section),
    canEdit: user?.role !== "staff_admin" || canAccessSection(user, section, "edit"),
  };
}

/** Mark administrative mutation entry points explicitly; filters and downloads remain available. */
export function EditOnly({ children }: { children: ReactNode }) {
  const { canEdit } = useAdminSectionAccess();
  return canEdit ? children : null;
}

export function ReadOnlyControl({ children }: { children: ReactElement<{ disabled?: boolean }> }) {
  const { canEdit } = useAdminSectionAccess();
  return canEdit ? children : cloneElement(children, { disabled: true });
}

export function AdminSectionAccess({ section, children }: { section: string; children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const allowed = canAccessSection(user, section);
  const first = user ? getNavigation(user.role, user).groups.flatMap((group) => group.items)[0] : undefined;
  useEffect(() => {
    if (user?.role === "staff_admin" && section === "dashboard" && !allowed && first) {
      router.replace(getSectionHref(user.role, first.id));
    }
  }, [allowed, first, router, section, user]);
  if (!isAdminCabinet(user?.role)) return null;
  if (!allowed) return <div className="admin-access-message"><h1>Раздел недоступен</h1><p>{first ? "Ваша роль не разрешает просмотр этого раздела." : "Для вашей роли пока не разрешены разделы. Обратитесь к администратору."}</p>{first && user ? <Link href={getSectionHref(user.role, first.id)}>Перейти в доступный раздел</Link> : null}</div>;
  return <div key={`${user?.role}:${JSON.stringify(user?.permissions)}`}>
    {!canAccessSection(user, section, "edit") ? <p className="admin-view-notice">Режим просмотра</p> : null}
    {children}
  </div>;
}
