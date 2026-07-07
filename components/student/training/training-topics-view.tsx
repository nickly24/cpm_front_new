"use client";

import styles from "@/components/student/training/student-training.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchTrainingSectionsByDirection } from "@/lib/training/training-api";
import type {
  SectionKind,
  TrainingDirection,
  TrainingSectionNode,
} from "@/lib/training/training-types";
import { getProgressLabel } from "@/lib/training/training-utils";
import { cn } from "@/lib/cn";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

interface TrainingSectionsListViewProps {
  directions: TrainingDirection[];
  direction: TrainingDirection;
  selectedDirectionId: number;
  onSelectDirection: (directionId: number) => void;
  studentId: number;
  loading: boolean;
  error: string | null;
  onSelectSection: (section: TrainingSectionNode) => void;
}

export function TrainingSectionsListView({
  directions,
  direction,
  selectedDirectionId,
  onSelectDirection,
  studentId,
  loading,
  error,
  onSelectSection,
}: TrainingSectionsListViewProps) {
  const PAGE_SIZE = 6;
  const [searchTerm, setSearchTerm] = useState("");
  const [kindFilter, setKindFilter] = useState<SectionKind | "all">("all");
  const [progressFilter, setProgressFilter] = useState<
    "all" | "in_progress" | "learned"
  >("all");
  const [page, setPage] = useState(1);
  const [sections, setSections] = useState<TrainingSectionNode[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionsError, setSectionsError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, kindFilter, progressFilter, direction.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadSections() {
      setSectionsLoading(true);
      setSectionsError(null);
      try {
        const response = await fetchTrainingSectionsByDirection(studentId, direction.id, {
          page,
          limit: PAGE_SIZE,
          search: searchTerm,
          kind: kindFilter,
          progress: progressFilter,
        });
        if (cancelled) return;
        setSections(response.sections ?? []);
        setTotalPages(response.pagination?.pages ?? 1);
        setTotalItems(response.pagination?.total ?? 0);
      } catch (err) {
        if (cancelled) return;
        setSections([]);
        setTotalPages(1);
        setTotalItems(0);
        setSectionsError(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        if (!cancelled) setSectionsLoading(false);
      }
    }
    void loadSections();
    return () => {
      cancelled = true;
    };
  }, [direction.id, kindFilter, page, progressFilter, searchTerm, studentId]);

  if (loading) {
    return <LoadingState label="Загрузка разделов…" variant="panel" />;
  }

  if (error) {
    return <p className={styles.alert}>{error}</p>;
  }

  return (
    <div className={styles.sectionsCatalog}>
      <div className={styles.sectionsFilterRow}>
        {directions.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              styles.sectionsFilterChip,
              selectedDirectionId === item.id && styles.sectionsFilterChipActive,
            )}
            onClick={() => onSelectDirection(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className={styles.sectionsToolbar}>
        <label className={styles.sectionsSearch}>
          <Search size={15} aria-hidden />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Поиск раздела..."
          />
        </label>
        <div className={styles.sectionsFilterRow}>
          {([
            ["all", "Все"],
            ["manual", "Только карточки"],
            ["test", "Только тесты"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                styles.sectionsFilterChip,
                kindFilter === value && styles.sectionsFilterChipActive,
              )}
              onClick={() => setKindFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.sectionsFilterRow}>
          {([
            ["all", "Все"],
            ["in_progress", "Есть что учить"],
            ["learned", "Полностью выучено"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                styles.sectionsFilterChip,
                progressFilter === value && styles.sectionsFilterChipActive,
              )}
              onClick={() => setProgressFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.cardGrid}>
        {sections.map((section) => (
          <button
            key={`${section.kind}:${section.refId}`}
            type="button"
            className={cn(
              styles.topicCard,
              section.kind === "test" && styles.topicCardTest,
            )}
            onClick={() => onSelectSection(section)}
          >
            <h3 className={styles.cardName}>{section.name}</h3>
            {section.kind === "test" && section.sourceTestTitle ? (
              <p className={styles.cardBadge}>
                На базе теста: {section.sourceTestTitle}
              </p>
            ) : null}
            <p className={styles.cardMeta}>
              {section.learned_cards} / {section.total_cards} выучено
              {(section.answer_changed_cards ?? 0) > 0
                ? ` · ${section.answer_changed_cards} с новым ответом`
                : ""}
            </p>
            <div className={styles.progressRow}>
              <span className={styles.progressLabel}>
                {getProgressLabel(section.progress_percent)}
              </span>
              <span className={styles.progressValue}>
                {section.progress_percent}%
              </span>
            </div>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{ width: `${section.progress_percent}%` }}
              />
            </div>
          </button>
        ))}
      </div>

      {sectionsError ? <p className={styles.alert}>{sectionsError}</p> : null}
      {sectionsLoading ? (
        <LoadingState label="Загрузка разделов…" variant="inline" />
      ) : null}
      <div className={styles.sectionsPagination}>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
        >
          Назад
        </button>
        <span>
          Страница {page} из {totalPages} · {totalItems}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
        >
          Далее
        </button>
      </div>

      {!sectionsLoading && totalItems === 0 ? (
        <div className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>Разделы не найдены</h2>
          <p className={styles.emptyText}>
            Попробуйте изменить фильтры или строку поиска.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated use TrainingSectionsListView */
export const TrainingTopicsView = TrainingSectionsListView;
