import { getDefaultSection } from "@/lib/navigation";
import { isUserRole } from "@/lib/auth/roles";
import { notFound, redirect } from "next/navigation";

interface CabinetRolePageProps {
  params: Promise<{ role: string }>;
}

export default async function CabinetRolePage({ params }: CabinetRolePageProps) {
  const { role } = await params;

  if (!isUserRole(role)) {
    notFound();
  }

  redirect(`/cabinet/${role}/${getDefaultSection(role)}`);
}
