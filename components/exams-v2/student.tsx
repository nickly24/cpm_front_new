"use client";

import { useState } from "react";
import { BFF_DEV } from "@/lib/config";
import type { TrainingSectionNode } from "@/lib/training/training-types";
import Link from "next/link";
import { examTrainingPath } from "@/lib/training/training-routes";
import { useExamNavigation, useExamResource } from "@/lib/exams-v2/hooks";
import type {
  AttemptResult,
  AttemptStatus,
  Page,
  StudentResultDetail,
} from "@/lib/exams-v2/types";
import {
  formatDate,
  formatScore,
  typeLabel,
} from "@/lib/exams-v2/utils";
import { Action, ErrorNotice, Loading, Pager } from "./shared";
import { ExamProtocol } from "./protocol";
import s from "./exams.module.css";
import { StudentExamResultList } from "@/components/student/exams/student-exam-result-list";
import studentStyles from "@/components/student/exams/student-exam-results.module.css";

export function PendingRetakeNotice({ active, status, compact = false }: { active?: boolean; status?: AttemptStatus | null; compact?: boolean }) {
  if (!active || status === "completed") return null;
  const label = status === "in_progress" ? "Пересдача в процессе" : status === "pending_ready" ? "Пересдача ожидает готовности комиссии" : "Пересдача ожидает начала";
  return compact ? <span className={s.badge}>{label}</span> : <p className={s.warning} role="status">{label}. До её завершения показан последний завершённый результат.</p>;
}
export function ResultSummary({ result }: { result: AttemptResult }) {
  return (
    <section className={s.panel}>
      <div className={s.header}>
        <h2>{result.attemptNo === 2 ? "Пересдача" : "Первая сдача"}</h2>
        {result.hasAppeal && <span className={s.badge}>После апелляции</span>}
      </div>
      <div className={s.stats}>
        <div className={s.stat}>
          <span className={s.muted}>Оценка</span>
          <strong className={s.score}>{result.grade} / 5</strong>
        </div>
        <div className={s.stat}>
          <span className={s.muted}>Итоговые баллы</span>
          <strong className={s.score}>
            {formatScore(result.roundedTotal)} / {formatScore(result.maxScore)}
          </strong>
          <span className={s.muted}>
            До округления: {formatScore(result.rawTotal)}
          </span>
        </div>
      </div>
      <p className={s.muted}>Завершён {formatDate(result.completedAt)}</p>
      {result.commission?.length ? (
        <p className={s.muted}>
          Комиссия: {result.commission.map((m) => m.fullName).join(", ")}
        </p>
      ) : null}
    </section>
  );
}
function Detail({
  examId,
  attemptId,
  select,
  back,
}: {
  examId: number;
  attemptId: number | null;
  select: (id: number) => void;
  back: () => void;
}) {
  const resource = useExamResource<StudentResultDetail>(
    `/api/student/exams/${examId}/result`,
  );
  const data = resource.data;
  const current =
    data?.examType === "classic" ? (data.current as AttemptResult) : null;
  const attempts = current ? [current, ...(data?.history ?? [])] : [];
  const selected =
    attempts.find((attempt) => attempt.attemptId === attemptId) ?? current;
  return (
    <div className={s.page}>
      <div className={s.header}>
        <Action onClick={back}>← Все результаты</Action>
        <Action disabled={resource.loading} onClick={resource.reload}>
          Обновить
        </Action>
      </div>
      <ErrorNotice error={resource.error} reload={resource.reload} />
      {resource.loading && <Loading />}
      {data && (
        <>
          <div>
            <h1>{data.examName || data.directionName}</h1>
            <p className={s.subtitle}>{data.examName ? `${data.directionName} · ` : ""}{typeLabel(data.examType)}</p>
            {data.examType === "classic" && data.trainingEnabled ? <Link className={s.button} href={examTrainingPath("student", examId)}>Подготовка по карточкам</Link> : null}
          </div>
          {current && (
            <>
              <PendingRetakeNotice active={data.hasActiveRetake} status={data.retakeStatus} />
              <div className={s.tabs} role="group" aria-label="Сдачи экзамена">
                {attempts.map((attempt, index) => (
                  <Action
                    key={attempt.attemptId}
                    className={
                      selected?.attemptId === attempt.attemptId
                        ? s.selected
                        : ""
                    }
                    onClick={() => select(attempt.attemptId)}
                  >
                    {index === 0 ? "Текущий результат" : "Предыдущая сдача"} ·{" "}
                    {attempt.grade} / 5
                  </Action>
                ))}
              </div>
              {selected && (
                <>
                  <ResultSummary result={selected} />
                  <ExamProtocol
                    key={selected.attemptId}
                    path={`/api/student/exams/${examId}/attempts/${selected.attemptId}/questions`}
                  />
                </>
              )}
            </>
          )}
          {data.examType === "outside_lms" && "points" in data.current && (
            <section className={s.panel}>
              <strong className={s.score}>{data.current.grade} / 5</strong>
              <p>Баллы: {formatScore(data.current.points)}</p>
              <p>Экзаменатор: {data.current.examinator ?? "—"}</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
function AvailableExamTraining() {
  const [page, setPage] = useState(1);
  const resource = useExamResource<Page<TrainingSectionNode>>(BFF_DEV ? `/api/student/exams/training?page=${page}&limit=12` : null);
  if (!BFF_DEV) return null;
  return <section className={studentStyles.trainingList} aria-label="Доступная подготовка к экзаменам">
    <ErrorNotice error={resource.error} reload={resource.reload} />
    {resource.loading && <Loading />}
    <div>{resource.data?.items.map(exam => <article className={studentStyles.trainingRow} key={exam.refId}>
      <h3>{exam.name}</h3><p>{exam.learned_cards} из {exam.total_cards} карточек выучено</p>
      <Link className={s.button} href={examTrainingPath("student", exam.exam_id!)}>Подготовка по карточкам</Link>
    </article>)}</div>
    {resource.data?.items.length === 0 ? <p className={s.muted}>Здесь появятся экзамены с открытой подготовкой.</p> : null}
    {resource.data && resource.data.pagination.totalPages > 1 ? <Pager pagination={resource.data.pagination} onPage={setPage} /> : null}
  </section>;
}
export function StudentExamResults() {
  const nav = useExamNavigation();
  const examId = nav.id("examId");
  if (!nav.initialized) return <Loading />;
  return <div className={studentStyles.section}>
    <div className={studentStyles.listHost} hidden={Boolean(examId)} inert={Boolean(examId)}>
      <StudentExamResultList nav={nav} active={!examId} training={<AvailableExamTraining />} />
    </div>
    {examId ? <div className={studentStyles.detailScroll}><Detail key={examId} examId={examId} attemptId={nav.id("attemptId")} select={id => nav.navigate({ attemptId: id })} back={() => nav.navigate({ examId: null, attemptId: null })} /></div> : null}
  </div>;
}
