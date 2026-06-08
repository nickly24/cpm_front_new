"use client";

import { AdminRatingDetailsView } from "@/components/admin/ratings/admin-rating-details-view";
import { AdminRatingJobsTab } from "@/components/admin/ratings/admin-rating-jobs-tab";
import { AdminRatingRecalcPanel } from "@/components/admin/ratings/admin-rating-recalc-panel";
import { RatingsReportWorkspace } from "@/components/admin/ratings/report/ratings-report-workspace";
import ratingStyles from "@/components/admin/ratings/admin-ratings.module.css";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchAdminRatings,
  startRatingRecalc,
} from "@/lib/admin/admin-ratings-api";
import type { AdminRatingRow, AdminRatingsTab } from "@/lib/admin/admin-ratings-types";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useCabinetChrome } from "@/contexts/cabinet-chrome-context";
import { Calculator, RefreshCw, TableProperties } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const TABS: { id: AdminRatingsTab; label: string }[] = [
  { id: "ratings", label: "Рейтинг" },
  { id: "jobs", label: "Журнал пересчётов" },
];

function placeClass(index: number): string {
  if (index === 0) return ratingStyles.place1;
  if (index === 1) return ratingStyles.place2;
  if (index === 2) return ratingStyles.place3;
  return ratingStyles.placeOther;
}

export function AdminRatingsSection() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [tab, setTab] = useState<AdminRatingsTab>("ratings");
  const [ratings, setRatings] = useState<AdminRatingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [showRecalc, setShowRecalc] = useState(false);
  const [jobsRefreshToken, setJobsRefreshToken] = useState(0);
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [hasActiveJob, setHasActiveJob] = useState(false);
  const [details, setDetails] = useState<{
    ratingId: number;
    studentName?: string;
  } | null>(null);
  const [showReport, setShowReport] = useState(false);
  const { setImmersive } = useCabinetChrome();

  useEffect(() => {
    setImmersive(showReport);
    return () => setImmersive(false);
  }, [showReport, setImmersive]);

  const loadRatings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAdminRatings();
      if (response.status) {
        setRatings(response.ratings ?? []);
      } else {
        setRatings([]);
        setError("Не удалось загрузить рейтинг");
      }
    } catch (err) {
      setRatings([]);
      setError(err instanceof Error ? err.message : "Ошибка загрузки рейтинга");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRatings();
  }, [loadRatings]);

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
      void loadRatings();
    }
  }, [hasActiveJob, jobsRefreshToken, loadRatings]);

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
    }
  };

  if (showReport) {
    return <RatingsReportWorkspace onBack={() => setShowReport(false)} />;
  }

  if (details) {
    return (
      <AdminRatingDetailsView
        ratingId={details.ratingId}
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
          <Button type="button" variant="ghost" onClick={() => void loadRatings()}>
            <RefreshCw size={16} style={{ marginRight: 6 }} />
            Обновить
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowReport(true)}
            disabled={ratings.length === 0}
          >
            <TableProperties size={16} style={{ marginRight: 6 }} />
            Отчёт
          </Button>
          {isAdmin ? (
            <Button
              type="button"
              onClick={() => setShowRecalc(true)}
              disabled={hasActiveJob || recalcBusy}
            >
              <Calculator size={16} style={{ marginRight: 6 }} />
              {hasActiveJob ? "Пересчёт выполняется…" : "Пересчитать"}
            </Button>
          ) : null}
        </div>
      </header>

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
                <Button
                  type="button"
                  style={{ marginTop: 16 }}
                  onClick={() => setShowRecalc(true)}
                  disabled={hasActiveJob}
                >
                  Запустить пересчёт
                </Button>
              ) : null}
            </div>
          ) : null}

          {!loading && !error && filtered.length > 0 ? (
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
                  {filtered.map((row, index) => (
                    <tr key={row.id}>
                      <td>
                        <span className={`${ratingStyles.placeBadge} ${placeClass(index)}`}>
                          {index + 1}
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
      ) : (
        <AdminRatingJobsTab
          refreshToken={jobsRefreshToken}
          onActiveChange={setHasActiveJob}
        />
      )}

      {showRecalc ? (
        <AdminRatingRecalcPanel
          onClose={() => setShowRecalc(false)}
          onStarted={() => {
            setJobsRefreshToken((value) => value + 1);
          }}
          onSubmit={handleStartRecalc}
          disabled={hasActiveJob}
        />
      ) : null}
    </div>
  );
}
