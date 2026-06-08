"use client";

import styles from "@/components/student/tests/tests.module.css";
import type { TestsPagination as TestsPaginationMeta } from "@/lib/student/tests-types";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TestsPaginationProps {
  pagination: TestsPaginationMeta | null | undefined;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function TestsPagination({
  pagination,
  onPageChange,
  disabled = false,
}: TestsPaginationProps) {
  if (!pagination || pagination.total_pages <= 1) {
    return null;
  }

  const { current_page, total_pages, total_items } = pagination;
  const canPrev = current_page > 1;
  const canNext = current_page < total_pages;

  return (
    <nav className={styles.pagination} aria-label="Страницы списка тестов">
      <button
        type="button"
        className={styles.paginationBtn}
        disabled={disabled || !canPrev}
        onClick={() => onPageChange(current_page - 1)}
        aria-label="Предыдущая страница"
      >
        <ChevronLeft size={16} />
      </button>

      <span className={styles.paginationMeta}>
        {current_page} из {total_pages}
        <span className={styles.paginationTotal}> · {total_items} тестов</span>
      </span>

      <button
        type="button"
        className={styles.paginationBtn}
        disabled={disabled || !canNext}
        onClick={() => onPageChange(current_page + 1)}
        aria-label="Следующая страница"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
