"use client";

import { AttendanceQrCard } from "@/components/student/performance/attendance-qr-card";
import { SectionHeroBanner } from "@/components/student/section-hero-banner";
import styles from "@/components/student/performance/performance.module.css";
import { useAuth } from "@/contexts/AuthContext";
import { STUDENT_SECTION_BANNERS } from "@/lib/student/section-banners";

function buildSubtitle(groupId?: number | null): string | undefined {
  if (groupId) {
    return `Группа ${groupId}`;
  }

  return undefined;
}

export function StudentPerformanceSection() {
  const { user } = useAuth();

  return (
    <div className={styles.page}>
      <SectionHeroBanner
        imageSrc={STUDENT_SECTION_BANNERS.performance}
        eyebrow="Успеваемость"
        title={user?.full_name ?? "Студент"}
        subtitle={buildSubtitle(user?.group_id)}
      />

      <AttendanceQrCard />
    </div>
  );
}
