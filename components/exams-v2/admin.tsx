"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessSection } from "@/lib/auth/admin-access";
import { getExamDirections, queryString } from "@/lib/exams-v2/api";
import {
  useExamMutation,
  useExamNavigation,
  useExamResource,
} from "@/lib/exams-v2/hooks";
import type {
  Capabilities,
  Direction,
  ExamSummary,
  ExamType,
  Page,
} from "@/lib/exams-v2/types";
import { formatDate, typeLabel } from "@/lib/exams-v2/utils";
import {
  Action,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  MutationNotice,
  Pager,
} from "./shared";
import { ClassicScoring, ClassicSettings } from "./admin-settings";
import { ClassicBank } from "./admin-bank";
import {
  ClassicAssignments,
  ClassicCommissions,
  ClassicPrivileges,
} from "./admin-assignments";
import {
  AdminAttemptDetail,
  ClassicAttempts,
  ClassicResults,
  OutsideResults,
} from "./admin-results";
import { DeleteEntity } from "./admin-delete";
import s from "./exams.module.css";

export function useExamDirections(enabled = true) {
  const [data, setData] = useState<Direction[]>([]),
    [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    getExamDirections(controller.signal).then(
      (directions) => {
        if (!controller.signal.aborted) setData(directions);
      },
      (err: unknown) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error
              ? err
              : new Error("Не удалось загрузить направления"),
          );
      },
    );
    return () => controller.abort();
  }, [enabled]);
  return { data, error };
}
function CreateExam({
  actor,
  capabilities,
  canEdit,
  close,
  created,
}: {
  actor: string;
  capabilities: Capabilities;
  canEdit: boolean;
  close: () => void;
  created: (exam: ExamSummary) => void;
}) {
  const directions = useExamDirections();
  const [type, setType] = useState<ExamType>(
      capabilities.canCreateClassic ? "classic" : "outside_lms",
    ),
    [direction, setDirection] = useState(""),
    [date, setDate] = useState("");
  const mutation = useExamMutation<{ exam: ExamSummary }>(
    `${actor}:create-exam`,
    (result) => created(result.exam),
  );
  return (
    <Modal title="Создать экзамен" onClose={close} busy={mutation.busy}>
      <form
        data-exam-editor
        className={s.stack}
        onSubmit={(e) => {
          e.preventDefault();
          void mutation.execute({
            path: "/api/exams",
            method: "POST",
            body: {
              examType: type,
              directionId: Number(direction),
              ...(type === "outside_lms" ? { date } : {}),
            },
          });
        }}
      >
        <Field label="Тип">
          <select
            className={s.select}
            value={type}
            onChange={(e) => setType(e.target.value as ExamType)}
            disabled={mutation.busy || mutation.uncertain}
          >
            {capabilities.canCreateClassic && (
              <option value="classic">Классический экзамен</option>
            )}
            {capabilities.canManageOutside && (
              <option value="outside_lms">Экзамен вне системы LMS</option>
            )}
          </select>
        </Field>
        <Field label="Направление">
          <select
            className={s.select}
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            required
            disabled={mutation.busy || mutation.uncertain}
          >
            <option value="">Выберите направление</option>
            {directions.data.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <p className={s.muted}>
          Название экзамена берётся из направления и обновляется при его
          переименовании. После создания можно постепенно дополнить настройки.
        </p>
        {type === "outside_lms" && (
          <Field label="Дата экзамена">
            <input
              className={s.input}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              disabled={mutation.busy || mutation.uncertain}
            />
          </Field>
        )}
        <ErrorNotice error={directions.error} />
        <MutationNotice mutation={mutation} />
        <Action
          primary
          type="submit"
          disabled={
            !canEdit ||
            mutation.busy ||
            mutation.uncertain ||
            !direction ||
            (type === "classic"
              ? !capabilities.canCreateClassic
              : !capabilities.canManageOutside)
          }
        >
          Создать экзамен
        </Action>
      </form>
    </Modal>
  );
}
function DirectionEditor({
  exam,
  actor,
  canEdit,
  close,
  changed,
}: {
  exam: ExamSummary;
  actor: string;
  canEdit: boolean;
  close: () => void;
  changed: () => void;
}) {
  const directions = useExamDirections();
  const [direction, setDirection] = useState(String(exam.directionId ?? ""));
  const mutation = useExamMutation(`${actor}:direction:${exam.id}`, () => {
    changed();
    close();
  });
  return (
    <Modal
      title="Изменить направление экзамена"
      onClose={close}
      busy={mutation.busy}
    >
      <p className={s.warning}>
        Все результаты этого экзамена будут относиться к новому направлению.
        Оценки не пересчитываются.
      </p>
      <Field label="Направление">
        <select
          className={s.select}
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          disabled={mutation.busy || mutation.uncertain}
        >
          <option value="">Выберите направление</option>
          {directions.data.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>
      <ErrorNotice error={directions.error} />
      <MutationNotice mutation={mutation} reload={changed} />
      <Action
        primary
        disabled={!canEdit || !direction || mutation.busy || mutation.uncertain}
        onClick={() =>
          void mutation.execute({
            path: `/api/exams/${exam.id}/direction`,
            method: "PATCH",
            body: {
              directionId: Number(direction),
              expectedVersion: exam.version,
            },
          })
        }
      >
        Сохранить направление
      </Action>
    </Modal>
  );
}
function OutsideDate({
  exam,
  actor,
  canEdit,
  changed,
}: {
  exam: ExamSummary;
  actor: string;
  canEdit: boolean;
  changed: () => void;
}) {
  const [date, setDate] = useState(exam.date ?? "");
  const mutation = useExamMutation(`${actor}:date:${exam.id}`, changed);
  return (
    <form
      data-exam-editor
      className={s.panel}
      onSubmit={(e) => {
        e.preventDefault();
        void mutation.execute({
          path: `/api/exams/${exam.id}/outside-lms`,
          method: "PATCH",
          body: { date, expectedVersion: exam.version },
        });
      }}
    >
      <h2>Дата экзамена</h2>
      <Field label="Календарная дата">
        <input
          className={s.input}
          type="date"
          value={date}
          required
          onChange={(e) => setDate(e.target.value)}
          disabled={!canEdit || mutation.busy}
        />
      </Field>
      <MutationNotice mutation={mutation} reload={changed} />
      {canEdit && (
        <Action
          primary
          type="submit"
          disabled={mutation.busy || mutation.uncertain}
        >
          Сохранить дату
        </Action>
      )}
    </form>
  );
}
interface Overview {
  exam: ExamSummary;
  classic?: {
    partsCount: number;
    questionsCount: number;
    commissionsCount: number;
    assignmentsCount: number;
    resultsCount: number;
    attempts: { pending: number; inProgress: number; completed: number };
  };
  outsideLms?: { resultsCount: number; averageGrade: number };
}
function Workspace({
  examId,
  actor,
  capabilities,
  canEdit,
  tab,
  attemptId,
  navigate,
  back,
}: {
  examId: number;
  actor: string;
  capabilities: Capabilities;
  canEdit: boolean;
  tab: string;
  attemptId: number | null;
  navigate: (changes: Record<string, string | number | null>) => void;
  back: () => void;
}) {
  const overview = useExamResource<Overview>(`/api/exams/${examId}/overview`);
  const [directionEdit, setDirectionEdit] = useState(false),
    [deleting, setDeleting] = useState(false);
  const exam = overview.data?.exam;
  const editable =
    canEdit &&
    (exam?.examType !== "outside_lms" || capabilities.canManageOutside);
  const props = {
    examId,
    actor,
    canEdit: editable,
    onChanged: overview.reload,
  };
  const tabs =
    exam?.examType === "classic"
      ? [
          "overview",
          "questions",
          "scoring",
          "commissions",
          "assignments",
          "privileges",
          "attempts",
          "results",
        ]
      : ["overview", "results"];
  const activeTab = tabs.includes(tab) ? tab : "overview";
  const labels: Record<string, string> = {
    overview: "Настройки",
    questions: "Части и вопросы",
    scoring: "Шкала оценок",
    commissions: "Комиссии",
    assignments: "Экзаменационный лист",
    privileges: "Привилегии",
    attempts: "Сдачи",
    results: "Результаты",
  };
  const selectAttempt = (id: number) => navigate({ attemptId: id });
  return (
    <div className={s.page}>
      <div className={s.header}>
        <Action onClick={back}>← Все экзамены</Action>
        <Action onClick={overview.reload} disabled={overview.loading}>
          Обновить обзор
        </Action>
      </div>
      <ErrorNotice error={overview.error} reload={overview.reload} />
      {overview.loading && !exam && <Loading />}
      {exam && (
        <>
          <div className={s.header}>
            <div>
              <h1>{exam.directionName}</h1>
              <p className={s.subtitle}>
                {typeLabel(exam.examType)} · ID {exam.id}
              </p>
              <p className={s.subtitle}>
                {exam.examType === "classic"
                  ? `${formatDate(exam.startAt)} — ${formatDate(exam.endAt)} · МСК`
                  : formatDate(exam.date)}
              </p>
            </div>
            {editable && (
              <div className={s.row}>
                <Action onClick={() => setDirectionEdit(true)}>
                  Изменить направление
                </Action>
                <Action danger onClick={() => setDeleting(true)}>
                  Удалить экзамен
                </Action>
              </div>
            )}
          </div>
          {exam.directionId === null && (
            <p className={s.warning}>
              Нужно назначить направление для исторического экзамена.
            </p>
          )}
          {overview.data?.classic && (
            <div className={s.row}>
              <span className={s.badge}>
                Частей: {overview.data.classic.partsCount}
              </span>
              <span className={s.badge}>
                Вопросов: {overview.data.classic.questionsCount}
              </span>
              <span className={s.badge}>
                Назначений: {overview.data.classic.assignmentsCount}
              </span>
              <span className={s.badge}>
                Сейчас сдают: {overview.data.classic.attempts.inProgress}
              </span>
              <span className={s.badge}>
                Текущих результатов: {overview.data.classic.resultsCount}
              </span>
            </div>
          )}
          {Boolean(overview.data?.classic?.attempts.inProgress) && (
            <p className={s.warning}>
              Сейчас идут экзамены. Договорились не изменять настройки и составы
              во время проведения. Снимки начатых сдач сохраняются независимо от
              изменений банка.
            </p>
          )}
          <nav className={s.tabs} aria-label="Разделы экзамена">
            {tabs.map((value) => (
              <Action
                key={value}
                className={activeTab === value ? s.selected : ""}
                aria-current={activeTab === value ? "page" : undefined}
                onClick={() => navigate({ tab: value, attemptId: null })}
              >
                {labels[value]}
              </Action>
            ))}
          </nav>
          {attemptId && exam.examType === "classic" ? (
            <AdminAttemptDetail
              key={attemptId}
              {...props}
              attemptId={attemptId}
              back={() => navigate({ attemptId: null })}
            />
          ) : (
            <div key={`${examId}:${activeTab}`}>
              {exam.examType === "classic" ? (
                <>
                  {activeTab === "overview" && <ClassicSettings {...props} />}
                  {activeTab === "questions" && <ClassicBank {...props} />}
                  {activeTab === "scoring" && <ClassicScoring {...props} />}
                  {activeTab === "commissions" && (
                    <ClassicCommissions {...props} />
                  )}
                  {activeTab === "assignments" && (
                    <ClassicAssignments {...props} />
                  )}
                  {activeTab === "privileges" && (
                    <ClassicPrivileges {...props} />
                  )}
                  {activeTab === "attempts" && (
                    <ClassicAttempts {...props} selectAttempt={selectAttempt} />
                  )}
                  {activeTab === "results" && (
                    <ClassicResults {...props} selectAttempt={selectAttempt} />
                  )}
                </>
              ) : activeTab === "overview" ? (
                <OutsideDate
                  key={exam.version}
                  exam={exam}
                  actor={actor}
                  canEdit={editable}
                  changed={overview.reload}
                />
              ) : (
                <OutsideResults {...props} />
              )}
            </div>
          )}
          {directionEdit && (
            <DirectionEditor
              exam={exam}
              actor={actor}
              canEdit={editable}
              close={() => setDirectionEdit(false)}
              changed={overview.reload}
            />
          )}
          {deleting && (
            <DeleteEntity
              actor={actor}
              canEdit={editable}
              title={`Удалить экзамен «${exam.directionName}»?`}
              description="Будет удалён весь экзамен: настройки, банк, комиссии, назначения, привилегии, все сдачи, голоса, апелляции и результаты. Студенты, экзаменаторы и направление останутся."
              path={`/api/exams/${examId}`}
              previewPath={`/api/exams/${examId}/delete-preview`}
              onClose={() => setDeleting(false)}
              onDeleted={back}
            />
          )}
        </>
      )}
    </div>
  );
}
export function AdminExams({
  actor,
  capabilities,
}: {
  actor: string;
  capabilities: Capabilities;
}) {
  const { user } = useAuth();
  const canEdit = canAccessSection(user, "exams", "edit");
  const canView = canAccessSection(user, "exams", "view");
  const nav = useExamNavigation();
  const examId = nav.id("examId");
  const type = nav.params?.get("type") ?? "all",
    query = nav.params?.get("search") ?? "",
    sort = nav.params?.get("sort") ?? "date_desc",
    directionId = nav.params?.get("directionId") ?? "",
    dateFrom = nav.params?.get("dateFrom") ?? "",
    dateTo = nav.params?.get("dateTo") ?? "";
  const page = nav.id("page") ?? 1;
  const [creating, setCreating] = useState(false);
  const directions = useExamDirections(nav.initialized && canView && !examId);
  const resource = useExamResource<Page<ExamSummary>>(
    nav.initialized && canView && !examId
      ? `/api/exams${queryString({ type, page, limit: 20, search: query, sort, directionId, dateFrom, dateTo })}`
      : null,
  );
  if (!canView) return <Empty>Нет доступа к экзаменам</Empty>;
  if (!nav.initialized) return <Loading />;
  if (examId)
    return (
      <Workspace
        key={examId}
        examId={examId}
        actor={actor}
        capabilities={capabilities}
        canEdit={canEdit}
        tab={nav.params?.get("tab") ?? "overview"}
        attemptId={nav.id("attemptId")}
        navigate={nav.navigate}
        back={() => nav.navigate({ examId: null, tab: null, attemptId: null })}
      />
    );
  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h1>Экзамены</h1>
          <p className={s.subtitle}>
            Экзамены вне LMS и устные экзамены с комиссией
          </p>
        </div>
        {canEdit &&
          (capabilities.canCreateClassic || capabilities.canManageOutside) && (
            <Action primary onClick={() => setCreating(true)}>
              Создать экзамен
            </Action>
          )}
      </div>
      <form
        className={s.row}
        onSubmit={(e) => {
          e.preventDefault();
          const search = String(
            new FormData(e.currentTarget).get("search") ?? "",
          ).trim();
          nav.navigate({ search: search || null, page: null });
        }}
      >
        <Field label="Поиск">
          <input
            key={query}
            name="search"
            className={s.input}
            placeholder="Название направления"
            maxLength={200}
            defaultValue={query}
          />
        </Field>
        <Field label="Направление">
          <select
            className={s.select}
            value={directionId}
            onChange={(e) =>
              nav.navigate({ directionId: e.target.value || null, page: null })
            }
          >
            <option value="">Все направления</option>
            {directions.data.map((direction) => (
              <option key={direction.id} value={direction.id}>
                {direction.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="С даты (МСК)">
          <input
            className={s.input}
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) =>
              nav.navigate({ dateFrom: e.target.value || null, page: null })
            }
          />
        </Field>
        <Field label="По дату (МСК)">
          <input
            className={s.input}
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) =>
              nav.navigate({ dateTo: e.target.value || null, page: null })
            }
          />
        </Field>
        <Field label="Тип">
          <select
            className={s.select}
            value={type}
            onChange={(e) => nav.navigate({ type: e.target.value, page: null })}
          >
            <option value="all">Все</option>
            <option value="classic">Классические</option>
            <option value="outside_lms">Вне системы LMS</option>
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
            <option value="created_desc">По созданию</option>
          </select>
        </Field>
        <Action type="submit">Найти</Action>
        <Action
          onClick={() =>
            nav.navigate({
              search: null,
              directionId: null,
              dateFrom: null,
              dateTo: null,
              type: null,
              sort: null,
              page: null,
            })
          }
        >
          Сбросить фильтры
        </Action>
        <Action disabled={resource.loading} onClick={resource.reload}>
          Обновить
        </Action>
      </form>
      <p className={s.muted}>
        Для классических экзаменов фильтр использует московскую дату начала, для
        экзаменов вне LMS — указанную дату. Экзамены без даты не входят в
        выбранный период.
      </p>
      <ErrorNotice error={directions.error} />
      <ErrorNotice error={resource.error} reload={resource.reload} />
      {resource.loading && <Loading />}
      <div className={s.grid}>
        {resource.data?.items.map((exam) => (
          <article key={exam.id} className={s.panel}>
            <h2>{exam.directionName}</h2>
            <span className={s.badge}>{typeLabel(exam.examType)}</span>
            <p className={s.muted}>
              {formatDate(
                exam.examType === "classic" ? exam.startAt : exam.date,
              )}{" "}
              · ID {exam.id}
            </p>
            {exam.examType === "classic" && (
              <span className={s.badge}>
                {exam.readiness === "ready" ? "Настроен" : "Требует настройки"}
              </span>
            )}
            {exam.directionId === null && (
              <span className={s.warning}>Нужно назначить направление</span>
            )}
            <Action
              onClick={() => nav.navigate({ examId: exam.id, tab: "overview" })}
            >
              Открыть экзамен
            </Action>
          </article>
        ))}
      </div>
      {resource.data?.items.length === 0 && (
        <Empty>
          {query || type !== "all" || directionId || dateFrom || dateTo
            ? "По выбранным условиям экзаменов нет."
            : "Экзаменов пока нет."}
        </Empty>
      )}
      <Pager
        pagination={resource.data?.pagination}
        onPage={(value) => nav.navigate({ page: value })}
      />
      {creating && (
        <CreateExam
          actor={actor}
          capabilities={capabilities}
          canEdit={canEdit}
          close={() => setCreating(false)}
          created={(exam) => {
            setCreating(false);
            nav.navigate({ examId: exam.id, tab: "overview" });
          }}
        />
      )}
    </div>
  );
}
