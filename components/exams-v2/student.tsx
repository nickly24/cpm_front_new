"use client";

import { queryString } from "@/lib/exams-v2/api";
import { useExamNavigation, useExamResource } from "@/lib/exams-v2/hooks";
import type {
  AttemptResult,
  Page,
  StudentResult,
  StudentResultDetail,
} from "@/lib/exams-v2/types";
import {
  formatDate,
  formatScore,
  GRADES,
  typeLabel,
} from "@/lib/exams-v2/utils";
import { Action, Empty, ErrorNotice, Field, Loading, Pager } from "./shared";
import { ExamProtocol } from "./protocol";
import s from "./exams.module.css";

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
            <h1>{data.directionName}</h1>
            <p className={s.subtitle}>{typeLabel(data.examType)}</p>
          </div>
          {current && (
            <>
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
export function StudentExamResults() {
  const nav = useExamNavigation();
  const examId = nav.id("examId");
  const type = nav.params?.get("type") ?? "all",
    grade = nav.params?.get("grade") ?? "",
    sort = nav.params?.get("sort") ?? "date_desc";
  const page = nav.id("page") ?? 1;
  const resource = useExamResource<Page<StudentResult>>(
    nav.initialized && !examId
      ? `/api/student/exams/results${queryString({ page, limit: 20, type, grade, sort })}`
      : null,
  );
  if (!nav.initialized) return <Loading />;
  if (examId)
    return (
      <Detail
        key={examId}
        examId={examId}
        attemptId={nav.id("attemptId")}
        select={(id) => nav.navigate({ attemptId: id })}
        back={() => nav.navigate({ examId: null, attemptId: null })}
      />
    );
  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h1>Результаты экзаменов</h1>
          <p className={s.subtitle}>Опубликованные оценки и история сдач</p>
        </div>
        <Action disabled={resource.loading} onClick={resource.reload}>
          Обновить
        </Action>
      </div>
      <div className={s.row}>
        <Field label="Тип экзамена">
          <select
            className={s.select}
            value={type}
            onChange={(e) => nav.navigate({ type: e.target.value, page: null })}
          >
            <option value="all">Все экзамены</option>
            <option value="classic">Классические</option>
            <option value="outside_lms">Вне системы LMS</option>
          </select>
        </Field>
        <Field label="Оценка">
          <select
            className={s.select}
            value={grade}
            onChange={(e) =>
              nav.navigate({ grade: e.target.value || null, page: null })
            }
          >
            <option value="">Любая</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Порядок">
          <select
            className={s.select}
            value={sort}
            onChange={(e) => nav.navigate({ sort: e.target.value, page: null })}
          >
            <option value="date_desc">Сначала новые</option>
            <option value="date_asc">Сначала старые</option>
            <option value="direction_asc">По направлению</option>
          </select>
        </Field>
      </div>
      <ErrorNotice error={resource.error} reload={resource.reload} />
      {resource.loading && <Loading />}
      <div className={s.grid}>
        {resource.data?.items.map((result) => {
          const classic = result.examType === "classic";
          const gradeValue = classic
            ? result.currentAttempt.grade
            : result.grade;
          return (
            <article key={result.examId} className={s.panel}>
              <div className={s.header}>
                <h2>{result.directionName}</h2>
                <strong className={s.score}>{gradeValue} / 5</strong>
              </div>
              <span className={s.badge}>{typeLabel(result.examType)}</span>
              <p className={s.muted}>
                {formatDate(classic ? result.startAt : result.date)}
              </p>
              {classic ? (
                <>
                  <p>
                    Баллы: {formatScore(result.currentAttempt.roundedTotal)} /{" "}
                    {formatScore(result.currentAttempt.maxScore)}
                  </p>
                  {result.currentAttempt.attemptNo === 2 && (
                    <span className={s.badge}>Текущий результат пересдачи</span>
                  )}
                  {result.currentAttempt.hasAppeal && (
                    <span className={s.badge}>После апелляции</span>
                  )}
                </>
              ) : (
                <>
                  <p>Баллы: {formatScore(result.points)}</p>
                  <p className={s.muted}>
                    {result.examinator ?? "Экзаменатор не указан"}
                  </p>
                </>
              )}
              <Action onClick={() => nav.navigate({ examId: result.examId })}>
                Подробности
              </Action>
            </article>
          );
        })}
      </div>
      {resource.data?.items.length === 0 && (
        <Empty>
          {type !== "all" || grade
            ? "По выбранным фильтрам результатов нет."
            : "Здесь появятся результаты завершённых экзаменов."}
        </Empty>
      )}
      <Pager
        pagination={resource.data?.pagination}
        onPage={(value) => nav.navigate({ page: value })}
      />
    </div>
  );
}
