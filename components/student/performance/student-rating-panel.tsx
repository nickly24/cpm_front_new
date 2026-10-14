"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Action, Empty, ErrorNotice, Loading } from "@/components/exams-v2/shared";
import { RatingFreshnessNotice } from "@/components/exams-v2/rating-freshness";
import { PublishedRatingSummary, ReadonlyRatingDetail } from "@/components/ratings/ratings-readonly-view";
import { mapRatingFreshness, ratingsOwn } from "@/lib/bff/ratings-shared";
import { ratingPublicationState } from "@/lib/ratings/read-only";
import { useRatingResource } from "@/lib/ratings/use-rating-resource";
import s from "@/components/ratings/ratings-readonly.module.css";

export function StudentRatingPanel() {
  const { user } = useAuth();
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const load = useCallback((signal: AbortSignal) => ratingsOwn(undefined, signal), []);
  const scope = user?.context_revision || `${user?.account_id}:${user?.organization_id}:${user?.division_id}`;
  const resource = useRatingResource(`${scope}:own-rating`, load);
  const row = resource.data?.rating;
  const freshness = resource.data ? mapRatingFreshness(resource.data.freshness) : null;

  if (selectedVersion && user?.account_id)
    return <ReadonlyRatingDetail accountId={user.account_id} version={selectedVersion} onBack={() => setSelectedVersion(null)} />;

  return <section className={s.panel} aria-label="Мой рейтинг">
    <div className={s.header}><h2 className={s.title}>Мой рейтинг</h2><Action onClick={resource.reload} disabled={resource.loading}>Обновить рейтинг</Action></div>
    <p className={s.subtitle}>Последняя полностью опубликованная версия выбранного подразделения.</p>
    <ErrorNotice error={resource.error} reload={resource.reload} />
    {resource.loading && <Loading text="Загрузка рейтинга…" />}
    <RatingFreshnessNotice value={freshness} />
    {row ? <>
      <PublishedRatingSummary row={row} freshness={freshness} />
      <Action onClick={() => setSelectedVersion(row.rating.job_id)} disabled={!user?.account_id}>Что вошло в рейтинг</Action>
    </> : resource.data && <Empty>{ratingPublicationState(false, freshness) === "never_calculated" ? "Рейтинг в этом подразделении ещё не рассчитывался." : "В опубликованной версии нет вашего рейтинга."}</Empty>}
  </section>;
}
