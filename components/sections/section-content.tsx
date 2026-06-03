"use client";

import { AdminHomeworkSection } from "@/components/admin/homework/admin-homework-section";
import { AdminSchoolsSection } from "@/components/admin/schools/admin-schools-section";
import { AdminTestsSection } from "@/components/admin/tests/admin-tests-section";
import { AdminUsersSection } from "@/components/admin/users/admin-users-section";
import { StudentHomeworkSection } from "@/components/student/homework/student-homework-section";
import { StudentPerformanceSection } from "@/components/student/performance/student-performance-section";
import { StudentTestsSection } from "@/components/student/tests/student-tests-section";
import { EmptySection } from "@/components/sections/empty-section";
import type { UserRole } from "@/lib/auth/types";
import { getSectionLabel } from "@/lib/navigation";

interface SectionContentProps {
  role: UserRole;
  section: string;
}

export function SectionContent({ role, section }: SectionContentProps) {
  if (role === "student" && section === "performance") {
    return <StudentPerformanceSection />;
  }

  if (role === "student" && section === "homework") {
    return <StudentHomeworkSection />;
  }

  if (role === "student" && section === "tests") {
    return <StudentTestsSection />;
  }

  if (role === "admin" && section === "tests") {
    return <AdminTestsSection />;
  }

  if (role === "admin" && section === "assignments") {
    return <AdminHomeworkSection />;
  }

  if (role === "admin" && section === "users") {
    return <AdminUsersSection />;
  }

  if (role === "admin" && section === "schools") {
    return <AdminSchoolsSection />;
  }

  const title = getSectionLabel(role, section) ?? section;
  return <EmptySection title={title} />;
}
