"use client";

import { HomeworkCard } from "@/components/student/homework/homework-card";
import { HomeworkPagination } from "@/components/student/homework/homework-pagination";
import styles from "@/components/student/homework/homework.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import {
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
import { Grid2X2, List, SlidersHorizontal } from "lucide-react";
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
  const [sort, setSort] = useState<"deadline-new" | "deadline-old" | "name">("deadline-new");
  const [view, setView] = useState<"grid" | "list">("grid");

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
    const openFromUpload = (event: Event) => {
      const homeworkId = (event as CustomEvent<{ homeworkId?: number }>).detail?.homeworkId;
      if (homeworkId) setOpenHomeworkId(homeworkId);
    };
    window.addEventListener("homework-upload-open", openFromUpload);
    return () => window.removeEventListener("homework-upload-open", openFromUpload);
  }, []);

  const filteredItems = useMemo(() => {
    const result = [...filterHomeworkByStatus(items, statusFilter)];
    result.sort((left, right) => {
      if (sort === "name") return left.homework_name.localeCompare(right.homework_name, "ru");
      const leftDate = left.deadline ? new Date(left.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDate = right.deadline ? new Date(right.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      return sort === "deadline-new" ? leftDate - rightDate : rightDate - leftDate;
    });
    return result;
  }, [items, sort, statusFilter]);

  const pagination = useMemo(
    () => paginateHomework(filteredItems, currentPage, HOMEWORK_PAGE_SIZE),
    [filteredItems, currentPage],
  );

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeading}><h1>Домашние задания</h1><p>Ваши задания и работы</p></div>
        <LoadingState label="Загрузка домашних заданий…" variant="block" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeading}><h1>Домашние задания</h1><p>Ваши задания и работы</p></div>

      {error ? <div className={styles.alert}>{error}</div> : null}

      <section className={styles.toolbar}>
        <div className={styles.filters}>
          <HomeworkFilterSelect
            label="Статус"
            value={statusFilter}
            options={HOMEWORK_STATUS_FILTER_OPTIONS}
            onChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}
          />

          <HomeworkFilterSelect
            label="Тип"
            value={typeFilter}
            options={HOMEWORK_TYPE_FILTER_OPTIONS}
            onChange={(value) => { setTypeFilter(value); setCurrentPage(1); }}
          />
        </div>
        <div className={styles.toolbarRight}>
          <label className={styles.sortField}>Сортировка:
            <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
              <option value="deadline-new">Срок сдачи: новые</option>
              <option value="deadline-old">Срок сдачи: поздние</option>
              <option value="name">По названию</option>
            </select>
          </label>
          <div className={styles.viewSwitch} aria-label="Вид списка">
            <button type="button" data-active={view === "grid"} onClick={() => setView("grid")} aria-label="Плитка"><Grid2X2 /></button>
            <button type="button" data-active={view === "list"} onClick={() => setView("list")} aria-label="Список"><List /></button>
          </div>
          <button type="button" className={styles.mobileFilterIcon} aria-label="Фильтры"><SlidersHorizontal /></button>
        </div>
      </section>

      {pagination.items.length > 0 ? (
        <section className={styles.grid} data-view={view}>
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
      <p className={styles.resultMeta}>Показано {pagination.items.length} из {pagination.totalItems}</p>
      {openHomeworkId ? <HomeworkWorkspaceModal homeworkId={openHomeworkId} onClose={() => setOpenHomeworkId(null)} /> : null}
    </div>
  );
}
