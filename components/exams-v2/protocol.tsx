"use client";

import { useState } from "react";
import { useExamResource } from "@/lib/exams-v2/hooks";
import { queryString } from "@/lib/exams-v2/api";
import type { Page, PresentedQuestion, Round } from "@/lib/exams-v2/types";
import { formatScore, statusLabel } from "@/lib/exams-v2/utils";
import { Action, Empty, ErrorNotice, Loading, Pager } from "./shared";
import s from "./exams.module.css";

export function RoundVotes({ round }: { round: Round }) {
  return (
    <div className={round.status === "disputed" ? s.warning : s.item}>
      <strong>
        Раунд {round.roundNo}: {statusLabel(round.status)}
      </strong>
      {round.votes?.length ? (
        <ul>
          {round.votes.map((vote, i) => (
            <li key={vote.examinatorId ?? vote.examinator?.id ?? i}>
              {vote.examinator?.fullName ??
                vote.fullName ??
                `Экзаменатор ${vote.examinatorId ?? i + 1}`}
              : {formatScore(vote.value)}
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.muted}>
          {round.votesReceived === undefined
            ? "Оценок нет"
            : `${round.votesReceived} из ${round.votesRequired} оценок`}
        </p>
      )}
    </div>
  );
}
function RoundHistory({ path }: { path: string }) {
  const [view, setView] = useState<{ page: number; anchor?: number }>({
    page: 1,
  });
  const resource = useExamResource<Page<Round> & { throughRoundNo: number }>(
    `${path}${queryString({ page: view.page, limit: 20, throughRoundNo: view.anchor })}`,
  );
  const refresh = () => {
    setView({ page: 1 });
    resource.reload();
  };
  return (
    <div className={s.stack}>
      <Action onClick={refresh}>Обновить историю раундов</Action>
      <ErrorNotice error={resource.error} reload={refresh} />
      {resource.loading && <Loading />}
      {resource.data?.items.map((round) => (
        <RoundVotes key={round.id} round={round} />
      ))}
      <Pager
        pagination={resource.data?.pagination}
        onPage={(page) =>
          setView({
            page,
            anchor: view.anchor ?? resource.data?.throughRoundNo,
          })
        }
      />
    </div>
  );
}
export function QuestionProtocolCard({
  question,
  roundsPath,
}: {
  question: PresentedQuestion;
  roundsPath?: string;
}) {
  const [showRounds, setShowRounds] = useState(false);
  return (
    <article className={s.item}>
      <div className={s.header}>
        <strong>
          Вопрос {question.sequenceNo} · Часть {question.partCode}
        </strong>
        <span className={s.badge}>
          {question.purpose === "tie_breaker" ? "Дополнительный" : "Основной"} ·{" "}
          {statusLabel(question.status)}
        </span>
      </div>
      <p className={s.text}>{question.questionText}</p>
      <details>
        <summary>Эталонный ответ</summary>
        <p className={s.text}>{question.answerText}</p>
      </details>
      <p className={s.muted}>
        Вес: {formatScore(question.weight)} · Оценка ответа:{" "}
        {formatScore(question.consensus)} · Баллы:{" "}
        {formatScore(question.awardedPoints)}
        {question.cycleNo > 1 && ` · Круг ${question.cycleNo}`}
      </p>
      {question.replacesPresentedQuestionId !== null && (
        <p className={s.muted}>
          Выдан вместо вопроса #{question.replacesPresentedQuestionId}
        </p>
      )}
      {roundsPath && (
        <>
          <Action onClick={() => setShowRounds(!showRounds)}>
            {showRounds ? "Скрыть раунды" : "История голосования"}
          </Action>
          {showRounds && <RoundHistory path={roundsPath} />}
        </>
      )}
    </article>
  );
}
export function ExamProtocol({
  path,
  showRounds = false,
}: {
  path: string;
  showRounds?: boolean;
}) {
  const [view, setView] = useState<{ page: number; anchor?: number }>({
    page: 1,
  });
  const resource = useExamResource<
    Page<PresentedQuestion> & { throughSequenceNo: number }
  >(
    `${path}${queryString({ page: view.page, limit: 10, throughSequenceNo: view.anchor })}`,
  );
  const refresh = () => {
    setView({ page: 1 });
    resource.reload();
  };
  return (
    <section className={s.panel}>
      <div className={s.header}>
        <h3>Протокол вопросов</h3>
        <Action onClick={refresh} disabled={resource.loading}>
          Обновить протокол
        </Action>
      </div>
      <ErrorNotice error={resource.error} reload={refresh} />
      {resource.loading && <Loading />}
      {resource.data?.items.map((question) => (
        <QuestionProtocolCard
          key={question.id}
          question={question}
          roundsPath={showRounds ? `${path}/${question.id}/rounds` : undefined}
        />
      ))}
      {resource.data?.items.length === 0 && (
        <Empty>Вопросы ещё не выдавались</Empty>
      )}
      <Pager
        pagination={resource.data?.pagination}
        onPage={(page) =>
          setView({
            page,
            anchor: view.anchor ?? resource.data?.throughSequenceNo,
          })
        }
      />
    </section>
  );
}
