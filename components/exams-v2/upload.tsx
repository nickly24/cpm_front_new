"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessSection } from "@/lib/auth/admin-access";
import { queryString } from "@/lib/exams-v2/api";
import { useExamResource } from "@/lib/exams-v2/hooks";
import type { Capabilities, ExamSummary, Page } from "@/lib/exams-v2/types";
import { formatDate } from "@/lib/exams-v2/utils";
import { Action, Empty, ErrorNotice, Field, Loading, Pager } from "./shared";
import { ExamImport } from "./import";
import s from "./exams.module.css";

function UploadWorkspace({ actor }: { actor: string }) {
  const { user } = useAuth();
  const canView =
    canAccessSection(user, "exams") && canAccessSection(user, "upload");
  const capabilities = useExamResource<Capabilities>(
    canView ? "/api/exams/capabilities" : null,
  );
  const [exam, setExam] = useState<ExamSummary | null>(null);
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState("");
  const resource = useExamResource<Page<ExamSummary>>(
    canView && capabilities.data?.canReadAdminExams && !exam
      ? `/api/exams${queryString({ type: "outside_lms", page, limit: 20, search: query })}`
      : null,
  );
  const canEdit =
    canAccessSection(user, "upload", "edit") &&
    canAccessSection(user, "exams", "edit") &&
    capabilities.data?.canManageOutside === true;
  if (!canView)
    return (
      <Empty>Для импорта нужны права на разделы «Загрузка» и «Экзамены».</Empty>
    );
  return (
    <section className={s.page}>
      <h2>Результаты экзамена вне LMS</h2>
      <ErrorNotice error={capabilities.error} reload={capabilities.reload} />
      {capabilities.loading && <Loading />}
      {capabilities.data && !capabilities.data.canReadAdminExams && (
        <Empty>Новый импорт экзаменов ещё не включён.</Empty>
      )}
      {exam ? (
        <>
          <div className={s.header}>
            <h3>
              {exam.directionName} · {formatDate(exam.date)}
            </h3>
            <Action onClick={() => setExam(null)}>
              Выбрать другой экзамен
            </Action>
          </div>
          <ExamImport
            actor={actor}
            examId={exam.id}
            canEdit={canEdit}
            onChanged={() => {}}
            kind="outside"
          />
        </>
      ) : (
        capabilities.data?.canReadAdminExams && (
          <>
            <p className={s.muted}>
              Выберите экзамен, затем загрузите таблицу. Импорт только добавляет
              результаты — существующие нужно редактировать в разделе экзаменов.
            </p>
            <form
              className={s.row}
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(search.trim());
                setPage(1);
              }}
            >
              <Field label="Направление">
                <input
                  className={s.input}
                  maxLength={200}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Field>
              <Action type="submit">Найти</Action>
            </form>
            <ErrorNotice error={resource.error} reload={resource.reload} />
            {resource.loading && <Loading />}
            {resource.data?.items.map((item) => (
              <Action key={item.id} onClick={() => setExam(item)}>
                {item.directionName} · {formatDate(item.date)} · ID {item.id}
              </Action>
            ))}
            {resource.data?.items.length === 0 && (
              <Empty>
                Подходящих экзаменов нет. Создайте экзамен вне LMS в разделе
                «Экзамены».
              </Empty>
            )}
            <Pager pagination={resource.data?.pagination} onPage={setPage} />
          </>
        )
      )}
    </section>
  );
}
export function ExamResultsUpload() {
  const { user } = useAuth();
  if (!user) return null;
  const actor = `${user.role}:${user.id}`;
  return (
    <UploadWorkspace
      key={`${actor}:${JSON.stringify(user.permissions)}`}
      actor={actor}
    />
  );
}
