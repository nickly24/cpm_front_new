"use client";

import { useState } from "react";
import { queryString } from "@/lib/exams-v2/api";
import {
  useExamMutation,
  useExamNavigation,
  useExamResource,
} from "@/lib/exams-v2/hooks";
import type {
  AttemptState,
  CommandResult,
  ExaminerAssignment,
  ExaminerExam,
  Page,
  Receipt,
  Vote,
} from "@/lib/exams-v2/types";
import {
  acceptAttempt,
  formatDate,
  formatScore,
  selectionBody,
  statusLabel,
  voteBody,
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
  ValidationList,
} from "./shared";
import { ExamProtocol, RoundVotes } from "./protocol";
import s from "./exams.module.css";

function AssignmentCard({
  row,
  examId,
  actor,
  enabled,
  open,
}: {
  row: ExaminerAssignment;
  examId: number;
  actor: string;
  enabled: boolean;
  open: (id: number) => void;
}) {
  const mutation = useExamMutation<CommandResult>(
    `${actor}:ensure:${row.assignmentId}:${row.historyGeneration}`,
    (data) => open(data.attempt.id),
  );
  return (
    <article className={s.item}>
      <div className={s.header}>
        <strong className={s.itemTitle}>{row.student.fullName}</strong>
        <span className={s.badge}>{statusLabel(row.status)}</span>
      </div>
      <p className={s.muted}>
        {row.attemptNo === 2 ? "Пересдача" : "Первая сдача"} · ID{" "}
        {row.student.id} · Замен: {row.replacementLimit}
      </p>
      <p className={s.muted}>
        Комиссия: {row.commission.map((m) => m.fullName).join(", ")}
      </p>
      <ValidationList items={row.unavailableReasons} />
      <MutationNotice mutation={mutation} />
      <Action
        primary
        disabled={
          mutation.busy ||
          mutation.uncertain ||
          (!row.attemptId && (!enabled || !row.canPrepare))
        }
        onClick={() => {
          if (row.attemptId) open(row.attemptId);
          else
            void mutation.execute({
              path: `/api/examiner/exams/${examId}/assignments/${row.assignmentId}/attempts/ensure`,
              method: "POST",
              body: { expectedHistoryGeneration: row.historyGeneration },
            });
        }}
      >
        {mutation.busy
          ? "Открываем…"
          : row.status === "completed"
            ? "Посмотреть результат"
            : "Открыть сдачу"}
      </Action>
    </article>
  );
}

function AttemptWorkspace({
  attemptId,
  actor,
  enabled,
  back,
}: {
  attemptId: number;
  actor: string;
  enabled: boolean;
  back: () => void;
}) {
  const resource = useExamResource<{ attempt: AttemptState }>(
    `/api/examiner/attempts/${attemptId}`,
  );
  const [commandState, setCommandState] = useState<AttemptState | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [confirm, setConfirm] = useState<
    | {
        kind: "vote";
        questionId: number;
        roundId: number;
        value: Vote;
        text: string;
        roundNo: number;
      }
    | { kind: "replace"; questionId: number; stateVersion: number }
    | null
  >(null);
  const [showProtocol, setShowProtocol] = useState(false);
  const fetched = resource.data?.attempt;
  const attempt =
    fetched && acceptAttempt(commandState, fetched, attemptId)
      ? fetched
      : commandState;
  const mutation = useExamMutation<CommandResult>(
    `${actor}:attempt:${attemptId}`,
    (data) => {
      if (data.attempt.id !== attemptId) return;
      setCommandState((previous) =>
        !previous || data.attempt.stateVersion >= previous.stateVersion
          ? data.attempt
          : previous,
      );
      setReceipt(data.receipt);
      setConfirm(null);
    },
  );
  const disabled = !enabled || mutation.busy || mutation.uncertain;
  const command = (name: string, body: unknown) =>
    void mutation.execute({
      path: `/api/examiner/attempts/${attemptId}/${name}`,
      method: "POST",
      body,
    });
  const question = attempt?.currentQuestion;
  return (
    <div className={s.page}>
      <div className={s.header}>
        <Action onClick={back} disabled={mutation.busy || mutation.uncertain}>
          ← К студентам
        </Action>
        <Action
          disabled={resource.loading || mutation.busy}
          onClick={resource.reload}
        >
          Обновить состояние
        </Action>
      </div>
      <ErrorNotice error={resource.error} reload={resource.reload} />
      <MutationNotice mutation={mutation} reload={resource.reload} />
      {resource.loading && <Loading />}
      {!enabled && (
        <div className={s.warning}>
          Проведение временно недоступно. Сохранённый прогресс доступен для
          чтения.
        </div>
      )}
      {attempt && (
        <>
          <div className={s.header}>
            <div>
              <h1>{attempt.student.fullName}</h1>
              <p className={s.subtitle}>
                {attempt.directionName} ·{" "}
                {attempt.attemptNo === 2 ? "Пересдача" : "Первая сдача"} · ID{" "}
                {attempt.student.id}
              </p>
            </div>
            <span className={s.badge}>{statusLabel(attempt.status)}</span>
          </div>
          {receipt && (
            <div className={s.success} role="status">
              Действие сохранено.
              {receipt.resolvedQuestionId !== undefined &&
              receipt.consensus !== undefined
                ? ` Вопрос #${receipt.resolvedQuestionId}: согласованная оценка ${formatScore(receipt.consensus)}.`
                : ""}
              {receipt.outcome === "completed"
                ? " Экзамен завершён, результат опубликован."
                : receipt.outcome === "next_extra"
                  ? " Выдан следующий дополнительный вопрос."
                  : ""}
            </div>
          )}
          <div className={s.columns}>
            <main className={s.stack}>
              {attempt.status === "pending_ready" && (
                <section className={s.panel}>
                  <h2>Подготовка к экзамену</h2>
                  <p className={s.muted}>
                    Каждый член комиссии подтверждает собственную готовность.
                    Она сохраняется бессрочно. Когда готовы все, любой участник
                    может начать экзамен.
                  </p>
                  <div className={s.row}>
                    <Action
                      primary
                      disabled={disabled || !attempt.permissions.canReady}
                      onClick={() => command("ready", {})}
                    >
                      Я готов принимать экзамен
                    </Action>
                    <Action
                      primary
                      disabled={disabled || !attempt.permissions.canStart}
                      onClick={() =>
                        command("start", {
                          expectedStateVersion: attempt.stateVersion,
                        })
                      }
                    >
                      Начать экзамен
                    </Action>
                  </div>
                  {!attempt.permissions.canStart && (
                    <p className={s.muted}>
                      Для старта нужны готовность полного состава, настройки и
                      действующий период экзамена. После готовности коллег
                      нажмите «Обновить состояние».
                    </p>
                  )}
                </section>
              )}
              {question && (
                <section className={s.panel}>
                  <div className={s.header}>
                    <h2>
                      Вопрос {question.sequenceNo} · Часть {question.partCode}
                    </h2>
                    <span className={s.badge}>
                      {question.purpose === "tie_breaker"
                        ? "Дополнительный вопрос"
                        : `Вес ${formatScore(question.weight)}`}
                    </span>
                  </div>
                  <p className={s.text}>{question.questionText}</p>
                  <details>
                    <summary>Посмотреть эталонный ответ</summary>
                    <p className={s.text}>{question.answerText}</p>
                  </details>
                  {question.purpose === "tie_breaker" && (
                    <p className={s.warning}>
                      Этот вопрос разрешает дробный итог. Дополнительные баллы
                      за него не начисляются.
                    </p>
                  )}
                  {question.lastCompletedRound?.status === "disputed" && (
                    <>
                      <RoundVotes round={question.lastCompletedRound} />
                      <p className={s.warning}>
                        Оценки комиссии разошлись. Обсудите ответ и проголосуйте
                        повторно в текущем раунде.
                      </p>
                    </>
                  )}
                  {question.round && (
                    <>
                      <p className={s.muted}>
                        Раунд {question.round.roundNo} · Получено{" "}
                        {question.round.votesReceived} из{" "}
                        {question.round.votesRequired} оценок
                        {question.round.hasVoted
                          ? ` · Ваша оценка ${formatScore(question.round.myVote)}`
                          : ""}
                      </p>
                      <div className={s.voteBar}>
                        {(
                          [
                            { value: 0, text: "Неудовлетворительный" },
                            { value: 0.5, text: "Частичный" },
                            { value: 1, text: "Полный" },
                          ] as const
                        ).map(({ value, text }) => (
                          <Action
                            key={value}
                            primary={value === 1}
                            disabled={
                              disabled ||
                              !attempt.permissions.canVote ||
                              question.round?.hasVoted
                            }
                            onClick={() =>
                              setConfirm({
                                kind: "vote",
                                questionId: question.id,
                                roundId: question.round!.id,
                                value,
                                text: question.questionText,
                                roundNo: question.round!.roundNo,
                              })
                            }
                          >
                            {formatScore(value)} · {text}
                          </Action>
                        ))}
                      </div>
                    </>
                  )}
                  {question.status === "consensus" && (
                    <div className={s.success}>
                      Согласованная оценка: {formatScore(question.consensus)}
                    </div>
                  )}
                  <div className={s.row}>
                    <Action
                      disabled={disabled || !attempt.permissions.canReplace}
                      onClick={() =>
                        setConfirm({
                          kind: "replace",
                          questionId: question.id,
                          stateVersion: attempt.stateVersion,
                        })
                      }
                    >
                      Заменить вопрос
                    </Action>
                    {attempt.permissions.canGoNext && (
                      <Action
                        primary
                        disabled={disabled}
                        onClick={() =>
                          command(
                            "next-question",
                            selectionBody(question.id, attempt.stateVersion),
                          )
                        }
                      >
                        Следующий вопрос
                      </Action>
                    )}
                  </div>
                </section>
              )}
              {attempt.status === "completed" && attempt.result && (
                <section className={s.panel}>
                  <h2>Экзамен завершён</h2>
                  <div className={s.stats}>
                    <div className={s.stat}>
                      <span className={s.muted}>Оценка</span>
                      <span className={s.score}>
                        {attempt.result.grade} / 5
                      </span>
                      {attempt.result.hasAppeal && (
                        <span className={s.badge}>После апелляции</span>
                      )}
                    </div>
                    <div className={s.stat}>
                      <span className={s.muted}>Итоговые баллы</span>
                      <span className={s.score}>
                        {formatScore(attempt.result.roundedTotal)} /{" "}
                        {formatScore(attempt.result.maxScore)}
                      </span>
                      <span className={s.muted}>
                        До округления: {formatScore(attempt.result.rawTotal)}
                      </span>
                    </div>
                  </div>
                  <p className={s.muted}>
                    Результат опубликован автоматически.
                  </p>
                </section>
              )}
            </main>
            <aside className={s.stack}>
              <section className={s.panel}>
                <h3>Комиссия</h3>
                {attempt.members.map((member) => (
                  <div className={s.member} key={member.id}>
                    <span>{member.fullName}</span>
                    <span className={s.badge}>
                      {member.ready ? "Готов" : "Ожидаем"}
                    </span>
                  </div>
                ))}
              </section>
              <section className={s.panel}>
                <h3>Прогресс</h3>
                <strong className={s.score}>
                  {attempt.progress.regularConsensus} /{" "}
                  {attempt.progress.regularRequired}
                </strong>
                <span className={s.muted}>Основных вопросов согласовано</span>
                {attempt.progress.parts.map((part) => (
                  <span key={part.sourcePartId}>
                    Часть {part.code}: {part.consensus} / {part.required}
                  </span>
                ))}
                <p className={s.muted}>
                  Замен использовано: {attempt.progress.replacementUsed} из{" "}
                  {attempt.progress.replacementLimit}
                </p>
                <p className={s.muted}>
                  Данные обновляются только вручную и после ваших действий.
                </p>
              </section>
            </aside>
          </div>
          <Action onClick={() => setShowProtocol(!showProtocol)}>
            {showProtocol ? "Скрыть протокол" : "Открыть историю всех вопросов"}
          </Action>
          {showProtocol && (
            <ExamProtocol
              path={`/api/examiner/attempts/${attempt.id}/questions`}
              showRounds
            />
          )}
          {confirm && (
            <Modal
              title={
                confirm.kind === "vote"
                  ? "Подтвердить оценку ответа"
                  : "Заменить вопрос?"
              }
              busy={mutation.busy}
              onClose={() => setConfirm(null)}
            >
              <p>
                <strong>{attempt.student.fullName}</strong> ·{" "}
                {attempt.directionName}
              </p>
              {confirm.kind === "vote" ? (
                <>
                  <p className={s.muted}>
                    Вопрос #{confirm.questionId} · Раунд {confirm.roundNo}
                  </p>
                  <p className={s.text}>{confirm.text}</p>
                  <p>
                    Ваша оценка: <strong>{formatScore(confirm.value)}</strong>.
                    После отправки изменить её в этом раунде нельзя.
                  </p>
                </>
              ) : (
                <p>
                  По просьбе студента будет использована одна привилегия. Вопрос
                  заменится другим из той же части, если никто ещё не поставил
                  оценку. Заменённый вопрос больше не выпадет в этой сдаче.
                </p>
              )}
              <MutationNotice mutation={mutation} reload={resource.reload} />
              <Action
                primary
                disabled={disabled}
                onClick={() => {
                  if (confirm.kind === "vote")
                    command(
                      "vote",
                      voteBody(
                        confirm.questionId,
                        confirm.roundId,
                        confirm.value,
                      ),
                    );
                  else
                    command(
                      "replace-question",
                      selectionBody(confirm.questionId, confirm.stateVersion),
                    );
                }}
              >
                Подтвердить
              </Action>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}

export function ExaminerExams({
  actor,
  enabled,
}: {
  actor: string;
  enabled: boolean;
}) {
  const nav = useExamNavigation();
  const examId = nav.id("examId");
  const attemptId = nav.id("attemptId");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const exams = useExamResource<Page<ExaminerExam>>(
    nav.initialized && !examId && !attemptId
      ? `/api/examiner/exams${queryString({ page, limit: 20, search: filter })}`
      : null,
  );
  const students = useExamResource<Page<ExaminerAssignment>>(
    nav.initialized && examId && !attemptId
      ? `/api/examiner/exams/${examId}/students${queryString({ page, limit: 20, search: filter, status })}`
      : null,
  );
  if (!nav.initialized) return <Loading />;
  if (attemptId)
    return (
      <AttemptWorkspace
        key={`${actor}:${attemptId}`}
        attemptId={attemptId}
        actor={actor}
        enabled={enabled}
        back={() => nav.navigate({ attemptId: null, assignmentId: null })}
      />
    );
  const resource = examId ? students : exams;
  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1>{examId ? "Экзаменационный лист" : "Мои экзамены"}</h1>
        <div className={s.row}>
          {examId && (
            <Action
              onClick={() => {
                setPage(1);
                setStatus("");
                setSearch("");
                setFilter("");
                nav.navigate({ examId: null });
              }}
            >
              ← К экзаменам
            </Action>
          )}
          <Action disabled={resource.loading} onClick={resource.reload}>
            Обновить
          </Action>
        </div>
      </div>
      <p className={s.subtitle}>
        Здесь только экзамены и студенты вашей комиссии. Студент отвечает устно,
        без устройства.
      </p>
      <form
        className={s.row}
        onSubmit={(e) => {
          e.preventDefault();
          setFilter(search.trim());
          setPage(1);
          resource.reload();
        }}
      >
        <Field label="Поиск">
          <input
            className={s.input}
            maxLength={200}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={examId ? "Студент или ID" : "Направление"}
          />
        </Field>
        {examId && (
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
              {["not_started", "pending_ready", "in_progress", "completed"].map(
                (value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ),
              )}
            </select>
          </Field>
        )}
        <Action type="submit">Найти</Action>
      </form>
      <ErrorNotice error={resource.error} reload={resource.reload} />
      {resource.loading && <Loading />}
      {!examId && (
        <div className={s.grid}>
          {exams.data?.items.map((exam) => (
            <article key={exam.id} className={s.panel}>
              <h2>{exam.directionName}</h2>
              <p className={s.muted}>
                {formatDate(exam.startAt)} — {formatDate(exam.endAt)} · МСК
              </p>
              <p>Студентов: {exam.assignedStudentsCount}</p>
              <Action
                primary
                onClick={() => {
                  setPage(1);
                  setFilter("");
                  setSearch("");
                  nav.navigate({ examId: exam.id });
                }}
              >
                Открыть список студентов
              </Action>
            </article>
          ))}
        </div>
      )}
      {examId && (
        <div className={s.list}>
          {students.data?.items.map((row) => (
            <AssignmentCard
              key={row.assignmentId}
              row={row}
              examId={examId}
              actor={actor}
              enabled={enabled}
              open={(id) =>
                nav.navigate({ attemptId: id, assignmentId: row.assignmentId })
              }
            />
          ))}
        </div>
      )}
      {resource.data?.items.length === 0 && (
        <Empty>
          {filter || status
            ? "Ничего не найдено. Измените фильтры."
            : "Назначенных экзаменов или студентов пока нет."}
        </Empty>
      )}
      <Pager pagination={resource.data?.pagination} onPage={setPage} />
    </div>
  );
}
