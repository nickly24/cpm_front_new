"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Action, Empty, ErrorNotice, Loading } from "@/components/exams-v2/shared";
import { RatingFreshnessNotice } from "@/components/exams-v2/rating-freshness";
import { RatingsReportWorkspace } from "@/components/admin/ratings/report/ratings-report-workspace";
import { ReadonlyRatingDetail } from "./ratings-readonly-view";
import { isActiveRatingJob, mapRatingDetails, mapRatingFreshness, mapRatingsReport, ratingsAllPublished, ratingsJobs, ratingsPublished, ratingsVersions } from "@/lib/bff/ratings-shared";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { exportRatingsReportExcel } from "@/lib/admin/ratings-report-export";
import { buildValueMap } from "@/lib/admin/ratings-report-utils";
import { ratingPublicationState, formatPublishedScore, ratingSnapshotDate } from "@/lib/ratings/read-only";
import { useRatingResource } from "@/lib/ratings/use-rating-resource";
import s from "./ratings-readonly.module.css";

const PAGE_SIZE = 20;
const STAGES: Record<string, string> = {
  preparing: "Подготовка снимка", waiting_sources: "Ожидание источников", queued: "В очереди",
  running: "Расчёт", validating: "Проверка перед публикацией", completed: "Опубликовано",
  failed: "Ошибка", cancelled: "Отменено", superseded: "Источники изменились",
};

export function RatingsReadonlyWorkspace({ role }: { role: "proctor" | "supervisor" }) {
  const { user } = useAuth();
  const supervisor = role === "supervisor";
  const [tab, setTab] = useState<"ratings" | "jobs">("ratings");
  const [reportSelection, setReportSelection] = useState<{ version?: string } | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [version, setVersion] = useState("");
  const [selected, setSelected] = useState<{ accountId: number; version: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<Error | null>(null);
  const exportController = useRef<AbortController | null>(null);
  useContextGuard(exporting);
  useEffect(() => () => exportController.current?.abort(), []);
  const scope = user?.context_revision || `${user?.organization_id}:${user?.division_id}:${user?.account_id}`;
  const loadJobs = useCallback((signal: AbortSignal) => ratingsJobs(50, 0, signal), []);
  const jobs = useRatingResource(supervisor ? `${scope}:rating-jobs` : null, loadJobs, 5000);
  const active = jobs.data?.some(isActiveRatingJob);
  const loadVersions = useCallback((signal: AbortSignal) => ratingsVersions(signal), []);
  const versions = useRatingResource(supervisor ? `${scope}:rating-versions` : null, loadVersions, active ? 5000 : 0);
  const loadPublished = useCallback((signal: AbortSignal) => ratingsPublished({ q: query, limit: PAGE_SIZE, offset, version: version || undefined }, signal), [query, offset, version]);
  const publication = useRatingResource(`${scope}:published:${query}:${offset}:${version}`, loadPublished, active && !version ? 5000 : 0);
  const freshness = publication.data ? mapRatingFreshness(publication.data.freshness) : null;

  const exportGroup = async () => {
    if (exportController.current) return;
    const controller = new AbortController();
    exportController.current = controller;
    setExporting(true);
    setExportError(null);
    try {
      // Proctors have no report permission: assemble the workbook only from their authorized list.
      const data = await ratingsAllPublished(publication.data?.freshness.version_id, controller.signal);
      if (controller.signal.aborted) return;
      const report = mapRatingsReport({ students: data.ratings, period: null, freshness: data.freshness });
      const normalized = { period: null, students: report.students || [], columns: report.columns || [], values: report.values || [] };
      exportRatingsReportExcel(normalized, normalized.students, buildValueMap(normalized.values), `reyting_gruppy_${user?.division_id}_${data.freshness.version_id || "snapshot"}.xlsx`);
    } catch (error) {
      if (!controller.signal.aborted) setExportError(error instanceof Error ? error : new Error("Не удалось подготовить отчёт группы"));
    } finally {
      exportController.current = null;
      if (!controller.signal.aborted) setExporting(false);
    }
  };

  if (reportSelection && supervisor)
    return <RatingsReportWorkspace title="Отчёт по опубликованному рейтингу" version={reportSelection.version} onBack={() => setReportSelection(null)} />;
  if (selected)
    return <ReadonlyRatingDetail accountId={selected.accountId} version={selected.version} onBack={() => setSelected(null)} />;

  return <div className={s.page}>
    <header className={s.panel}>
      <div className={s.header}><h1 className={s.title}>Рейтинг</h1><Action onClick={() => { publication.reload(); if (supervisor) { jobs.reload(); versions.reload(); } }}>Обновить рейтинг</Action></div>
      <p className={s.subtitle}>{supervisor ? "Опубликованные рейтинги, версии и состояние расчёта выбранного подразделения." : "Опубликованный рейтинг учеников вашей группы. Место указано среди всех участников подразделения."}</p>
    </header>
    {supervisor && <div className={s.tabs} role="tablist" aria-label="Разделы рейтинга">
      <Action role="tab" aria-selected={tab === "ratings"} onClick={() => setTab("ratings")}>Опубликованный рейтинг</Action>
      <Action role="tab" aria-selected={tab === "jobs"} onClick={() => setTab("jobs")}>Задания расчёта</Action>
    </div>}

    {tab === "ratings" ? <section className={s.panel} aria-label="Опубликованный рейтинг">
      {!supervisor && <>
        <Action disabled={exporting || !publication.data?.ratings.length} onClick={() => void exportGroup()}>{exporting ? "Подготовка отчёта…" : "Скачать отчёт группы"}</Action>
        <ErrorNotice error={exportError} />
      </>}
      {supervisor && <>
        <ErrorNotice error={versions.error} reload={versions.reload} />
        <div className={s.controls}>
          <label className={s.label}>Опубликованная версия
            <select aria-label="Опубликованная версия" className={s.select} value={version} onChange={(event) => { setVersion(event.target.value); setOffset(0); }}>
              <option value="">Текущая публикация</option>
              {versions.data?.map((job) => <option key={job.id} value={String(job.id)}>{job.date_from} — {job.date_to} · {ratingSnapshotDate(job.completed_at)}</option>)}
            </select>
          </label>
          <Action onClick={() => setReportSelection({ version: version || publication.data?.freshness.version_id })}>Открыть отчёт</Action>
        </div>
      </>}
      <form className={s.controls} style={{ marginTop: 16 }} onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); setOffset(0); }}>
        <input className={s.input} aria-label="Поиск по рейтингу" placeholder="ФИО или группа" maxLength={200} value={search} onChange={(event) => setSearch(event.target.value)} />
        <Action type="submit">Найти</Action>
      </form>
      <ErrorNotice error={publication.error} reload={publication.reload} />
      {publication.loading && <Loading text="Загрузка рейтинга…" />}
      {active && !version && <p className={s.notice} role="status">Идёт пересчёт. Показана последняя полностью опубликованная версия.</p>}
      <RatingFreshnessNotice value={freshness} />
      {publication.data?.ratings.length ? <>
        <div className={s.tableWrap}><table className={s.table}>
          <thead><tr><th>Место</th><th>Ученик</th><th>Группа</th><th>ДЗ</th><th>Экзамены</th><th>Тесты</th><th>Итог</th><th>Детали</th></tr></thead>
          <tbody>{publication.data.ratings.map((row) => {
            const details = mapRatingDetails(row);
            return <tr key={row.profile.account_id}>
              <td>{row.place}</td><td>{row.profile.full_name}</td><td>{row.profile.group_name || "—"}</td>
              <td>{formatPublishedScore(details.homework.rating)}</td><td>{formatPublishedScore(details.exams.rating)}</td><td>{formatPublishedScore(details.tests.rating)}</td><td>{formatPublishedScore(details.final_rating)}</td>
              <td><Action aria-label={`Рейтинг: ${row.profile.full_name}`} onClick={() => setSelected({ accountId: row.profile.account_id, version: row.rating.job_id })}>Подробнее</Action></td>
            </tr>;
          })}</tbody>
        </table></div>
        <nav className={s.controls} aria-label="Страницы рейтинга" style={{ marginTop: 16 }}>
          <Action disabled={offset === 0 || publication.loading} onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}>Назад</Action>
          <span>Всего: {publication.data.total}</span>
          <Action disabled={offset + PAGE_SIZE >= publication.data.total || publication.loading} onClick={() => setOffset((value) => value + PAGE_SIZE)}>Далее</Action>
        </nav>
      </> : publication.data && <Empty>{query ? "По вашему запросу ничего не найдено." : ratingPublicationState(false, freshness) === "never_calculated" ? "Рейтинг в этом подразделении ещё не рассчитывался." : "В опубликованном рейтинге нет доступных учеников."}</Empty>}
    </section> : <section className={s.panel} aria-label="Задания расчёта рейтинга">
      <h2>Задания расчёта</h2>
      <p className={s.subtitle}>Просмотр состояния. Публикация меняется после завершения всего задания.</p>
      <ErrorNotice error={jobs.error} reload={jobs.reload} />
      {jobs.loading && <Loading />}
      {jobs.data?.length ? <div className={s.tableWrap}><table className={s.table}>
        <thead><tr><th>Период</th><th>Состояние</th><th>Обработано</th><th>Создано</th><th>Диагностика</th></tr></thead>
        <tbody>{jobs.data.map((job) => <tr key={job.id}><td>{job.date_from} — {job.date_to}</td><td>{STAGES[job.status] || job.status}</td><td>{job.processed_count} / {job.total_students}</td><td>{ratingSnapshotDate(job.created_at) || "—"}</td><td>{job.message || "—"}</td></tr>)}</tbody>
      </table></div> : jobs.data && <Empty>Заданий расчёта пока нет.</Empty>}
    </section>}
  </div>;
}
