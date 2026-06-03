"use client";

import {
  AdminAnswerItemsList,
  reviewItemsToRows,
} from "@/components/admin/tests/admin-answer-items-list";
import { AdminListPaginationBar } from "@/components/admin/tests/admin-list-pagination";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import {
  deleteAdminSession,
  fetchAdminSessionDetail,
  fetchAdminTestSessions,
} from "@/lib/admin/admin-tests-monitoring-api";
import type {
  AdminListPagination,
  AdminSessionDetailResponse,
  AdminTestSessionListItem,
} from "@/lib/admin/admin-tests-monitoring-types";
import { formatAdminTestDate } from "@/lib/admin/admin-tests-utils";
import { fetchTestSessionReview } from "@/lib/student/test-review-api";
import type { TestSessionReview } from "@/lib/student/test-review-types";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useCallback, useEffect, useState } from "react";

interface AdminTestSessionsPanelProps {
  testId: string;
}

const emptyPagination: AdminListPagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

export function AdminTestSessionsPanel({ testId }: AdminTestSessionsPanelProps) {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [page, setPage] = useState(1);
  const [sessions, setSessions] = useState<AdminTestSessionListItem[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminSessionDetailResponse | null>(null);
  const [review, setReview] = useState<TestSessionReview | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminTestSessions(testId, {
        page,
        search: debouncedSearch,
      });
      setSessions(res.sessions);
      setPagination(res.pagination);
    } catch (err) {
      setSessions([]);
      setPagination(emptyPagination);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [testId, page, debouncedSearch]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (sessionId: string) => {
    setDetailLoading(true);
    setActiveSessionId(sessionId);
    setDetail(null);
    setReview(null);
    try {
      const [adminDetail, reviewRes] = await Promise.all([
        fetchAdminSessionDetail(sessionId),
        fetchTestSessionReview(sessionId),
      ]);
      setDetail(adminDetail);
      if (reviewRes.success && reviewRes.review) {
        setReview(reviewRes.review);
      }
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Не удалось загрузить сдачу",
      );
      setActiveSessionId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetail(null);
    setReview(null);
    setActiveSessionId(null);
  };

  const handleDelete = async (sessionId: string) => {
    if (!window.confirm("Удалить сдачу? Студент сможет пройти тест заново.")) {
      return;
    }
    try {
      await deleteAdminSession(sessionId);
      if (activeSessionId === sessionId) {
        closeDetail();
      }
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  const reviewRows = review ? reviewItemsToRows(review.items) : [];

  return (
    <div className={styles.panel}>
      <div className={styles.panelToolbar}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Поиск по имени студента (от 2 символов)…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {loading ? (
        <LoadingState label="Загрузка сдач…" variant="panel" />
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : sessions.length === 0 ? (
        <p className={styles.panelHint}>Сдач не найдено</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Студент</th>
                <th>Балл</th>
                <th>Ответов</th>
                <th>Завершение</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((row) => (
                <tr
                  key={row.sessionId}
                  className={
                    activeSessionId === row.sessionId
                      ? styles.tableRowActive
                      : undefined
                  }
                >
                  <td>{row.studentFullName}</td>
                  <td>{row.score ?? "—"}</td>
                  <td>{row.answersCount ?? "—"}</td>
                  <td>{formatAdminTestDate(row.completedAt)}</td>
                  <td className={styles.tableActions}>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => openDetail(row.sessionId)}
                    >
                      Детали
                    </button>
                    <button
                      type="button"
                      className={styles.linkBtnDanger}
                      onClick={() => handleDelete(row.sessionId)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminListPaginationBar
        pagination={pagination}
        onPageChange={setPage}
      />

      {detailLoading ? (
        <LoadingState label="Загрузка ответов по вопросам…" variant="compact" />
      ) : null}

      {detail && !detailLoading ? (
        <div className={styles.detailCard}>
          <div className={styles.detailCardHead}>
            <div>
              <h3>{detail.studentFullName}</h3>
              <p className={styles.panelHint}>
                Итог:{" "}
                {review?.score ??
                  (detail.session as { score?: number }).score ??
                  "—"}
                % ·{" "}
                {formatAdminTestDate(
                  review?.completedAt ??
                    (detail.session as { completedAt?: string }).completedAt,
                )}
              </p>
            </div>
            <button
              type="button"
              className={styles.popupClose}
              onClick={closeDetail}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>

          <dl className={styles.detailStatsRow}>
            <div className={styles.detailStat}>
              <span className={styles.detailStatLabel}>Точность</span>
              <strong>
                {(detail.stats as { accuracy?: number } | null)?.accuracy != null
                  ? `${(detail.stats as { accuracy: number }).accuracy}%`
                  : "—"}
              </strong>
            </div>
            <div className={styles.detailStat}>
              <span className={styles.detailStatLabel}>Время</span>
              <strong>
                {(detail.session as { timeSpentMinutes?: number })
                  .timeSpentMinutes != null
                  ? `${(detail.session as { timeSpentMinutes: number }).timeSpentMinutes} мин`
                  : "—"}
              </strong>
            </div>
            <div className={styles.detailStat}>
              <span className={styles.detailStatLabel}>Верных</span>
              <strong>
                {review
                  ? `${review.items.filter((i) => i.isCorrect).length} / ${review.items.length}`
                  : "—"}
              </strong>
            </div>
          </dl>

          <h4 className={styles.detailSectionTitle}>Ответы по вопросам</h4>
          <AdminAnswerItemsList items={reviewRows} />

          <div className={styles.detailCardActions}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => activeSessionId && handleDelete(activeSessionId)}
            >
              Удалить сдачу
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
