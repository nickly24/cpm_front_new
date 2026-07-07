"use client";

import styles from "@/components/student/training/student-training.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchTrainingSectionsByDirection } from "@/lib/training/training-api";
import type {
  SectionKind,
  TrainingDirection,
  TrainingSectionNode,
} from "@/lib/training/training-types";
import { calcProgressPercent, getProgressLabel } from "@/lib/training/training-utils";
import { cn } from "@/lib/cn";
import { ClipboardList, FileText, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchPopoverRef = useRef<HTMLDivElement>(null);
  const filtersPopoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filtersActive = kindFilter !== "all" || progressFilter !== "all";

  useEffect(() => {
    if (!searchOpen && !filtersOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        searchOpen &&
        searchPopoverRef.current &&
        !searchPopoverRef.current.contains(target)
      ) {
        setSearchOpen(false);
      }
      if (
        filtersOpen &&
        filtersPopoverRef.current &&
        !filtersPopoverRef.current.contains(target)
      ) {
        setFiltersOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [filtersOpen, searchOpen]);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

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
      {searchOpen || filtersOpen ? (
        <button
          type="button"
          className={styles.sectionsPopoverBackdrop}
          aria-label="Закрыть"
          onClick={() => {
            setSearchOpen(false);
            setFiltersOpen(false);
          }}
        />
      ) : null}

      <div className={styles.sectionsCatalogHeader}>
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

        <div className={styles.sectionsCatalogActions}>
          <div className={styles.sectionsPopoverAnchor} ref={searchPopoverRef}>
            <button
              type="button"
              className={cn(
                styles.sectionsIconBtn,
                (searchOpen || searchTerm.trim()) && styles.sectionsIconBtnActive,
              )}
              aria-label="Поиск раздела"
              aria-expanded={searchOpen}
              onClick={() => {
                setSearchOpen((prev) => !prev);
                setFiltersOpen(false);
              }}
            >
              <Search size={17} aria-hidden />
            </button>
            {searchOpen ? (
              <div className={styles.sectionsPopover} role="dialog" aria-label="Поиск">
                <label className={styles.sectionsSearch}>
                  <Search size={15} aria-hidden />
                  <input
                    ref={searchInputRef}
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Поиск раздела..."
                  />
                </label>
              </div>
            ) : null}
          </div>

          <div className={styles.sectionsPopoverAnchor} ref={filtersPopoverRef}>
            <button
              type="button"
              className={cn(
                styles.sectionsIconBtn,
                (filtersOpen || filtersActive) && styles.sectionsIconBtnActive,
              )}
              aria-label="Фильтры"
              aria-expanded={filtersOpen}
              onClick={() => {
                setFiltersOpen((prev) => !prev);
                setSearchOpen(false);
              }}
            >
              <SlidersHorizontal size={17} aria-hidden />
            </button>
            {filtersOpen ? (
              <div className={styles.sectionsPopover} role="dialog" aria-label="Фильтры">
                <p className={styles.sectionsPopoverLabel}>Тип</p>
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
                <p className={styles.sectionsPopoverLabel}>Прогресс</p>
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
            ) : null}
          </div>
        </div>
      </div>

      <div className={styles.sectionsList}>
        {sections.map((section) => {
          const staleCount = section.answer_changed_cards ?? 0;
          const showSourceTest =
            section.kind === "test" &&
            section.sourceTestTitle &&
            section.sourceTestTitle.trim() !== section.name.trim();

          const progressPercent = calcProgressPercent(
            section.learned_cards,
            section.total_cards,
          );
          const progressWidth =
            progressPercent > 0 ? Math.max(progressPercent, 3) : 0;

          return (
            <div
              key={`${section.kind}:${section.refId}`}
              role="button"
              tabIndex={0}
              className={styles.sectionListItem}
              onClick={() => onSelectSection(section)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectSection(section);
                }
              }}
            >
              <div className={styles.sectionListItemHead}>
                <span
                  className={cn(
                    styles.sectionKindBadge,
                    section.kind === "test" && styles.sectionKindBadgeTest,
                  )}
                >
                  {section.kind === "test" ? (
                    <ClipboardList size={12} aria-hidden />
                  ) : (
                    <FileText size={12} aria-hidden />
                  )}
                  {section.kind === "test" ? "Из теста" : "Свои карточки"}
                </span>
                <span className={styles.sectionListItemPercent}>
                  {progressPercent}%
                </span>
              </div>

              <h3 className={styles.sectionListItemTitle}>{section.name}</h3>

              {showSourceTest ? (
                <p className={styles.sectionListItemSource}>
                  Тест: {section.sourceTestTitle}
                </p>
              ) : null}

              <p className={styles.sectionListItemMeta}>
                <span>
                  {section.learned_cards} из {section.total_cards} выучено
                </span>
                <span className={styles.sectionListItemDot} aria-hidden>
                  ·
                </span>
                <span>{getProgressLabel(progressPercent)}</span>
                {staleCount > 0 ? (
                  <>
                    <span className={styles.sectionListItemDot} aria-hidden>
                      ·
                    </span>
                    <span className={styles.sectionListItemStale}>
                      {staleCount} с новым ответом
                    </span>
                  </>
                ) : null}
              </p>

              <div
                className={styles.batchRowTrack}
                style={{ height: 8, width: "100%" }}
              >
                <div
                  className={styles.batchRowFill}
                  style={{ width: `${progressWidth}%` }}
                />
              </div>
            </div>
          );
        })}
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
