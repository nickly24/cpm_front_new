import { SectionContent } from "@/components/sections/section-content";
import { isUserRole } from "@/lib/auth/roles";
import { notFound } from "next/navigation";

interface StudentTrainPageProps {
  params: Promise<{ role: string; segments?: string[] }>;
}

export default async function StudentTrainPage({ params }: StudentTrainPageProps) {
  const { role, segments } = await params;

  if (!isUserRole(role)) {
    notFound();
  }

  return (
    <SectionContent
      role={role}
      section="train"
      trainPathSegments={segments ?? []}
    />
  );
}
