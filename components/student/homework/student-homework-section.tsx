"use client";

import { HomeworkCard } from "@/components/student/homework/homework-card";
import { HomeworkPagination } from "@/components/student/homework/homework-pagination";
import { SectionHeroBanner } from "@/components/student/section-hero-banner";
import styles from "@/components/student/homework/homework.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import { STUDENT_SECTION_BANNERS } from "@/lib/student/section-banners";
import {
  buildHomeworkSummary,
  fetchStudentHomework,
  filterHomeworkByStatus,
  paginateHomework,
} from "@/lib/student/homework-api";
import { HomeworkFilterSelect } from "@/components/student/homework/homework-filter-select";
import {
  HOMEWORK_STATUS_FILTER_OPTIONS,
  HOMEWORK_TYPE_FILTER_OPTIONS,
} from "@/components/student/homework/homework-filter-options";
import {
  HOMEWORK_FETCH_LIMIT,
  HOMEWORK_PAGE_SIZE,
  type HomeworkStatusFilter,
  type HomeworkTypeFilter,
  type StudentHomeworkItem,
} from "@/lib/student/homework-types";
import { useEffect, useMemo, useState } from "react";
import { HomeworkWorkspaceModal } from "@/components/homework/homework-workspace";

export function StudentHomeworkSection() {
  const [items, setItems] = useState<StudentHomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<HomeworkTypeFilter>("all");
  const [statusFilter, setStatusFilter] =
    useState<HomeworkStatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [openHomeworkId, setOpenHomeworkId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHomeworks() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchStudentHomework({
          page: 1,
          limit: HOMEWORK_FETCH_LIMIT,
          type: typeFilter,
        });

        if (cancelled) {
          return;
        }

        if (response.status && Array.isArray(response.res)) {
          setItems(response.res);
        } else {
          setItems([]);
          setError("Не удалось загрузить домашние задания");
        }
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          setError(
            err instanceof Error
              ? err.message
              : "Ошибка при загрузке домашних заданий",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadHomeworks();

    return () => {
      cancelled = true;
    };
  }, [typeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, statusFilter]);

  const filteredItems = useMemo(
    () => filterHomeworkByStatus(items, statusFilter),
    [items, statusFilter],
  );

  const summary = useMemo(() => buildHomeworkSummary(items), [items]);

  const pagination = useMemo(
    () => paginateHomework(filteredItems, currentPage, HOMEWORK_PAGE_SIZE),
    [filteredItems, currentPage],
  );

  if (loading) {
    return (
      <div className={styles.page}>
        <SectionHeroBanner
          imageSrc={STUDENT_SECTION_BANNERS.homework}
          eyebrow="Домашка"
          title="Домашние задания"
          subtitle="Все ваши задания с типом, дедлайном, статусом сдачи и баллом."
        />
        <LoadingState label="Загрузка домашних заданий…" variant="block" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SectionHeroBanner
        imageSrc={STUDENT_SECTION_BANNERS.homework}
        eyebrow="Домашка"
        title="Домашние задания"
        subtitle="Все ваши задания с типом, дедлайном, статусом сдачи и баллом."
      />

      <div className={styles.summaryGrid}>
        <div className={`${styles.summaryStat} ${styles.summaryStatTotal}`}>
          <span className={styles.summaryLabel}>Всего</span>
          <span className={styles.summaryValue}>{summary.total}</span>
        </div>
        <div className={`${styles.summaryStat} ${styles.summaryStatDone}`}>
          <span className={styles.summaryLabel}>Сдано</span>
          <span className={styles.summaryValue}>{summary.submitted}</span>
        </div>
        <div className={`${styles.summaryStat} ${styles.summaryStatPending}`}>
          <span className={styles.summaryLabel}>Не сдано</span>
          <span className={styles.summaryValue}>{summary.pending}</span>
        </div>
      </div>

      {error ? <div className={styles.alert}>{error}</div> : null}

      <section className={styles.toolbar}>
        <div className={styles.filters}>
          <HomeworkFilterSelect
            label="Статус"
            value={statusFilter}
            options={HOMEWORK_STATUS_FILTER_OPTIONS}
            onChange={setStatusFilter}
          />

          <HomeworkFilterSelect
            label="Тип"
            value={typeFilter}
            options={HOMEWORK_TYPE_FILTER_OPTIONS}
            onChange={setTypeFilter}
          />
        </div>

        <p className={styles.resultMeta}>
          Показано {pagination.items.length} из {pagination.totalItems}
        </p>
      </section>

      {pagination.items.length > 0 ? (
        <section className={styles.grid}>
          {pagination.items.map((item) => (
            <HomeworkCard key={item.homework_id} item={item} onOpen={() => setOpenHomeworkId(item.homework_id)} />
          ))}
        </section>
      ) : (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>Заданий не найдено</h2>
          <p className={styles.emptyText}>
            Попробуйте изменить фильтры или дождитесь новых домашних заданий.
          </p>
        </div>
      )}

      <HomeworkPagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        onPageChange={setCurrentPage}
      />
      {openHomeworkId ? <HomeworkWorkspaceModal homeworkId={openHomeworkId} onClose={() => setOpenHomeworkId(null)} /> : null}
    </div>
  );
}
