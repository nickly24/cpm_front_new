"use client";

import {
  AdminAnswerItemsList,
  attemptItemsToRows,
} from "@/components/admin/tests/admin-answer-items-list";
import { AdminListPaginationBar } from "@/components/admin/tests/admin-list-pagination";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import {
  deleteAdminAttempt,
  fetchAdminAttemptDetail,
  fetchAdminTestAttempts,
} from "@/lib/admin/admin-tests-monitoring-api";
import type {
  AdminAttemptDetailResponse,
  AdminListPagination,
  AdminTestAttemptListItem,
} from "@/lib/admin/admin-tests-monitoring-types";
import { formatAdminTestDate } from "@/lib/admin/admin-tests-utils";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useCallback, useEffect, useState } from "react";

interface AdminTestAttemptsPanelProps {
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

function statusLabel(status: string) {
  if (status === "in_progress") return "В процессе";
  if (status === "expired") return "Время вышло";
  if (status === "submitted") return "Отправлено";
  return status;
}

export function AdminTestAttemptsPanel({ testId }: AdminTestAttemptsPanelProps) {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [page, setPage] = useState(1);
  const [attempts, setAttempts] = useState<AdminTestAttemptListItem[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminAttemptDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminTestAttempts(testId, {
        page,
        search: debouncedSearch,
        status: "active",
      });
      setAttempts(res.attempts);
      setPagination(res.pagination);
    } catch (err) {
      setAttempts([]);
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

  const openDetail = async (attemptId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetchAdminAttemptDetail(attemptId);
      setDetail(res);
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Не удалось загрузить попытку",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (attemptId: string) => {
    if (
      !window.confirm(
        "Удалить попытку? Студент сможет начать тест заново (если нет финальной сдачи).",
      )
    ) {
      return;
    }
    try {
      await deleteAdminAttempt(attemptId);
      setDetail(null);
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

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
        <LoadingState label="Загрузка попыток…" variant="panel" />
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : attempts.length === 0 ? (
        <p className={styles.panelHint}>Активных попыток нет</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Студент</th>
                <th>Статус</th>
                <th>Прогресс</th>
                <th>Осталось</th>
                <th>Старт</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {attempts.map((row) => (
                <tr key={row.attemptId}>
                  <td>{row.studentFullName}</td>
                  <td>
                    <span className={styles.statusPill}>{statusLabel(row.status)}</span>
                  </td>
                  <td>
                    {row.answeredCount}/{row.totalQuestions}
                  </td>
                  <td>
                    {row.timeExpired || row.remainingSeconds === 0
                      ? "0 сек"
                      : `${row.remainingSeconds ?? 0} сек`}
                  </td>
                  <td>{formatAdminTestDate(row.startedAt)}</td>
                  <td className={styles.tableActions}>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => openDetail(row.attemptId)}
                    >
                      Детали
                    </button>
                    <button
                      type="button"
                      className={styles.linkBtnDanger}
                      onClick={() => handleDelete(row.attemptId)}
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

      <AdminListPaginationBar pagination={pagination} onPageChange={setPage} />

      {detailLoading ? (
        <LoadingState label="Загрузка деталей…" variant="compact" />
      ) : null}

      {detail ? (
        <div className={styles.detailCard}>
          <div className={styles.detailCardHead}>
            <h3>{detail.studentFullName}</h3>
            <button
              type="button"
              className={styles.popupClose}
              onClick={() => setDetail(null)}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
          <p className={styles.panelHint}>
            Отвечено:{" "}
            {String(
              (detail.attempt as { answeredCount?: number }).answeredCount ?? "—",
            )}{" "}
            /{" "}
            {String(
              (detail.attempt as { totalQuestions?: number }).totalQuestions ??
                "—",
            )}
          </p>
          <h4 className={styles.detailSectionTitle}>Ответы по вопросам</h4>
          <AdminAnswerItemsList items={attemptItemsToRows(detail.items)} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              handleDelete(
                String(
                  (detail.attempt as { attemptId?: string }).attemptId ?? "",
                ),
              )
            }
          >
            Удалить попытку
          </Button>
        </div>
      ) : null}
    </div>
  );
}
