"use client";

import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Action, Empty, ErrorNotice, Loading } from "@/components/exams-v2/shared";
import { RatingFreshnessNotice } from "@/components/exams-v2/rating-freshness";
import { mapRatingDetails, mapRatingFreshness, ratingsAccount, type PublishedRating } from "@/lib/bff/ratings-shared";
import { useRatingResource } from "@/lib/ratings/use-rating-resource";
import { formatPublishedScore, ratingSnapshotDate } from "@/lib/ratings/read-only";
import type { RatingDetails } from "@/lib/admin/admin-ratings-types";
import type { RatingFreshness } from "@/lib/ratings/freshness";
import s from "./ratings-readonly.module.css";

export function PublishedRatingSummary({
  row,
  freshness,
}: {
  row: PublishedRating;
  freshness?: RatingFreshness | null;
}) {
  const details = mapRatingDetails(row);
  const snapshotAt = ratingSnapshotDate(freshness?.asOf);
  return <>
    <dl className={s.summary}>
      <div className={s.metric}><dt>Итоговый рейтинг</dt><dd>{formatPublishedScore(details.final_rating)}</dd></div>
      <div className={s.metric}><dt>Домашние задания</dt><dd>{formatPublishedScore(details.homework.rating)}</dd></div>
      <div className={s.metric}><dt>Экзамены</dt><dd>{formatPublishedScore(details.exams.rating)}</dd></div>
      <div className={s.metric}><dt>Тесты</dt><dd>{formatPublishedScore(details.tests.rating)}</dd></div>
    </dl>
    <div className={s.metadata}>
      <span>Место в подразделении: <strong>{row.place}</strong></span>
      <span>Версия: {row.rating.revision}</span>
      {snapshotAt && <span>Снимок на {snapshotAt}</span>}
    </div>
  </>;
}

export function RatingDetailsBody({ details }: { details: RatingDetails }) {
  return <div className={s.page}>
    <section aria-label="Домашние задания рейтинга">
      <h2>Домашние задания</h2>
      <div className={s.detailGrid}>
        {details.homework.details.length ? details.homework.details.map((item, index) => <article className={s.detailCard} key={`${item.homework_id}:${index}`}>
          <div className={s.detailTitle}><h3>{item.name}</h3><span className={s.score}>{formatPublishedScore(item.score)}</span></div>
          <p>{item.status}</p><p>Дедлайн: {item.deadline || "—"}</p>
          {item.date_pass && <p>Сдано: {item.date_pass}</p>}
        </article>) : <Empty>В расчёт не включены домашние задания.</Empty>}
      </div>
    </section>
    <section aria-label="Экзамены рейтинга">
      <h2>Экзамены</h2>
      <div className={s.detailGrid}>
        {details.exams.details.length ? details.exams.details.map((item, index) => <article className={s.detailCard} key={`${item.exam_id}:${index}`}>
          <div className={s.detailTitle}><h3>{item.exam_name}</h3><span className={s.score}>{formatPublishedScore(item.score)}</span></div>
          <p>{item.missing_result ? "Результата нет — учтено 0 баллов" : item.status}</p>
          <p>Дата: {item.exam_date || "—"}</p>
          {item.exam_type && <p>{item.exam_type === "classic" ? "Классический экзамен" : "Экзамен вне LMS"}{item.attempt_no === 2 ? " · Пересдача" : ""}{item.has_appeal ? " · После апелляции" : ""}</p>}
        </article>) : <Empty>В расчёт не включены экзамены.</Empty>}
      </div>
    </section>
    <section aria-label="Тесты рейтинга">
      <h2>Тесты</h2>
      {Object.keys(details.tests.directions).length > 0 && <div className={s.metadata}>{Object.entries(details.tests.directions).map(([name, score]) => <span key={name}>{name}: <strong>{formatPublishedScore(score)}</strong></span>)}</div>}
      <div className={s.detailGrid}>
        {details.tests.details.length ? details.tests.details.map((item, index) => <article className={s.detailCard} key={`${item.test_id}:${index}`}>
          <div className={s.detailTitle}><h3>{item.title}</h3><span className={s.score}>{formatPublishedScore(item.score)}</span></div>
          <p>{item.direction}</p><p>{item.source === "external" ? "Внешний тест" : "Внутренний тест"}</p>
        </article>) : <Empty>В расчёт не включены тесты.</Empty>}
      </div>
    </section>
  </div>;
}

export function ReadonlyRatingDetail({
  accountId,
  version,
  onBack,
}: {
  accountId: number;
  version?: string;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const load = useCallback((signal: AbortSignal) => ratingsAccount(accountId, version, signal), [accountId, version]);
  const scope = user?.context_revision || `${user?.account_id}:${user?.organization_id}:${user?.division_id}`;
  const resource = useRatingResource(`${scope}:${accountId}:${version || "current"}`, load);
  const row = resource.data?.rating;
  const freshness = resource.data ? mapRatingFreshness(resource.data.freshness) : null;

  return <section className={s.panel}>
    <div className={s.header}>
      <h2 className={s.title}>{row ? `Рейтинг: ${row.profile.full_name}` : "Детализация рейтинга"}</h2>
      <Action onClick={onBack}>К рейтингу</Action>
    </div>
    <ErrorNotice error={resource.error} reload={resource.reload} />
    {resource.loading && <Loading text="Загрузка детализации…" />}
    {row && <>
      <RatingFreshnessNotice value={freshness} />
      <PublishedRatingSummary row={row} freshness={freshness} />
      <RatingDetailsBody details={mapRatingDetails(row)} />
    </>}
    {resource.data && !row && <Empty>Рейтинг этого участника отсутствует в выбранной публикации.</Empty>}
  </section>;
}
