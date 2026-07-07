"use client";

import styles from "@/components/student/training/student-training.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import type {
  TrainingDirection,
  TrainingSectionNode,
} from "@/lib/training/training-types";
import { getProgressLabel } from "@/lib/training/training-utils";
import { cn } from "@/lib/cn";

interface TrainingSectionsListViewProps {
  direction: TrainingDirection;
  loading: boolean;
  error: string | null;
  onSelectSection: (section: TrainingSectionNode) => void;
}

export function TrainingSectionsListView({
  direction,
  loading,
  error,
  onSelectSection,
}: TrainingSectionsListViewProps) {
  if (loading) {
    return <LoadingState label="Загрузка разделов…" variant="panel" />;
  }

  if (error) {
    return <p className={styles.alert}>{error}</p>;
  }

  const sections = direction.sections;

  if (sections.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h2 className={styles.emptyTitle}>Разделов нет</h2>
        <p className={styles.emptyText}>
          В направлении «{direction.name}» пока нет карточек.
        </p>
      </div>
    );
  }

  return (
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
  );
}

/** @deprecated use TrainingSectionsListView */
export const TrainingTopicsView = TrainingSectionsListView;
