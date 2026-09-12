"use client";

import { useState } from "react";
import { queryString } from "@/lib/exams-v2/api";
import { useExamMutation, useExamResource } from "@/lib/exams-v2/hooks";
import type {
  AdminAttempt,
  AdminCurrentResult,
  Appeal,
  Commission,
  Grade,
  OutsideResult,
  Page,
  Person,
} from "@/lib/exams-v2/types";
import {
  formatDate,
  formatScore,
  GRADES,
  statusLabel,
} from "@/lib/exams-v2/utils";
import {
  Action,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  MutationNotice,
  Pager,
  PersonPicker,
} from "./shared";
import { ResultSummary } from "./student";
import { ExamProtocol } from "./protocol";
import { DeleteEntity } from "./admin-delete";
import { CommissionSelector } from "./admin-assignments";
import { ExamImport } from "./import";
import type { AdminPanelProps } from "./admin-settings";
import s from "./exams.module.css";

function OutsideEditor({
  initial,
  close,
  ...props
}: AdminPanelProps & { initial: OutsideResult | null; close: () => void }) {
  const [student, setStudent] = useState<Person | null>(
    initial ? { id: initial.studentId, fullName: initial.studentName } : null,
  );
  const [points, setPoints] = useState(String(initial?.points ?? "")),
    [grade, setGrade] = useState<Grade>(initial?.grade ?? 0),
    [name, setName] = useState(initial?.examinator ?? "");
  const mutation = useExamMutation(
    `${props.actor}:outside:${props.examId}:${initial?.id ?? "new"}`,
    () => {
      props.onChanged();
      close();
    },
  );
  return (
    <Modal
      title={initial ? "Редактировать результат" : "Добавить результат"}
      onClose={close}
      busy={mutation.busy}
    >
      <form
        data-exam-editor
        className={s.stack}
        onSubmit={(e) => {
          e.preventDefault();
          if (!student) return;
          void mutation.execute({
            path: `/api/exams/${props.examId}/outside-lms/results${initial ? `/${initial.id}` : ""}`,
            method: initial ? "PATCH" : "POST",
            body: {
              points: Number(points),
              grade,
              examinator: name.trim(),
              ...(initial
                ? { expectedVersion: initial.version }
                : { studentId: student.id }),
            },
          });
        }}
      >
        {initial ? (
          <p>
            <strong>{initial.studentName}</strong> · ID {initial.studentId}
          </p>
        ) : (
          <PersonPicker
            kind="students"
            label="Студент"
            value={student}
            onChange={setStudent}
            disabled={mutation.busy || mutation.uncertain}
          />
        )}
        <div className={s.grid}>
          <Field label="Баллы">
            <input
              className={s.input}
              type="number"
              min={0}
              max={9999999999.99}
              step="0.01"
              required
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              disabled={mutation.busy || mutation.uncertain}
            />
          </Field>
          <Field label="Оценка">
            <select
              className={s.select}
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value) as Grade)}
              disabled={mutation.busy || mutation.uncertain}
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Имя экзаменатора">
          <input
            className={s.input}
            value={name}
            maxLength={255}
            required
            onChange={(e) => setName(e.target.value)}
            disabled={mutation.busy || mutation.uncertain}
          />
        </Field>
        <p className={s.muted}>
          Баллы не привязаны к максимальному значению. Оценка — целое число от 0
          до 5.
        </p>
        <MutationNotice mutation={mutation} reload={props.onChanged} />
        <Action
          primary
          type="submit"
          disabled={
            !props.canEdit ||
            mutation.busy ||
            mutation.uncertain ||
            !student ||
            !name.trim()
          }
        >
          Сохранить результат
        </Action>
      </form>
    </Modal>
  );
}
export function OutsideResults(props: AdminPanelProps) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("student_asc");
  const [editing, setEditing] = useState<OutsideResult | "new" | null>(null),
    [deleting, setDeleting] = useState<OutsideResult | null>(null),
    [importing, setImporting] = useState(false);
  const resource = useExamResource<Page<OutsideResult>>(
    `/api/exams/${props.examId}/outside-lms/results${queryString({ page, limit: 20, search: query, sort })}`,
  );
  const changed = () => {
    resource.reload();
    props.onChanged();
  };
  return (
    <section className={s.panel}>
      <div className={s.header}>
        <h2>Результаты вне LMS</h2>
        {props.canEdit && (
          <div className={s.row}>
            <Action onClick={() => setImporting(!importing)}>
              Импорт .xlsx
            </Action>
            <Action primary onClick={() => setEditing("new")}>
              Добавить результат
            </Action>
          </div>
        )}
      </div>
      {importing && (
        <ExamImport {...props} kind="outside" onChanged={changed} />
      )}
      <form
        className={s.row}
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
          setPage(1);
        }}
      >
        <Field label="Студент или экзаменатор">
          <input
            className={s.input}
            value={search}
            maxLength={200}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field label="Порядок">
          <select
            className={s.select}
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="student_asc">По студенту</option>
            <option value="grade_desc">По оценке</option>
            <option value="points_desc">По баллам</option>
            <option value="updated_desc">По изменению</option>
          </select>
        </Field>
        <Action type="submit">Найти</Action>
        <Action onClick={resource.reload}>Обновить</Action>
      </form>
      <ErrorNotice error={resource.error} reload={resource.reload} />
      {resource.loading && <Loading />}
      {resource.data?.items.map((result) => (
        <article key={result.id} className={s.item}>
          <div className={s.header}>
            <strong>
              {result.studentName} · ID {result.studentId}
            </strong>
            <strong className={s.score}>{result.grade} / 5</strong>
          </div>
          <p>Баллы: {formatScore(result.points)}</p>
          <p className={s.muted}>Экзаменатор: {result.examinator ?? "—"}</p>
          {props.canEdit && (
            <div className={s.row}>
              <Action onClick={() => setEditing(result)}>Редактировать</Action>
              <Action danger onClick={() => setDeleting(result)}>
                Удалить
              </Action>
            </div>
          )}
        </article>
      ))}
      {resource.data?.items.length === 0 && (
        <Empty>Результатов по выбранным условиям нет</Empty>
      )}
      <Pager pagination={resource.data?.pagination} onPage={setPage} />
      {editing && (
        <OutsideEditor
          {...props}
          initial={editing === "new" ? null : editing}
          close={() => setEditing(null)}
          onChanged={changed}
        />
      )}
      {deleting && (
        <DeleteEntity
          actor={props.actor}
          canEdit={props.canEdit}
          title="Удалить результат?"
          description={`${deleting.studentName}: будет удалена оценка ${deleting.grade} и ${formatScore(deleting.points)} баллов. Если экзамен включён в рейтинг, он будет учитываться с нулём.`}
          path={`/api/exams/${props.examId}/outside-lms/results/${deleting.id}`}
          version={deleting.version}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            changed();
          }}
        />
      )}
    </section>
  );
}
function AppealEditor({
  attempt,
  close,
  ...props
}: AdminPanelProps & { attempt: AdminAttempt; close: () => void }) {
  const [grade, setGrade] = useState<Grade>(
    attempt.result?.grade ?? attempt.grade ?? 0,
  );
  const mutation = useExamMutation(
    `${props.actor}:appeal:${attempt.id}`,
    () => {
      props.onChanged();
      close();
    },
  );
  return (
    <Modal
      title="Результат после апелляции"
      onClose={close}
      busy={mutation.busy}
    >
      <form
        data-exam-editor
        className={s.stack}
        onSubmit={(e) => {
          e.preventDefault();
          void mutation.execute({
            path: `/api/exams/${props.examId}/classic/attempts/${attempt.id}/appeals`,
            method: "POST",
            body: {
              grade,
              expectedResultVersion:
                attempt.resultVersion ?? attempt.result?.resultVersion,
            },
          });
        }}
      >
        <p>
          <strong>{attempt.student.fullName}</strong> ·{" "}
          {attempt.attemptNo === 2 ? "Пересдача" : "Первая сдача"}
        </p>
        <Field label="Новая итоговая оценка">
          <select
            className={s.select}
            value={grade}
            onChange={(e) => setGrade(Number(e.target.value) as Grade)}
            disabled={mutation.busy || mutation.uncertain}
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>
        <p className={s.muted}>
          Сохранится факт апелляции, в том числе если оценка не изменилась.
          Баллы и протокол не переписываются. Апелляция предыдущей сдачи не
          меняет текущий результат завершённой пересдачи.
        </p>
        <MutationNotice mutation={mutation} reload={props.onChanged} />
        <Action
          primary
          type="submit"
          disabled={
            !props.canEdit ||
            mutation.busy ||
            mutation.uncertain ||
            !(attempt.resultVersion ?? attempt.result?.resultVersion)
          }
        >
          Опубликовать оценку после апелляции
        </Action>
      </form>
    </Modal>
  );
}
function RetakeEditor({
  student,
  historyGeneration,
  close,
  ...props
}: AdminPanelProps & {
  student: Person;
  historyGeneration: number;
  close: () => void;
}) {
  const [commission, setCommission] = useState<Commission | null>(null);
  const mutation = useExamMutation(
    `${props.actor}:retake:${props.examId}:${student.id}`,
    () => {
      props.onChanged();
      close();
    },
  );
  return (
    <Modal title="Назначить пересдачу" onClose={close} busy={mutation.busy}>
      <p>
        <strong>{student.fullName}</strong>
      </p>
      <p className={s.muted}>
        Доступна одна пересдача. Комиссия должна отличаться хотя бы одним
        участником. Текущая оценка останется опубликованной до завершения
        пересдачи; затем новый результат станет текущим, даже если он ниже.
      </p>
      <CommissionSelector
        examId={props.examId}
        value={commission}
        onChange={setCommission}
        disabled={mutation.busy || mutation.uncertain}
      />
      <MutationNotice mutation={mutation} reload={props.onChanged} />
      <Action
        primary
        disabled={
          !props.canEdit ||
          !commission ||
          !historyGeneration ||
          mutation.busy ||
          mutation.uncertain
        }
        onClick={() =>
          void mutation.execute({
            path: `/api/exams/${props.examId}/classic/students/${student.id}/retake`,
            method: "POST",
            body: {
              commissionId: commission!.id,
              expectedHistoryGeneration: historyGeneration,
            },
          })
        }
      >
        Назначить пересдачу
      </Action>
    </Modal>
  );
}
function AppealHistory({ path }: { path: string }) {
  const [page, setPage] = useState(1);
  const resource = useExamResource<Page<Appeal>>(
    `${path}${queryString({ page, limit: 20 })}`,
  );
  return (
    <section className={s.panel}>
      <h3>История апелляций</h3>
      <ErrorNotice error={resource.error} reload={resource.reload} />
      {resource.loading && <Loading />}
      {resource.data?.items.map((appeal) => (
        <div key={appeal.id} className={s.item}>
          Оценка {appeal.previousGrade} → {appeal.newGrade}
          <span className={s.muted}>{formatDate(appeal.createdAt)}</span>
        </div>
      ))}
      {resource.data?.items.length === 0 && <Empty>Апелляций не было</Empty>}
      <Pager pagination={resource.data?.pagination} onPage={setPage} />
    </section>
  );
}
export function AdminAttemptDetail({
  attemptId,
  back,
  ...props
}: AdminPanelProps & { attemptId: number; back: () => void }) {
  const resource = useExamResource<{ attempt: AdminAttempt }>(
    `/api/exams/${props.examId}/classic/attempts/${attemptId}`,
  );
  const [appeal, setAppeal] = useState(false),
    [deletion, setDeletion] = useState(false),
    [appealHistory, setAppealHistory] = useState(false),
    [revision, setRevision] = useState(0);
  const attempt = resource.data?.attempt;
  const changed = () => {
    resource.reload();
    setRevision((n) => n + 1);
    props.onChanged();
  };
  return (
    <div className={s.stack}>
      <div className={s.header}>
        <Action onClick={back}>← К списку</Action>
        <Action onClick={changed} disabled={resource.loading}>
          Обновить сдачу
        </Action>
      </div>
      <ErrorNotice error={resource.error} reload={resource.reload} />
      {resource.loading && <Loading />}
      {attempt && (
        <>
          <section className={s.panel}>
            <div className={s.header}>
              <h2>{attempt.student.fullName}</h2>
              <span className={s.badge}>{statusLabel(attempt.status)}</span>
            </div>
            <p className={s.muted}>
              Сдача #{attempt.id} ·{" "}
              {attempt.attemptNo === 2 ? "Пересдача" : "Первая сдача"}
            </p>
            {(attempt.members ?? attempt.commission)?.length ? (
              <p className={s.muted}>
                Комиссия:{" "}
                {(attempt.members ?? attempt.commission)
                  ?.map((m) => m.fullName)
                  .join(", ")}
              </p>
            ) : null}
            <div className={s.row}>
              {props.canEdit && attempt.status === "completed" && (
                <Action primary onClick={() => setAppeal(true)}>
                  Апелляция
                </Action>
              )}
              {attempt.status === "completed" && (
                <Action onClick={() => setAppealHistory(!appealHistory)}>
                  История апелляций
                </Action>
              )}
              {props.canEdit && (
                <Action danger onClick={() => setDeletion(true)}>
                  Очистить всю историю студента
                </Action>
              )}
            </div>
          </section>
          {attempt.result && <ResultSummary result={attempt.result} />}
          {appealHistory && (
            <AppealHistory
              key={revision}
              path={`/api/exams/${props.examId}/classic/attempts/${attempt.id}/appeals`}
            />
          )}
          <ExamProtocol
            key={`${attempt.id}:${revision}`}
            path={`/api/exams/${props.examId}/classic/attempts/${attempt.id}/questions`}
            showRounds
          />
          {appeal && (
            <AppealEditor
              {...props}
              attempt={attempt}
              close={() => setAppeal(false)}
              onChanged={changed}
            />
          )}
          {deletion && (
            <DeleteEntity
              actor={props.actor}
              canEdit={props.canEdit}
              title={`Очистить историю: ${attempt.student.fullName}?`}
              description="Удалятся первая сдача, пересдача, все вопросы, голоса, апелляции и результаты этого студента в экзамене. Первое назначение и привилегия останутся, назначение пересдачи удалится. Можно будет начать с чистого листа."
              path={`/api/exams/${props.examId}/classic/students/${attempt.student.id}/history`}
              previewPath={`/api/exams/${props.examId}/classic/students/${attempt.student.id}/delete-preview`}
              onClose={() => setDeletion(false)}
              onDeleted={() => {
                props.onChanged();
                back();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
export function ClassicAttempts({
  selectAttempt,
  ...props
}: AdminPanelProps & { selectAttempt: (id: number) => void }) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [attemptNo, setAttemptNo] = useState("");
  const resource = useExamResource<Page<AdminAttempt>>(
    `/api/exams/${props.examId}/classic/attempts${queryString({ page, limit: 20, search: query, status, attemptNo })}`,
  );
  return (
    <section className={s.panel}>
      <div className={s.header}>
        <h2>Сдачи и текущие сессии</h2>
        <Action onClick={resource.reload} disabled={resource.loading}>
          Обновить
        </Action>
      </div>
      <form
        className={s.row}
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <Field label="Студент">
          <input
            className={s.input}
            value={search}
            maxLength={200}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field label="Состояние">
          <select
            className={s.select}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Все</option>
            {["pending_ready", "in_progress", "completed"].map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Сдача">
          <select
            className={s.select}
            value={attemptNo}
            onChange={(e) => {
              setAttemptNo(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Все</option>
            <option value="1">Первая</option>
            <option value="2">Пересдача</option>
          </select>
        </Field>
        <Action type="submit">Найти</Action>
      </form>
      <ErrorNotice error={resource.error} reload={resource.reload} />
      {resource.loading && <Loading />}
      {resource.data?.items.map((attempt) => (
        <article key={attempt.id} className={s.item}>
          <div className={s.header}>
            <strong>{attempt.student.fullName}</strong>
            <span className={s.badge}>{statusLabel(attempt.status)}</span>
          </div>
          <p className={s.muted}>
            {attempt.attemptNo === 2 ? "Пересдача" : "Первая сдача"} · #
            {attempt.id}
          </p>
          <Action onClick={() => selectAttempt(attempt.id)}>
            Открыть протокол и действия
          </Action>
        </article>
      ))}
      {resource.data?.items.length === 0 && (
        <Empty>Сессий по выбранным условиям нет</Empty>
      )}
      <Pager pagination={resource.data?.pagination} onPage={setPage} />
    </section>
  );
}
export function ClassicResults({
  selectAttempt,
  ...props
}: AdminPanelProps & { selectAttempt: (id: number) => void }) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [grade, setGrade] = useState(""),
    [hasAppeal, setHasAppeal] = useState("");
  const [retake, setRetake] = useState<AdminCurrentResult | null>(null);
  const resource = useExamResource<Page<AdminCurrentResult>>(
    `/api/exams/${props.examId}/classic/results${queryString({ page, limit: 20, search: query, grade, hasAppeal })}`,
  );
  const changed = () => {
    resource.reload();
    props.onChanged();
  };
  return (
    <section className={s.panel}>
      <div className={s.header}>
        <h2>Текущие результаты</h2>
        <Action onClick={resource.reload} disabled={resource.loading}>
          Обновить
        </Action>
      </div>
      <p className={s.muted}>
        Одна строка на студента. Незавершённая пересдача не заменяет первую
        оценку.
      </p>
      <form
        className={s.row}
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <Field label="Студент">
          <input
            className={s.input}
            value={search}
            maxLength={200}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field label="Оценка">
          <select
            className={s.select}
            value={grade}
            onChange={(e) => {
              setGrade(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Любая</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Апелляция">
          <select
            className={s.select}
            value={hasAppeal}
            onChange={(e) => {
              setHasAppeal(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Все</option>
            <option value="true">Есть</option>
            <option value="false">Нет</option>
          </select>
        </Field>
        <Action type="submit">Найти</Action>
      </form>
      <ErrorNotice error={resource.error} reload={resource.reload} />
      {resource.loading && <Loading />}
      {resource.data?.items.map((row) => (
        <article key={row.student.id} className={s.item}>
          <div className={s.header}>
            <strong>{row.student.fullName}</strong>
            <strong className={s.score}>{row.effectiveGrade} / 5</strong>
          </div>
          <p>
            Баллы: {formatScore(row.roundedTotal)} / {formatScore(row.maxScore)}
          </p>
          <div className={s.row}>
            <span className={s.badge}>
              {row.currentAttemptNo === 2
                ? "Текущий результат пересдачи"
                : "Первая сдача"}
            </span>
            {row.hasAppeal && <span className={s.badge}>После апелляции</span>}
            {row.retakeStatus && row.retakeStatus !== "completed" && (
              <span className={s.badge}>
                Пересдача: {statusLabel(row.retakeStatus)}
              </span>
            )}
          </div>
          <div className={s.row}>
            <Action onClick={() => selectAttempt(row.currentAttemptId)}>
              Текущая сдача и апелляция
            </Action>
            {row.firstAttemptId !== row.currentAttemptId && (
              <Action onClick={() => selectAttempt(row.firstAttemptId)}>
                История первой сдачи
              </Action>
            )}
            {props.canEdit &&
              !row.retakeAssignmentId &&
              row.currentAttemptNo === 1 && (
                <Action onClick={() => setRetake(row)}>
                  Назначить пересдачу
                </Action>
              )}
          </div>
        </article>
      ))}
      {resource.data?.items.length === 0 && (
        <Empty>Опубликованных результатов по выбранным условиям нет</Empty>
      )}
      <Pager pagination={resource.data?.pagination} onPage={setPage} />
      {retake && (
        <RetakeEditor
          {...props}
          student={retake.student}
          historyGeneration={retake.historyGeneration}
          close={() => setRetake(null)}
          onChanged={changed}
        />
      )}
    </section>
  );
}
