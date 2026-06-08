"use client";

import { AdminZapDetail } from "@/components/admin/zaps/admin-zap-detail";
import zapStyles from "@/components/admin/zaps/admin-zaps.module.css";
import { AdminListPaginationBar } from "@/components/admin/tests/admin-list-pagination";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { OptionSelect } from "@/components/ui/option-select";
import type { AdminListPagination } from "@/lib/admin/admin-tests-monitoring-types";
import { fetchAllZaps } from "@/lib/zaps/zaps-api";
import type { AdminZapListItem, ZapStatusFilter } from "@/lib/zaps/zaps-types";
import {
  formatZapDateTime,
  truncateText,
  zapListDatesHint,
  zapStatusLabel,
} from "@/lib/zaps/zaps-utils";
import { CheckCircle, ClipboardList, Clock, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const PAGE_SIZE = 20;

const EMPTY_PAGINATION: AdminListPagination = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

const STATUS_FILTER_OPTIONS = [
  {
    value: "all" as const,
    label: "Все",
    icon: ClipboardList,
    tone: "neutral" as const,
  },
  {
    value: "set" as const,
    label: "На рассмотрении",
    icon: Clock,
    tone: "warning" as const,
  },
  {
    value: "apr" as const,
    label: "Одобрено",
    icon: CheckCircle,
    tone: "success" as const,
  },
  {
    value: "dec" as const,
    label: "Отклонено",
    icon: XCircle,
    tone: "info" as const,
  },
];

function statusBadgeClass(status: string): string {
  if (status === "set") return zapStyles.badgePending;
  if (status === "apr") return zapStyles.badgeApproved;
  if (status === "dec") return zapStyles.badgeRejected;
  return zapStyles.badgeNeutral;
}

export function AdminZapsSection() {
  const [zaps, setZaps] = useState<AdminZapListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ZapStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] =
    useState<AdminListPagination>(EMPTY_PAGINATION);
  const [selectedZapId, setSelectedZapId] = useState<number | null>(null);
  const [listVersion, setListVersion] = useState(0);

  const loadZaps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAllZaps({
        status: statusFilter,
        page,
        limit: PAGE_SIZE,
      });
      if (!response.status) {
        setZaps([]);
        setPagination(EMPTY_PAGINATION);
        setError(response.error ?? "Не удалось загрузить запросы");
        return;
      }
      setZaps(response.zaps ?? []);
      setPagination(response.pagination ?? EMPTY_PAGINATION);
    } catch (err) {
      setZaps([]);
      setPagination(EMPTY_PAGINATION);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [listVersion, page, statusFilter]);

  useEffect(() => {
    void loadZaps();
  }, [loadZaps]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const handleProcessed = () => {
    setListVersion((value) => value + 1);
  };

  if (selectedZapId != null) {
    return (
      <AdminZapDetail
        zapId={selectedZapId}
        onBack={() => setSelectedZapId(null)}
        onProcessed={handleProcessed}
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Запросы на отгул</h1>
          <p className={zapStyles.pageSubtitle}>
            Просмотр и обработка заявок учеников
          </p>
        </div>
      </header>

      <div className={zapStyles.filtersRow}>
        <OptionSelect
          label="Статус"
          value={statusFilter}
          options={STATUS_FILTER_OPTIONS}
          onChange={(value) => setStatusFilter(value)}
          className={zapStyles.filterGroup}
        />
      </div>

      {loading ? <LoadingState label="Загрузка запросов…" /> : null}
      {error && !loading ? <p className={zapStyles.errorText}>{error}</p> : null}

      {!loading && !error && zaps.length === 0 ? (
        <div className={zapStyles.emptyState}>Нет запросов по выбранному фильтру</div>
      ) : null}

      {!loading && !error && zaps.length > 0 ? (
        <>
          <p className={zapStyles.listMeta}>
            Показано {zaps.length} из {pagination.total} запросов
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>№</th>
                  <th>Ученик</th>
                  <th>Статус</th>
                  <th>Даты</th>
                  <th>Текст</th>
                  <th>Создан</th>
                  <th aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {zaps.map((zap) => {
                  const datesHint = zapListDatesHint(zap);
                  return (
                    <tr key={zap.id}>
                      <td>#{zap.id}</td>
                      <td>
                        <strong>{zap.full_name ?? "—"}</strong>
                        <p className={zapStyles.metaMuted}>ID {zap.student_id}</p>
                      </td>
                      <td>
                        <span className={statusBadgeClass(zap.status)}>
                          {zapStatusLabel(zap.status)}
                        </span>
                      </td>
                      <td>
                        {datesHint ?? "—"}
                        {zap.has_attachments ? (
                          <p className={zapStyles.metaMuted}>Есть вложения</p>
                        ) : null}
                      </td>
                      <td>
                        <p className={zapStyles.textPreview}>
                          {truncateText(zap.text)}
                        </p>
                      </td>
                      <td>{formatZapDateTime(zap.created_at)}</td>
                      <td>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setSelectedZapId(zap.id)}
                        >
                          Открыть
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <AdminListPaginationBar
            pagination={pagination}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </div>
  );
}
