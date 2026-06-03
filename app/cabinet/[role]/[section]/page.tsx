import { SectionContent } from "@/components/sections/section-content";
import { isUserRole } from "@/lib/auth/roles";
import { isValidSection } from "@/lib/navigation";
import { notFound } from "next/navigation";

interface CabinetSectionPageProps {
  params: Promise<{ role: string; section: string }>;
}

export default async function CabinetSectionPage({
  params,
}: CabinetSectionPageProps) {
  const { role, section } = await params;

  if (!isUserRole(role) || !isValidSection(role, section)) {
    notFound();
  }

  return <SectionContent role={role} section={section} />;
}
