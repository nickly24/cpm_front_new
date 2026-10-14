"use client";
import { BFF_DEV } from "@/lib/config";
import { calculationLabel, testsCalculationHistory, testsRetryCalculation } from "@/lib/bff/tests-admin";
import { useContextGuard } from "@/lib/bff/use-context-guard";

import { useAdminSectionAccess } from "@/components/admin/admin-section-access";

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
import { useCallback, useEffect, useRef, useState } from "react";

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
  const detailGeneration=useRef(0);
  const selectedSession=useRef<string|null>(null);
  const { canEdit: canEditResults } = useAdminSectionAccess("test-results");
  const [calculationStatus,setCalculationStatus] = useState("");
  const [calculationHistory,setCalculationHistory] = useState<Awaited<ReturnType<typeof testsCalculationHistory>>>([]);
  const [mutating,setMutating] = useState(false);
  useContextGuard(mutating);
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
        calculationStatus,
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
  }, [testId, page, debouncedSearch, calculationStatus]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch,calculationStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = useCallback(async (sessionId: string) => {
    selectedSession.current=sessionId;
    const generation=++detailGeneration.current;
    setDetailLoading(true);
    setActiveSessionId(sessionId);
    setDetail(null);
    setReview(null);
    try {
      const adminDetail = await fetchAdminSessionDetail(sessionId);
      if(generation!==detailGeneration.current)return;
      setDetail(adminDetail);
      if(!BFF_DEV || adminDetail.session.calculationStatus==="ready") {
        const reviewRes=await fetchTestSessionReview(sessionId);
        if(generation!==detailGeneration.current)return;
        if(reviewRes.success && reviewRes.review)setReview(reviewRes.review);
      }
      if(BFF_DEV){const history=await testsCalculationHistory(sessionId);if(generation===detailGeneration.current)setCalculationHistory(history);}
    } catch (err) {
      if(generation!==detailGeneration.current)return;
      window.alert(
        err instanceof Error ? err.message : "Не удалось загрузить сдачу",
      );
      setActiveSessionId(null);
    } finally {
      if(generation===detailGeneration.current)setDetailLoading(false);
    }
  },[]);

  useEffect(() => {
    if(!BFF_DEV || !sessions.some(s=>s.calculationStatus!=="ready")) return;
    const timer=window.setInterval(()=>{void load().then(()=>{if(activeSessionId && selectedSession.current===activeSessionId)void openDetail(activeSessionId);});},5000);return ()=>window.clearInterval(timer);
  },[sessions,load,activeSessionId,openDetail]);

  const closeDetail = () => {
    detailGeneration.current++;selectedSession.current=null;
    setCalculationHistory([]);
    setDetail(null);
    setReview(null);
    setActiveSessionId(null);
  };

  const handleDelete = async (sessionId: string) => {
    if (!window.confirm(BFF_DEV ? "Сбросить сдачу? Студент сможет пройти тест заново." : "Удалить сдачу? Студент сможет пройти тест заново.")) {
      return;
    }
    setMutating(true);
    try {
      await deleteAdminSession(sessionId);
      if (activeSessionId === sessionId) {
        closeDetail();
      }
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {setMutating(false);}
  };

  const retryCalculation = async () => {
    if(!activeSessionId || !detail || !window.confirm("Поставить сдачу на повторную проверку?")) return;
    setMutating(true);
    try {await testsRetryCalculation(activeSessionId,Number(detail.session.revision));await load();await openDetail(activeSessionId);}catch(err){window.alert(err instanceof Error?err.message:"Не удалось повторить проверку");}finally{setMutating(false);}
  };

  const reviewRows = review ? reviewItemsToRows(review.items) : [];

  return (
    <div className={styles.panel}>
      <div className={styles.panelToolbar}>
        {BFF_DEV ? <select aria-label="Статус проверки" className={styles.filterSelect} value={calculationStatus} onChange={e=>setCalculationStatus(e.target.value)}><option value="">Все статусы</option>{["queued","processing","retrying","ready","failed"].map(status=><option key={status} value={status}>{calculationLabel(status)}</option>)}</select> : null}
        <Button size="sm" variant="ghost" onClick={()=>void load()}>Обновить</Button>
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
                {BFF_DEV?<th>Проверка</th>:null}
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
                  {BFF_DEV?<td>{calculationLabel(row.calculationStatus)}</td>:null}
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
                    {canEditResults ? <><button
                      type="button"
                      className={styles.linkBtnDanger}
                      onClick={() => handleDelete(row.sessionId)}
                    >
                      {BFF_DEV?"Сбросить":"Удалить"}
                    </button></> : null}
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
                {BFF_DEV && detail.session.calculationStatus!=="ready" ? calculationLabel(String(detail.session.calculationStatus)) : <>Итог:{" "}
                {review?.score ??
                  (detail.session as { score?: number }).score ??
                  "—"}
                % ·{" "}
                {formatAdminTestDate(
                  review?.completedAt ??
                    (detail.session as { completedAt?: string }).completedAt,
                )}</>}
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

          {BFF_DEV && detail.session.calculationStatus!=="ready" ? <p className={styles.panelHint}>Сдача принята. Итог и разбор появятся после завершения проверки.</p> : null}
          {BFF_DEV && calculationHistory.length>0 ? <details><summary>История расчётов</summary><table className={styles.dataTable}><thead><tr><th>Ревизия</th><th>Балл</th><th>Время</th></tr></thead><tbody>{calculationHistory.map(c=><tr key={c.calculation_revision}><td>{c.calculation_revision}</td><td>{c.score}% · {c.earned_points}/{c.max_points}</td><td>{formatAdminTestDate(c.calculated_at)}</td></tr>)}</tbody></table></details> : null}
          <h4 className={styles.detailSectionTitle}>Ответы по вопросам</h4>
          <AdminAnswerItemsList items={reviewRows} />

          <div className={styles.detailCardActions}>
            {BFF_DEV && canEditResults && detail.session.calculationStatus!=="ready" ? <Button size="sm" disabled={mutating} onClick={()=>void retryCalculation()}>Повторить проверку</Button> : null}
            {canEditResults ? <><Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => activeSessionId && handleDelete(activeSessionId)}
            >
              {BFF_DEV?"Сбросить сдачу":"Удалить сдачу"}
            </Button></> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
