"use client";

import { useState } from "react";
import { queryString } from "@/lib/exams-v2/api";
import { useExamMutation, useExamResource } from "@/lib/exams-v2/hooks";
import type {
  Assignment,
  Commission,
  Page,
  Person,
  Privilege,
  Readiness,
} from "@/lib/exams-v2/types";
import { statusLabel } from "@/lib/exams-v2/utils";
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
  ValidationList,
} from "./shared";
import { DeleteEntity } from "./admin-delete";
import { ExamImport } from "./import";
import type { AdminPanelProps } from "./admin-settings";
import s from "./exams.module.css";

export function CommissionSelector({
  examId,
  value,
  onChange,
  disabled,
}: {
  examId: number;
  value: { id: number; name: string } | null;
  onChange: (commission: Commission) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(!value);
  const [page, setPage] = useState(1);
  const resource = useExamResource<Page<Commission>>(
    open
      ? `/api/exams/${examId}/classic/commissions${queryString({ page, limit: 20 })}`
      : null,
  );
  return (
    <div className={s.stack}>
      <span className={s.label}>Комиссия</span>
      {value && (
        <div className={s.row}>
          <strong>{value.name}</strong>
          <Action disabled={disabled} onClick={() => setOpen(!open)}>
            Изменить
          </Action>
        </div>
      )}
      {open && (
        <div className={s.item}>
          <ErrorNotice error={resource.error} reload={resource.reload} />
          {resource.loading && <Loading />}
          {resource.data?.items.map((commission) => (
            <Action
              key={commission.id}
              disabled={disabled}
              onClick={() => {
                onChange(commission);
                setOpen(false);
              }}
            >
              {commission.name}:{" "}
              {commission.members.map((m) => m.fullName).join(", ")}
            </Action>
          ))}
          {resource.data?.items.length === 0 && (
            <Empty>Сначала создайте комиссию во вкладке «Комиссии».</Empty>
          )}
          <Pager pagination={resource.data?.pagination} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
function CommissionEditor({
  initial,
  close,
  ...props
}: AdminPanelProps & { initial: Commission | null; close: () => void }) {
  const [name, setName] = useState(initial?.name ?? ""),
    [members, setMembers] = useState<Person[]>(initial?.members ?? []);
  const mutation = useExamMutation(
    `${props.actor}:commission:${props.examId}:${initial?.id ?? "new"}`,
    () => {
      props.onChanged();
      close();
    },
  );
  return (
    <Modal
      title={initial ? "Изменить шаблон комиссии" : "Новая комиссия"}
      onClose={close}
      busy={mutation.busy}
    >
      <form
        data-exam-editor
        className={s.stack}
        onSubmit={(e) => {
          e.preventDefault();
          void mutation.execute({
            path: `/api/exams/${props.examId}/classic/commissions${initial ? `/${initial.id}` : ""}`,
            method: initial ? "PUT" : "POST",
            body: {
              ...(name.trim() || initial ? { name: name.trim() } : {}),
              examinatorIds: members.map((m) => m.id),
              ...(initial ? { expectedVersion: initial.version } : {}),
            },
          });
        }}
      >
        <Field label="Название (можно не указывать при создании)">
          <input
            className={s.input}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required={Boolean(initial)}
            disabled={mutation.busy || mutation.uncertain}
          />
        </Field>
        <p className={s.muted}>
          От одного до шести экзаменаторов. У уже назначенных студентов состав
          не изменится: назначение хранит собственный снимок комиссии.
        </p>
        {members.map((member, index) => (
          <div className={s.member} key={member.id}>
            <span>
              {index + 1}. {member.fullName}
            </span>
            <Action
              disabled={mutation.busy || mutation.uncertain}
              onClick={() =>
                setMembers((old) => old.filter((m) => m.id !== member.id))
              }
            >
              Убрать
            </Action>
          </div>
        ))}
        {members.length < 6 && (
          <PersonPicker
            kind="examinators"
            label={`Добавить экзаменатора (${members.length}/6)`}
            value={null}
            exclude={members.map((m) => m.id)}
            disabled={mutation.busy || mutation.uncertain}
            onChange={(member) => {
              if (member && !members.some((m) => m.id === member.id))
                setMembers((old) => [...old, member]);
            }}
          />
        )}
        <MutationNotice mutation={mutation} reload={props.onChanged} />
        <Action
          primary
          type="submit"
          disabled={
            !props.canEdit ||
            mutation.busy ||
            mutation.uncertain ||
            members.length < 1 ||
            members.length > 6
          }
        >
          Сохранить комиссию
        </Action>
      </form>
    </Modal>
  );
}
export function ClassicCommissions(props: AdminPanelProps) {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Commission | "new" | null>(null);
  const [deleting, setDeleting] = useState<Commission | null>(null);
  const resource = useExamResource<Page<Commission>>(
    `/api/exams/${props.examId}/classic/commissions${queryString({ page, limit: 20 })}`,
  );
  const changed = () => {
    resource.reload();
    props.onChanged();
  };
  return (
    <section className={s.panel}>
      <div className={s.header}>
        <h2>Шаблоны комиссий</h2>
        <div className={s.row}>
          <Action onClick={resource.reload}>Обновить</Action>
          {props.canEdit && (
            <Action primary onClick={() => setEditing("new")}>
              Создать комиссию
            </Action>
          )}
        </div>
      </div>
      <p className={s.muted}>
        Шаблоны действуют только внутри этого экзамена. Изменение шаблона не
        меняет ранее назначенный состав.
      </p>
      <ErrorNotice error={resource.error} reload={resource.reload} />
      {resource.loading && <Loading />}
      <div className={s.grid}>
        {resource.data?.items.map((commission) => (
          <article key={commission.id} className={s.item}>
            <h3>{commission.name}</h3>
            <ol>
              {commission.members.map((m) => (
                <li key={m.id}>{m.fullName}</li>
              ))}
            </ol>
            <p className={s.muted}>
              Назначений: {commission.assignedStudentsCount}
            </p>
            {props.canEdit && (
              <div className={s.row}>
                <Action onClick={() => setEditing(commission)}>Изменить</Action>
                <Action danger onClick={() => setDeleting(commission)}>
                  Удалить шаблон
                </Action>
              </div>
            )}
          </article>
        ))}
      </div>
      {resource.data?.items.length === 0 && <Empty>Комиссий пока нет</Empty>}
      <Pager pagination={resource.data?.pagination} onPage={setPage} />
      {editing && (
        <CommissionEditor
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
          title={`Удалить ${deleting.name}?`}
          description={`Удалится только шаблон. Состав ${deleting.assignedStudentsCount} существующих назначений сохранится.`}
          path={`/api/exams/${props.examId}/classic/commissions/${deleting.id}`}
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
function AssignmentEditor({
  initial,
  close,
  ...props
}: AdminPanelProps & { initial: Assignment | null; close: () => void }) {
  const [student, setStudent] = useState<Person | null>(
      initial?.student ?? null,
    ),
    [commission, setCommission] = useState<{ id: number; name: string } | null>(
      initial?.sourceCommissionId
        ? { id: initial.sourceCommissionId, name: initial.commissionName }
        : null,
    );
  const [changeLimit, setChangeLimit] = useState(false),
    [limit, setLimit] = useState(initial?.replacementLimit ?? 0);
  const privilege = useExamResource<Privilege>(
    student
      ? `/api/exams/${props.examId}/classic/students/${student.id}/privilege`
      : null,
  );
  const mutation = useExamMutation(
    `${props.actor}:assignment:${props.examId}:${initial?.id ?? "new"}`,
    () => {
      props.onChanged();
      close();
    },
  );
  return (
    <Modal
      title={initial ? "Изменить назначение" : "Назначить студента комиссии"}
      onClose={close}
      busy={mutation.busy}
    >
      <form
        data-exam-editor
        className={s.stack}
        onSubmit={(e) => {
          e.preventDefault();
          if (!student || !commission) return;
          void mutation.execute({
            path: `/api/exams/${props.examId}/classic/assignments${initial ? `/${initial.id}` : ""}`,
            method: initial ? "PUT" : "POST",
            body: {
              commissionId: commission.id,
              ...(initial
                ? { expectedVersion: initial.version }
                : { studentId: student.id }),
              ...(changeLimit
                ? {
                    replacementLimit: limit,
                    expectedPrivilegeVersion: privilege.data?.version,
                  }
                : {}),
            },
          });
        }}
      >
        {initial ? (
          <p>
            <strong>{initial.student.fullName}</strong> ·{" "}
            {initial.attemptNo === 2 ? "Пересдача" : "Первая сдача"}
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
        <CommissionSelector
          examId={props.examId}
          value={commission}
          onChange={setCommission}
          disabled={mutation.busy || mutation.uncertain}
        />
        <ErrorNotice error={privilege.error} reload={privilege.reload} />
        <p className={s.muted}>
          Текущая привилегия на экзамен:{" "}
          {privilege.data?.replacementLimit ?? initial?.replacementLimit ?? "—"}{" "}
          замен. При пересдаче лимит предоставляется полностью заново.
        </p>
        <label>
          <input
            type="checkbox"
            checked={changeLimit}
            onChange={(e) => setChangeLimit(e.target.checked)}
            disabled={mutation.busy || mutation.uncertain}
          />{" "}
          Изменить лимит замен
        </label>
        {changeLimit && (
          <Field label="Число замен">
            <input
              className={s.input}
              type="number"
              min={0}
              max={100}
              step={1}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={mutation.busy || mutation.uncertain}
              required
            />
          </Field>
        )}
        <MutationNotice mutation={mutation} reload={props.onChanged} />
        <Action
          primary
          type="submit"
          disabled={
            !props.canEdit ||
            mutation.busy ||
            mutation.uncertain ||
            !student ||
            !commission ||
            (changeLimit && !privilege.data)
          }
        >
          Сохранить назначение
        </Action>
      </form>
    </Modal>
  );
}
function AssignmentReadiness({
  examId,
  assignmentId,
}: {
  examId: number;
  assignmentId: number;
}) {
  const resource = useExamResource<Readiness>(
    `/api/exams/${examId}/classic/assignments/${assignmentId}/readiness`,
  );
  return (
    <div className={s.stack}>
      <ErrorNotice error={resource.error} reload={resource.reload} />
      {resource.loading && <Loading />}
      {resource.data && (
        <>
          <p className={resource.data.canPrepare ? s.success : s.warning}>
            {resource.data.canPrepare
              ? "Назначение готово к сбору комиссии. Старт дополнительно требует готовности всех участников и действующего периода."
              : "Для этого студента ещё не всё настроено:"}
          </p>
          <ValidationList items={resource.data.errors} />
          <ValidationList items={resource.data.warnings} />
        </>
      )}
    </div>
  );
}

export function ClassicAssignments(props: AdminPanelProps) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Assignment | "new" | null>(null),
    [deleting, setDeleting] = useState<Assignment | null>(null),
    [importing, setImporting] = useState(false);
  const [readinessId, setReadinessId] = useState<number | null>(null);
  const resource = useExamResource<Page<Assignment>>(
    `/api/exams/${props.examId}/classic/assignments${queryString({ page, limit: 20, search: query, status })}`,
  );
  const changed = () => {
    resource.reload();
    props.onChanged();
  };
  return (
    <section className={s.panel}>
      <div className={s.header}>
        <h2>Экзаменационный лист</h2>
        {props.canEdit && (
          <div className={s.row}>
            <Action onClick={() => setImporting(!importing)}>
              Импорт .xlsx
            </Action>
            <Action primary onClick={() => setEditing("new")}>
              Назначить студента
            </Action>
          </div>
        )}
      </div>
      {importing && (
        <ExamImport {...props} kind="assignments" onChanged={changed} />
      )}
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
            onChange={(e) => setSearch(e.target.value)}
            maxLength={200}
            placeholder="ФИО или ID"
          />
        </Field>
        <Field label="Состояние">
          <select
            className={s.select}
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">Все</option>
            {["not_started", "pending_ready", "in_progress", "completed"].map(
              (value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ),
            )}
          </select>
        </Field>
        <Action type="submit">Найти</Action>
        <Action onClick={resource.reload}>Обновить</Action>
      </form>
      <ErrorNotice error={resource.error} reload={resource.reload} />
      {resource.loading && <Loading />}
      {resource.data?.items.map((row) => (
        <article key={row.id} className={s.item}>
          <div className={s.header}>
            <strong className={s.itemTitle}>{row.student.fullName}</strong>
            <span className={s.badge}>{statusLabel(row.status)}</span>
          </div>
          <p className={s.muted}>
            ID {row.student.id} ·{" "}
            {row.attemptNo === 2 ? "Пересдача" : "Первая сдача"} ·{" "}
            {row.commissionName}
          </p>
          <p className={s.muted}>
            Назначенный состав: {row.members.map((m) => m.fullName).join(", ")}
          </p>
          <p>Привилегия: {row.replacementLimit} замен</p>
          <Action
            onClick={() =>
              setReadinessId(readinessId === row.id ? null : row.id)
            }
          >
            {readinessId === row.id
              ? "Скрыть проверку"
              : "Проверить готовность назначения"}
          </Action>
          {readinessId === row.id && (
            <AssignmentReadiness examId={props.examId} assignmentId={row.id} />
          )}
          {props.canEdit && row.status === "not_started" && (
            <div className={s.row}>
              <Action onClick={() => setEditing(row)}>Изменить</Action>
              <Action danger onClick={() => setDeleting(row)}>
                Удалить назначение
              </Action>
            </div>
          )}
          {row.status !== "not_started" && (
            <p className={s.muted}>
              Сдача уже создана. Для изменения назначения сначала очистите
              историю во вкладке «Сдачи».
            </p>
          )}
        </article>
      ))}
      {resource.data?.items.length === 0 && (
        <Empty>Назначений по выбранным условиям нет</Empty>
      )}
      <Pager pagination={resource.data?.pagination} onPage={setPage} />
      {editing && (
        <AssignmentEditor
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
          title="Удалить назначение?"
          description={`${deleting.student.fullName}: удалится назначение ${deleting.commissionName}. Привилегия на замены сохранится.`}
          path={`/api/exams/${props.examId}/classic/assignments/${deleting.id}`}
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
function PrivilegeEditor({
  initial,
  close,
  ...props
}: AdminPanelProps & { initial: Privilege | null; close: () => void }) {
  const [student, setStudent] = useState<Person | null>(
      initial?.student ?? null,
    ),
    [limit, setLimit] = useState(initial?.replacementLimit ?? 0);
  const current = useExamResource<Privilege>(
    student
      ? `/api/exams/${props.examId}/classic/students/${student.id}/privilege`
      : null,
  );
  const mutation = useExamMutation(
    `${props.actor}:privilege:${props.examId}:${student?.id ?? "new"}`,
    () => {
      props.onChanged();
      close();
    },
  );
  return (
    <Modal
      title="Привилегия на замену вопросов"
      onClose={close}
      busy={mutation.busy}
    >
      <form
        data-exam-editor
        className={s.stack}
        onSubmit={(e) => {
          e.preventDefault();
          if (!student || !current.data) return;
          void mutation.execute({
            path: `/api/exams/${props.examId}/classic/students/${student.id}/privilege`,
            method: "PUT",
            body: {
              replacementLimit: limit,
              expectedVersion: current.data.version,
            },
          });
        }}
      >
        <PersonPicker
          kind="students"
          label="Студент"
          value={student}
          onChange={setStudent}
          disabled={mutation.busy || mutation.uncertain}
        />
        <ErrorNotice error={current.error} reload={current.reload} />
        {current.data && (
          <p className={s.muted}>
            Сейчас: {current.data.replacementLimit} замен
          </p>
        )}
        <Field label="Новый лимит на экзамен">
          <input
            className={s.input}
            type="number"
            min={0}
            max={100}
            step={1}
            required
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            disabled={mutation.busy || mutation.uncertain}
          />
        </Field>
        <p className={s.muted}>
          Можно назначить привилегию ещё до комиссии. Она не изменит уже начатую
          сдачу и восстановится полностью на пересдаче.
        </p>
        <MutationNotice mutation={mutation} reload={current.reload} />
        <Action
          primary
          type="submit"
          disabled={
            !props.canEdit ||
            mutation.busy ||
            mutation.uncertain ||
            !current.data
          }
        >
          Сохранить привилегию
        </Action>
      </form>
    </Modal>
  );
}
export function ClassicPrivileges(props: AdminPanelProps) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Privilege | "new" | null>(null),
    [deleting, setDeleting] = useState<Privilege | null>(null);
  const resource = useExamResource<Page<Privilege>>(
    `/api/exams/${props.examId}/classic/privileges${queryString({ page, limit: 20, search: query })}`,
  );
  const changed = () => {
    resource.reload();
    props.onChanged();
  };
  return (
    <section className={s.panel}>
      <div className={s.header}>
        <h2>Привилегии на замены</h2>
        {props.canEdit && (
          <Action primary onClick={() => setEditing("new")}>
            Назначить привилегию
          </Action>
        )}
      </div>
      <form
        className={s.row}
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
          setPage(1);
        }}
      >
        <input
          className={s.input}
          aria-label="Поиск студента"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          maxLength={200}
          placeholder="ФИО или ID"
        />
        <Action type="submit">Найти</Action>
      </form>
      <ErrorNotice error={resource.error} reload={resource.reload} />
      {resource.loading && <Loading />}
      {resource.data?.items.map((privilege) => (
        <article key={privilege.student?.id} className={s.item}>
          <strong>{privilege.student?.fullName}</strong>
          <p>Замен на экзамен: {privilege.replacementLimit}</p>
          {props.canEdit && (
            <div className={s.row}>
              <Action onClick={() => setEditing(privilege)}>Изменить</Action>
              <Action danger onClick={() => setDeleting(privilege)}>
                Удалить привилегию
              </Action>
            </div>
          )}
        </article>
      ))}
      {resource.data?.items.length === 0 && <Empty>Привилегий нет</Empty>}
      <Pager pagination={resource.data?.pagination} onPage={setPage} />
      {editing && (
        <PrivilegeEditor
          {...props}
          initial={editing === "new" ? null : editing}
          close={() => setEditing(null)}
          onChanged={changed}
        />
      )}
      {deleting?.student && (
        <DeleteEntity
          actor={props.actor}
          canEdit={props.canEdit}
          title="Удалить привилегию?"
          description={`${deleting.student.fullName}: для будущего старта лимит будет равен нулю. Начатая сдача не изменится.`}
          path={`/api/exams/${props.examId}/classic/students/${deleting.student.id}/privilege`}
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
