"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api/client";
import { isAdminCabinet } from "@/lib/auth/admin-access";
import { useExamResource } from "@/lib/exams-v2/hooks";
import type { Capabilities } from "@/lib/exams-v2/types";
import { AdminExamsSection } from "@/components/admin/exams/admin-exams-section";
import { StudentExamsSection } from "@/components/student/exams/student-exams-section";
import { AdminExams } from "./admin";
import { ExaminerExams } from "./examiner";
import { StudentExamResults } from "./student";
import { Empty, ErrorNotice, Loading, UnsavedExamChanges } from "./shared";

function ActorExams({ actor }: { actor: string }) {
  const { user } = useAuth();
  const resource = useExamResource<Capabilities>(
    user ? "/api/exams/capabilities" : null,
  );
  const legacy = () =>
    isAdminCabinet(user?.role) ? (
      <AdminExamsSection />
    ) : user?.role === "student" ? (
      <StudentExamsSection />
    ) : (
      <Empty>Проведение классических экзаменов ещё не включено</Empty>
    );
  if (!user) return null;
  if (resource.error)
    return resource.error instanceof ApiError &&
      resource.error.status === 404 ? (
      legacy()
    ) : (
      <ErrorNotice error={resource.error} reload={resource.reload} />
    );
  if (resource.loading || !resource.data)
    return <Loading text="Загружаем экзамены…" />;
  const caps = resource.data;
  if (isAdminCabinet(user.role))
    return caps.canReadAdminExams ? (
      <AdminExams actor={actor} capabilities={caps} />
    ) : (
      legacy()
    );
  if (user.role === "student")
    return caps.canReadStudentResults ? <StudentExamResults /> : legacy();
  if (user.role === "examinator")
    return <ExaminerExams actor={actor} enabled={caps.canConductClassic} />;
  return <Empty>Раздел не доступен для вашей роли</Empty>;
}
/** Account/permission changes unmount all in-flight personal screens immediately. */
export function ExamSection() {
  const { user } = useAuth();
  if (!user) return null;
  const actor = `${user.role}:${user.id}`;
  return (
    <>
      <UnsavedExamChanges />
      <ActorExams
        key={`${actor}:${JSON.stringify(user.permissions ?? {})}`}
        actor={actor}
      />
    </>
  );
}
