"use client";

import { BFF_DEV } from "@/lib/config";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { hasPendingRatingCommands } from "@/lib/bff/ratings-shared";
import { EditOnly } from "@/components/admin/admin-section-access";

import { AdminRatingDetailsView } from "@/components/admin/ratings/admin-rating-details-view";
import { RatingFreshnessNotice } from "@/components/exams-v2/rating-freshness";
import type { RatingFreshness } from "@/lib/ratings/freshness";
import { AdminRatingJobsTab } from "@/components/admin/ratings/admin-rating-jobs-tab";
import { AdminRatingRecalcPanel } from "@/components/admin/ratings/admin-rating-recalc-panel";
import { RatingsReportWorkspace } from "@/components/admin/ratings/report/ratings-report-workspace";
import ratingStyles from "@/components/admin/ratings/admin-ratings.module.css";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { canAccessSection } from "@/lib/auth/admin-access";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchAdminRatings,
  fetchRatingVersions,
  pendingRatingCommand,
  startRatingRecalc,
} from "@/lib/admin/admin-ratings-api";
import type { AdminRatingRow, AdminRatingsTab, RatingRecalcJob } from "@/lib/admin/admin-ratings-types";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useCabinetChrome } from "@/contexts/cabinet-chrome-context";
import { Calculator, RefreshCw, TableProperties } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TABS: { id: AdminRatingsTab; label: string }[] = [
  { id: "ratings", label: "Рейтинг" },
  { id: "jobs", label: "Журнал пересчётов" },
];

function placeClass(place: number): string {
  if (place === 1) return ratingStyles.place1;
  if (place === 2) return ratingStyles.place2;
  if (place === 3) return ratingStyles.place3;
  return ratingStyles.placeOther;
}

export function AdminRatingsSection() {
  const { user } = useAuth();
  const isAdmin = BFF_DEV
    ? user?.role === "admin" && user.organization_admin === true || user?.role === "staff_admin" && user.permissions?.ratings?.view === true && user.permissions?.ratings?.edit === true
    : canAccessSection(user, "ratings", "edit");

  const [tab, setTab] = useState<AdminRatingsTab>("ratings");
  const [ratings, setRatings] = useState<AdminRatingRow[]>([]);
  const [freshness, setFreshness] = useState<RatingFreshness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [showRecalc, setShowRecalc] = useState(false);
  const [jobsRefreshToken, setJobsRefreshToken] = useState(0);
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [hasActiveJob, setHasActiveJob] = useState(false);
  const [versions, setVersions] = useState<RatingRecalcJob[]>([]);
  const [version, setVersion] = useState("");
  const [, setCommandRefresh] = useState(0);
  const pendingStart = BFF_DEV ? pendingRatingCommand() : null;
  useContextGuard(BFF_DEV && (showRecalc || recalcBusy || hasPendingRatingCommands()));
  const onCommandsChange = useCallback(() => setCommandRefresh(v => v + 1), []);
  const [details, setDetails] = useState<{
    ratingId: number;
    version?: string;
    studentName?: string;
  } | null>(null);
  const [showReport, setShowReport] = useState(false);
  const { setImmersive } = useCabinetChrome();

  useEffect(() => {
    setImmersive(showReport);
    return () => setImmersive(false);
  }, [showReport, setImmersive]);

  const requestSerial = useRef(0);
  const loadRatings = useCallback(async () => {
    const request = ++requestSerial.current;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAdminRatings(version || undefined);
      if (request !== requestSerial.current) return;
      setFreshness(response.ratingFreshness ?? null);
      if (response.status) {
        setRatings(response.ratings ?? []);
      } else {
        setRatings([]);
        setError("Не удалось загрузить рейтинг");
      }
    } catch (err) {
      if (request !== requestSerial.current) return;
      setError(err instanceof Error ? err.message : "Ошибка загрузки рейтинга");
    } finally {
      if (request === requestSerial.current) setLoading(false);
    }
  }, [version]);
  const loadVersions = useCallback(async () => {
    if (!BFF_DEV) return;
    try { setVersions(await fetchRatingVersions()); } catch { /* Table requests surface access and transport failures. */ }
  }, []);
  const onPublished = useCallback(() => { void loadRatings(); void loadVersions(); }, [loadRatings, loadVersions]);

  useEffect(() => {
    const timer = window.setTimeout(() => {void loadVersions(); void loadRatings();}, 0);
    return () => window.clearTimeout(timer);
  }, [loadRatings, loadVersions]);

  const filtered = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) {
      return ratings;
    }
    return ratings.filter((row) => {
      return (
        row.student_name.toLowerCase().includes(query) ||
        String(row.student_id).includes(query) ||
        (row.group_name ?? "").toLowerCase().includes(query) ||
        (row.student_class ?? "").toLowerCase().includes(query)
      );
    });
  }, [ratings, debouncedSearch]);

  useEffect(() => {
    if (!hasActiveJob && jobsRefreshToken > 0) {
      const timer = window.setTimeout(() => { void loadRatings(); void loadVersions(); }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [hasActiveJob, jobsRefreshToken, loadRatings, loadVersions]);

  const handleStartRecalc = async (payload: {
    date_from: string;
    date_to: string;
  }) => {
    setRecalcBusy(true);
    try {
      await startRatingRecalc(payload);
      setJobsRefreshToken((value) => value + 1);
      setTab("jobs");
      setHasActiveJob(true);
    } finally {
      setRecalcBusy(false);
      onCommandsChange();
    }
  };

  if (showReport) {
    return <RatingsReportWorkspace version={version || freshness?.versionId} onBack={() => setShowReport(false)} />;
  }

  if (details) {
    return (
      <AdminRatingDetailsView
        ratingId={details.ratingId}
        version={details.version}
        studentName={details.studentName}
        onBack={() => setDetails(null)}
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Рейтинг</h1>
          <p className={ratingStyles.pageSubtitle}>
            Таблица успеваемости и журнал фоновых пересчётов.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Button type="button" variant="ghost" onClick={() => {void loadRatings(); void loadVersions(); setJobsRefreshToken(v => v + 1);}}>
            <RefreshCw size={16} style={{ marginRight: 6 }} />
            Обновить
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowReport(true)}
            disabled={!BFF_DEV && ratings.length === 0}
          >
            <TableProperties size={16} style={{ marginRight: 6 }} />
            Отчёт
          </Button>
          {isAdmin ? (
            <EditOnly><Button
              type="button"
              onClick={() => setShowRecalc(true)}
              disabled={(hasActiveJob && !pendingStart) || recalcBusy}
            >
              <Calculator size={16} style={{ marginRight: 6 }} />
              {pendingStart ? "Повторить запрос" : hasActiveJob ? "Пересчёт выполняется…" : "Пересчитать"}
            </Button></EditOnly>
          ) : null}
        </div>
      </header>

      <RatingFreshnessNotice value={freshness ? { ...freshness, activeJobId: hasActiveJob ? "active" : null } : null} />
      {BFF_DEV && version ? <p className={ratingStyles.pageSubtitle}>Показана сохранённая публикация. Новые исходные данные не меняют её оценки.</p> : null}
      {BFF_DEV ? <div className={styles.filters}>
        <label>Опубликованная версия <select aria-label="Опубликованная версия" value={version} onChange={event => {setLoading(true); setVersion(event.target.value);}}>
          <option value="">Последняя версия</option>
          {versions.map(job => <option key={job.id} value={job.id}>№{job.revision} · {job.date_from} — {job.date_to}</option>)}
        </select></label>
        {freshness?.asOf ? <span>Данные на {new Date(freshness.asOf).toLocaleString("ru-RU")}</span> : null}
      </div> : null}

      <div className={ratingStyles.sectionTabs}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.directionTab} ${tab === item.id ? styles.directionTabActive : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.id === "jobs" && hasActiveJob ? " •" : ""}
          </button>
        ))}
      </div>

      {tab === "ratings" ? (
        <>
          <div className={styles.filters}>
            <input
              className={styles.searchInput}
              placeholder="Поиск по имени, группе, классу…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {loading ? <LoadingState label="Загрузка рейтинга…" variant="panel" /> : null}
          {error ? <p className={styles.errorText}>{error}</p> : null}

          {!loading && !error && filtered.length === 0 ? (
            <div className={ratingStyles.emptyState}>
              <p>
                {ratings.length === 0
                  ? "Рейтинг ещё не рассчитан. Запустите пересчёт — результат появится здесь."
                  : "Ничего не найдено по запросу."}
              </p>
              {isAdmin && ratings.length === 0 ? (
                <EditOnly><Button
                  type="button"
                  style={{ marginTop: 16 }}
                  onClick={() => setShowRecalc(true)}
                  disabled={hasActiveJob && !pendingStart}
                >
                  Запустить пересчёт
                </Button></EditOnly>
              ) : null}
            </div>
          ) : null}

          {!loading && filtered.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Место</th>
                    <th>Студент</th>
                    <th>Класс</th>
                    <th>Группа</th>
                    <th>ДЗ</th>
                    <th>Экзамены</th>
                    <th>Тесты</th>
                    <th>Итог</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span className={`${ratingStyles.placeBadge} ${placeClass(row.place ?? ratings.indexOf(row) + 1)}`}>
                          {row.place ?? ratings.indexOf(row) + 1}
                        </span>
                      </td>
                      <td>
                        <strong>{row.student_name}</strong>
                      </td>
                      <td>{row.student_class ?? "—"}</td>
                      <td>{row.group_name ?? "—"}</td>
                      <td>{row.homework.toFixed(2)}</td>
                      <td>{row.exams.toFixed(2)}</td>
                      <td>{row.tests.toFixed(2)}</td>
                      <td>
                        <span className={ratingStyles.finalScore}>
                          {row.final.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setDetails({
                              ratingId: row.id,
                              version: row.version_id,
                              studentName: row.student_name,
                            })
                          }
                        >
                          Детали
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
      <div hidden={tab !== "jobs"}>
        <AdminRatingJobsTab refreshToken={jobsRefreshToken} canEdit={isAdmin} onActiveChange={setHasActiveJob} onCommandsChange={onCommandsChange} onPublished={onPublished} />
      </div>

      {showRecalc ? (
        <AdminRatingRecalcPanel
          onClose={() => setShowRecalc(false)}
          onStarted={() => {
            setJobsRefreshToken((value) => value + 1);
          }}
          onSubmit={handleStartRecalc}
          disabled={hasActiveJob && !pendingStart}
        />
      ) : null}
    </div>
  );
}
