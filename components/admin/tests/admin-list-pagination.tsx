"use client";

import styles from "@/components/admin/tests/admin-tests.module.css";
import type { AdminListPagination } from "@/lib/admin/admin-tests-monitoring-types";

interface AdminListPaginationBarProps {
  pagination: AdminListPagination;
  onPageChange: (page: number) => void;
}

export function AdminListPaginationBar({
  pagination,
  onPageChange,
}: AdminListPaginationBarProps) {
  if (pagination.totalPages <= 1) {
    return null;
  }

  const pages: number[] = [];
  const maxButtons = 7;
  let start = Math.max(1, pagination.page - 3);
  const end = Math.min(pagination.totalPages, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);
  for (let p = start; p <= end; p += 1) {
    pages.push(p);
  }

  return (
    <nav className={styles.tablePagination} aria-label="Страницы">
      <button
        type="button"
        className={styles.pageBtn}
        disabled={!pagination.hasPrev}
        onClick={() => onPageChange(pagination.page - 1)}
      >
        ← Назад
      </button>
      {pages.map((page) => (
        <button
          key={page}
          type="button"
          className={`${styles.pageNum} ${pagination.page === page ? styles.pageNumActive : ""}`}
          onClick={() => onPageChange(page)}
        >
          {page}
        </button>
      ))}
      <button
        type="button"
        className={styles.pageBtn}
        disabled={!pagination.hasNext}
        onClick={() => onPageChange(pagination.page + 1)}
      >
        Вперёд →
      </button>
      <span className={styles.paginationMeta}>
        {pagination.total} записей
      </span>
    </nav>
  );
}
