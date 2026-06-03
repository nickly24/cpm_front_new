import { CabinetShell } from "@/components/layout/cabinet-shell";
import { isUserRole } from "@/lib/auth/roles";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

interface CabinetLayoutProps {
  children: ReactNode;
  params: Promise<{ role: string }>;
}

export default async function CabinetLayout({
  children,
  params,
}: CabinetLayoutProps) {
  const { role } = await params;

  if (!isUserRole(role)) {
    notFound();
  }

  return <CabinetShell role={role}>{children}</CabinetShell>;
}
