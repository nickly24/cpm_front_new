"use client";

import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchProctorHomeworks } from "@/lib/proctor/proctor-api";
import type {
  ProctorHomeworkItem,
  ProctorHomeworkTypeFilter,
} from "@/lib/proctor/proctor-types";
import {
  formatProctorDate,
  getProctorDeadlineLabel,
} from "@/lib/proctor/proctor-utils";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProctorHomeworkSessions } from "./proctor-homework-sessions";
import { ProctorHomeworkTypeToggle } from "./proctor-homework-type-toggle";
import styles from "./proctor.module.css";

const HOMEWORK_PAGE_SIZE = 6;

function getHomeworkTypeClass(type: string): string {
  const normalized = type.trim().toUpperCase();
  if (normalized === "ДЗНВ") {
    return styles.hwTypeDznv;
  }
  if (normalized === "ОВ") {
    return styles.hwTypeOv;
  }
  return "";
}

interface ProctorHomeworkListProps {
  proctorId: number;
}

export function ProctorHomeworkList({ proctorId }: ProctorHomeworkListProps) {
  const [homeworks, setHomeworks] = useState<ProctorHomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<ProctorHomeworkTypeFilter>("all");

  useEffect(() => {
    let cancelled = false;

    async function loadHomeworks() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchProctorHomeworks({
          type: typeFilter === "all" ? undefined : typeFilter,
          limit: 200,
        });
        if (cancelled) {
          return;
        }

        if (response.status && Array.isArray(response.res)) {
          setHomeworks(response.res);
          setCurrentPage(1);
          setExpandedId(null);
        } else {
          setHomeworks([]);
          setError("Не удалось загрузить домашние задания");
        }
      } catch (err) {
        if (!cancelled) {
          setHomeworks([]);
          setError(
            err instanceof Error
              ? err.message
              : "Ошибка при загрузке заданий",
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

  const totalPages = Math.max(
    1,
    Math.ceil(homeworks.length / HOMEWORK_PAGE_SIZE),
  );

  const currentHomeworks = useMemo(() => {
    const start = (currentPage - 1) * HOMEWORK_PAGE_SIZE;
    return homeworks.slice(start, start + HOMEWORK_PAGE_SIZE);
  }, [currentPage, homeworks]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (loading) {
    return <LoadingState label="Загрузка заданий…" variant="panel" />;
  }

  if (error) {
    return <div className={styles.errorBox}>{error}</div>;
  }

  return (
    <>
      <div className={styles.filtersRow}>
        <ProctorHomeworkTypeToggle value={typeFilter} onChange={setTypeFilter} />
        <span className={styles.counter}>Заданий: {homeworks.length}</span>
      </div>

      {homeworks.length === 0 ? (
        <div className={styles.emptyState}>
          Домашние задания по выбранному фильтру не найдены
        </div>
      ) : (
        <>
          <div className={styles.homeworkList}>
            {currentHomeworks.map((homework) => {
              const expanded = expandedId === homework.id;

              return (
                <article
                  key={homework.id}
                  className={`${styles.hwCard} ${
                    expanded ? styles.hwCardExpanded : ""
                  }`.trim()}
                >
                  <button
                    type="button"
                    className={styles.hwCardHead}
                    aria-expanded={expanded}
                    onClick={() =>
                      setExpandedId((prev) =>
                        prev === homework.id ? null : homework.id,
                      )
                    }
                  >
                    <div className={styles.hwCardMain}>
                      <span
                        className={`${styles.hwType} ${getHomeworkTypeClass(homework.type)}`.trim()}
                      >
                        {homework.type}
                      </span>
                      <h3 className={styles.hwTitle}>{homework.name}</h3>
                      <div className={styles.hwDeadlineRow}>
                        <CalendarDays size={14} />
                        <span>
                          Дедлайн: {formatProctorDate(homework.deadline)}
                        </span>
                        <span className={styles.deadlineMuted}>
                          {getProctorDeadlineLabel(homework.deadline)}
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      size={20}
                      className={`${styles.hwExpandIcon} ${
                        expanded ? styles.toggleIconOpen : ""
                      }`.trim()}
                    />
                  </button>

                  {expanded ? (
                    <div className={styles.hwDetails}>
                      <ProctorHomeworkSessions
                        homeworkId={homework.id}
                        proctorId={proctorId}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className={styles.closeDetailsBtn}
                        onClick={() => setExpandedId(null)}
                      >
                        Закрыть
                      </Button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          {totalPages > 1 ? (
            <nav className={styles.pagination} aria-label="Страницы заданий">
              <button
                type="button"
                className={styles.pageBtn}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => page - 1)}
              >
                ← Назад
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                (page) => (
                  <button
                    key={page}
                    type="button"
                    className={`${styles.pageNumber} ${
                      currentPage === page ? styles.pageNumberActive : ""
                    }`.trim()}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ),
              )}
              <button
                type="button"
                className={styles.pageBtn}
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((page) => page + 1)}
              >
                Вперёд →
              </button>
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
