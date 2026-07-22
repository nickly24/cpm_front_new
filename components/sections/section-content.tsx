"use client";

import { AdminAttendanceSection } from "@/components/admin/attendance/admin-attendance-section";
import { AdminScanSection } from "@/components/admin/scan/admin-scan-section";
import { AdminZapsSection } from "@/components/admin/zaps/admin-zaps-section";
import { AdminTrainingSection } from "@/components/admin/training/admin-training-section";
import { AdminDashboardSection } from "@/components/admin/dashboard/admin-dashboard-section";
import { AdminHomeworkSection } from "@/components/admin/homework/admin-homework-section";
import { AdminExamsSection } from "@/components/admin/exams/admin-exams-section";
import { AdminRatingsSection } from "@/components/admin/ratings/admin-ratings-section";
import { AdminTestResultsSection } from "@/components/admin/test-results/admin-test-results-section";
import { AdminScheduleSection } from "@/components/admin/schedule/admin-schedule-section";
import { AdminSchoolsSection } from "@/components/admin/schools/admin-schools-section";
import { AdminTestsSection } from "@/components/admin/tests/admin-tests-section";
import { AdminTelegramBotSection } from "@/components/admin/telegram-bot/admin-telegram-bot-section";
import { AdminUploadSection } from "@/components/admin/upload/admin-upload-section";
import { AdminUsersSection } from "@/components/admin/users/admin-users-section";
import { StudentAttendanceSection } from "@/components/student/attendance/student-attendance-section";
import { StudentZapsSection } from "@/components/student/zaps/student-zaps-section";
import { StudentTrainingSection } from "@/components/student/training/student-training-section";
import { StudentExamsSection } from "@/components/student/exams/student-exams-section";
import { StudentHomeworkSection } from "@/components/student/homework/student-homework-section";
import { StudentPerformanceSection } from "@/components/student/performance/student-performance-section";
import { StudentScheduleSection } from "@/components/student/schedule/student-schedule-section";
import { StudentTestsSection } from "@/components/student/tests/student-tests-section";
import { ProctorHomeworkSection } from "@/components/proctor/proctor-homework-section";
import { ReviewQueueSection } from "@/components/homework/review-queue-section";
import { HomeworkMonitoringSection } from "@/components/admin/homework/homework-monitoring-section";
import { HomeworkArchiveSection } from "@/components/admin/homework/homework-archive-section";
import { ProctorStudentsSection } from "@/components/proctor/proctor-students-section";
import { SupervisorDashboardSection } from "@/components/supervisor/supervisor-dashboard-section";
import { SupervisorAttendanceSection } from "@/components/supervisor/reports/supervisor-attendance-section";
import { SupervisorExamsSection } from "@/components/supervisor/reports/supervisor-exams-section";
import { SupervisorHomeworkSection } from "@/components/supervisor/reports/supervisor-homework-section";
import { SupervisorRatingsSection } from "@/components/supervisor/reports/supervisor-ratings-section";
import { SupervisorTestsSection } from "@/components/supervisor/reports/supervisor-tests-section";
import { EmptySection } from "@/components/sections/empty-section";
import type { UserRole } from "@/lib/auth/types";
import { getSectionLabel } from "@/lib/navigation";

interface SectionContentProps {
  role: UserRole;
  section: string;
  trainPathSegments?: string[];
}

export function SectionContent({
  role,
  section,
  trainPathSegments = [],
}: SectionContentProps) {
  if (role === "student" && section === "performance") {
    return <StudentPerformanceSection />;
  }

  if (role === "student" && section === "homework") {
    return <StudentHomeworkSection />;
  }

  if (role === "student" && section === "tests") {
    return <StudentTestsSection />;
  }

  if (role === "student" && section === "schedule") {
    return <StudentScheduleSection />;
  }

  if (role === "student" && section === "exams") {
    return <StudentExamsSection />;
  }

  if (role === "student" && section === "attendance") {
    return <StudentAttendanceSection />;
  }

  if (role === "student" && section === "zaps") {
    return <StudentZapsSection />;
  }

  if (role === "student" && section === "train") {
    return (
      <StudentTrainingSection role={role} pathSegments={trainPathSegments} />
    );
  }

  if (role === "admin" && section === "dashboard") {
    return <AdminDashboardSection />;
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

  if (role === "admin" && section === "upload") {
    return <AdminUploadSection />;
  }

  if (role === "admin" && section === "schedule") {
    return <AdminScheduleSection />;
  }

  if (role === "admin" && section === "telegram-bot") {
    return <AdminTelegramBotSection />;
  }

  if (role === "admin" && section === "ratings") {
    return <AdminRatingsSection />;
  }

  if (role === "admin" && section === "test-results") {
    return <AdminTestResultsSection />;
  }

  if (role === "admin" && section === "exams") {
    return <AdminExamsSection />;
  }

  if (role === "admin" && section === "attendance") {
    return <AdminAttendanceSection />;
  }

  if (role === "admin" && section === "scan") {
    return <AdminScanSection />;
  }

  if (role === "admin" && section === "zaps") {
    return <AdminZapsSection />;
  }

  if (role === "admin" && section === "train") {
    return <AdminTrainingSection />;
  }
  if (role === "admin" && section === "review-queue") return <ReviewQueueSection />;
  if (role === "admin" && section === "monitoring") return <HomeworkMonitoringSection />;
  if (role === "admin" && section === "homework-archive") return <HomeworkArchiveSection />;

  if (role === "proctor" && section === "homework") {
    return <ProctorHomeworkSection />;
  }

  if (role === "proctor" && section === "students") {
    return <ProctorStudentsSection />;
  }
  if (role === "proctor" && section === "review-queue") return <ReviewQueueSection />;

  if (role === "supervisor" && section === "dashboard") {
    return <SupervisorDashboardSection />;
  }

  if (role === "supervisor" && section === "ratings") {
    return <SupervisorRatingsSection />;
  }

  if (role === "supervisor" && section === "attendance") {
    return <SupervisorAttendanceSection />;
  }

  if (role === "supervisor" && section === "homework") {
    return <SupervisorHomeworkSection />;
  }

  if (role === "supervisor" && section === "tests") {
    return <SupervisorTestsSection />;
  }

  if (role === "supervisor" && section === "exams") {
    return <SupervisorExamsSection />;
  }

  const title = getSectionLabel(role, section) ?? section;
  return <EmptySection title={title} />;
}
