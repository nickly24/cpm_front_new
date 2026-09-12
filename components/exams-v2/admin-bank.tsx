"use client";

import { useState } from "react";
import { queryString } from "@/lib/exams-v2/api";
import { useExamMutation, useExamResource } from "@/lib/exams-v2/hooks";
import type { BankQuestion, Page, Part } from "@/lib/exams-v2/types";
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
import { DeleteEntity } from "./admin-delete";
import { ExamImport } from "./import";
import type { AdminPanelProps } from "./admin-settings";
import s from "./exams.module.css";

function PartEditor({
  initial,
  close,
  ...props
}: AdminPanelProps & { initial: Part | null; close: () => void }) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [weight, setWeight] = useState(initial?.questionWeight ?? 1);
  const [count, setCount] = useState(initial?.questionCount ?? 1);
  const mutation = useExamMutation(
    `${props.actor}:part:${props.examId}:${initial?.id ?? "new"}`,
    () => {
      props.onChanged();
      close();
    },
  );
  return (
    <Modal
      title={initial ? `Часть ${initial.code}` : "Новая часть"}
      onClose={close}
      busy={mutation.busy}
    >
      <form
        data-exam-editor
        className={s.stack}
        onSubmit={(e) => {
          e.preventDefault();
          void mutation.execute({
            path: `/api/exams/${props.examId}/classic/parts${initial ? `/${initial.id}` : ""}`,
            method: initial ? "PATCH" : "POST",
            body: {
              code,
              questionWeight: weight,
              questionCount: count,
              ...(initial ? { expectedVersion: initial.version } : {}),
            },
          });
        }}
      >
        <Field label="Буква части">
          <input
            className={s.input}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={1}
            pattern="[A-Z]"
            required
            disabled={mutation.busy || mutation.uncertain}
            placeholder="A"
          />
        </Field>
        <Field label="Баллов за полный ответ">
          <input
            className={s.input}
            type="number"
            min={1}
            max={1000}
            step={1}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            required
            disabled={mutation.busy || mutation.uncertain}
          />
        </Field>
        <Field label="Основных вопросов из этой части">
          <input
            className={s.input}
            type="number"
            min={1}
            max={100}
            step={1}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            required
            disabled={mutation.busy || mutation.uncertain}
          />
        </Field>
        <p className={s.muted}>
          Идентификатор части остаётся прежним при переименовании. Изменения не
          затронут начатые сдачи.
        </p>
        <MutationNotice mutation={mutation} reload={props.onChanged} />
        <Action
          primary
          type="submit"
          disabled={!props.canEdit || mutation.busy || mutation.uncertain}
        >
          Сохранить часть
        </Action>
      </form>
    </Modal>
  );
}
function QuestionEditor({
  initial,
  parts,
  close,
  ...props
}: AdminPanelProps & {
  initial: BankQuestion | null;
  parts: Part[];
  close: () => void;
}) {
  const [partId, setPartId] = useState(
    String(initial?.partId ?? parts[0]?.id ?? ""),
  );
  const [question, setQuestion] = useState(initial?.questionText ?? "");
  const [answer, setAnswer] = useState(initial?.answerText ?? "");
  const mutation = useExamMutation(
    `${props.actor}:question:${props.examId}:${initial?.id ?? "new"}`,
    () => {
      props.onChanged();
      close();
    },
  );
  const oversize =
    new TextEncoder().encode(question).length > 61440 ||
    new TextEncoder().encode(answer).length > 61440;
  return (
    <Modal
      title={initial ? "Редактировать вопрос" : "Добавить вопрос"}
      onClose={close}
      busy={mutation.busy}
    >
      <form
        data-exam-editor
        className={s.stack}
        onSubmit={(e) => {
          e.preventDefault();
          if (oversize) return;
          void mutation.execute({
            path: `/api/exams/${props.examId}/classic/questions${initial ? `/${initial.id}` : ""}`,
            method: initial ? "PATCH" : "POST",
            body: {
              partId: Number(partId),
              questionText: question.trim(),
              answerText: answer.trim(),
              ...(initial ? { expectedVersion: initial.version } : {}),
            },
          });
        }}
      >
        <Field label="Часть">
          <select
            className={s.select}
            value={partId}
            onChange={(e) => setPartId(e.target.value)}
            required
            disabled={mutation.busy || mutation.uncertain}
          >
            <option value="">Выберите часть</option>
            {parts.map((part) => (
              <option key={part.id} value={part.id}>
                {part.code}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Вопрос">
          <textarea
            className={s.textarea}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            required
            disabled={mutation.busy || mutation.uncertain}
          />
        </Field>
        <Field label="Эталонный ответ">
          <textarea
            className={s.textarea}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            required
            disabled={mutation.busy || mutation.uncertain}
          />
        </Field>
        <p className={s.muted}>
          Обычный текст, переносы строк сохраняются. До 60 КиБ UTF-8 на поле.
        </p>
        {oversize && (
          <p className={s.error}>
            Текст вопроса или ответа превышает допустимый размер.
          </p>
        )}
        <MutationNotice mutation={mutation} reload={props.onChanged} />
        <Action
          primary
          type="submit"
          disabled={
            !props.canEdit ||
            mutation.busy ||
            mutation.uncertain ||
            oversize ||
            !question.trim() ||
            !answer.trim()
          }
        >
          Сохранить вопрос
        </Action>
      </form>
    </Modal>
  );
}
export function ClassicBank(props: AdminPanelProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [partId, setPartId] = useState("");
  const [page, setPage] = useState(1);
  const [partEdit, setPartEdit] = useState<Part | "new" | null>(null),
    [questionEdit, setQuestionEdit] = useState<BankQuestion | "new" | null>(
      null,
    );
  const [deletion, setDeletion] = useState<
    | { kind: "part"; value: Part }
    | { kind: "question"; value: BankQuestion }
    | null
  >(null);
  const [importing, setImporting] = useState(false);
  const parts = useExamResource<Page<Part>>(
    `/api/exams/${props.examId}/classic/parts?limit=100`,
  );
  const questions = useExamResource<Page<BankQuestion>>(
    `/api/exams/${props.examId}/classic/questions${queryString({ page, limit: 20, partId, search: filter })}`,
  );
  const changed = () => {
    parts.reload();
    questions.reload();
    props.onChanged();
  };
  return (
    <div className={s.stack}>
      <section className={s.panel}>
        <div className={s.header}>
          <h2>Части экзамена</h2>
          {props.canEdit && (
            <Action primary onClick={() => setPartEdit("new")}>
              Добавить часть
            </Action>
          )}
        </div>
        <ErrorNotice error={parts.error} reload={parts.reload} />
        {parts.loading && <Loading />}
        <div className={s.grid}>
          {parts.data?.items.map((part) => (
            <article key={part.id} className={s.item}>
              <strong className={s.itemTitle}>Часть {part.code}</strong>
              <p className={s.muted}>
                Вес ответа: {part.questionWeight} · В сдаче:{" "}
                {part.questionCount}
                <br />В банке: {part.bankSize}
              </p>
              {props.canEdit && (
                <div className={s.row}>
                  <Action onClick={() => setPartEdit(part)}>Изменить</Action>
                  <Action
                    danger
                    onClick={() => setDeletion({ kind: "part", value: part })}
                  >
                    Удалить
                  </Action>
                </div>
              )}
            </article>
          ))}
        </div>
        {parts.data?.items.length === 0 && (
          <Empty>Сначала добавьте часть A, B и т. д.</Empty>
        )}
      </section>
      <section className={s.panel}>
        <div className={s.header}>
          <h2>Банк вопросов</h2>
          {props.canEdit && (
            <div className={s.row}>
              <Action onClick={() => setImporting(!importing)}>
                Импорт .xlsx
              </Action>
              <Action
                primary
                disabled={!parts.data?.items.length}
                onClick={() => setQuestionEdit("new")}
              >
                Добавить вопрос
              </Action>
            </div>
          )}
        </div>
        {importing && (
          <ExamImport {...props} kind="questions" onChanged={changed} />
        )}
        <form
          className={s.row}
          onSubmit={(e) => {
            e.preventDefault();
            setFilter(search.trim());
            setPage(1);
          }}
        >
          <Field label="Поиск">
            <input
              className={s.input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={200}
            />
          </Field>
          <Field label="Часть">
            <select
              className={s.select}
              value={partId}
              onChange={(e) => {
                setPartId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Все части</option>
              {parts.data?.items.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.code}
                </option>
              ))}
            </select>
          </Field>
          <Action type="submit">Найти</Action>
          <Action onClick={questions.reload}>Обновить</Action>
        </form>
        <ErrorNotice error={questions.error} reload={questions.reload} />
        {questions.loading && <Loading />}
        {questions.data?.items.map((question) => (
          <article className={s.item} key={question.id}>
            <span className={s.badge}>
              Часть {question.partCode} · ID {question.id}
            </span>
            <p className={s.text}>{question.questionText}</p>
            <details>
              <summary>Эталонный ответ</summary>
              <p className={s.text}>{question.answerText}</p>
            </details>
            {props.canEdit && (
              <div className={s.row}>
                <Action onClick={() => setQuestionEdit(question)}>
                  Редактировать
                </Action>
                <Action
                  danger
                  onClick={() =>
                    setDeletion({ kind: "question", value: question })
                  }
                >
                  Удалить
                </Action>
              </div>
            )}
          </article>
        ))}
        {questions.data?.items.length === 0 && (
          <Empty>Вопросов по выбранным условиям нет</Empty>
        )}
        <Pager pagination={questions.data?.pagination} onPage={setPage} />
      </section>
      {partEdit && (
        <PartEditor
          {...props}
          initial={partEdit === "new" ? null : partEdit}
          close={() => setPartEdit(null)}
          onChanged={changed}
        />
      )}
      {questionEdit && (
        <QuestionEditor
          {...props}
          initial={questionEdit === "new" ? null : questionEdit}
          parts={parts.data?.items ?? []}
          close={() => setQuestionEdit(null)}
          onChanged={changed}
        />
      )}
      {deletion && (
        <DeleteEntity
          actor={props.actor}
          canEdit={props.canEdit}
          title={
            deletion.kind === "part"
              ? `Удалить часть ${deletion.value.code}?`
              : "Удалить вопрос?"
          }
          description={
            deletion.kind === "part"
              ? "Будут удалены часть и все её вопросы из текущего банка. Протоколы начатых и завершённых сдач сохранятся."
              : "Вопрос исчезнет из текущего банка. В уже начатых и завершённых сдачах сохранится его снимок."
          }
          path={`/api/exams/${props.examId}/classic/${deletion.kind === "part" ? "parts" : "questions"}/${deletion.value.id}`}
          previewPath={
            deletion.kind === "part"
              ? `/api/exams/${props.examId}/classic/parts/${deletion.value.id}/delete-preview`
              : undefined
          }
          version={deletion.value.version}
          onClose={() => setDeletion(null)}
          onDeleted={() => {
            setDeletion(null);
            changed();
          }}
        />
      )}
    </div>
  );
}
