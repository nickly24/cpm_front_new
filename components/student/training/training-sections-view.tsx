"use client";

import styles from "@/components/student/training/student-training.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import type { TrainingDirection } from "@/lib/training/training-types";
import { getProgressLabel } from "@/lib/training/training-utils";

interface TrainingDirectionsViewProps {
  directions: TrainingDirection[];
  loading: boolean;
  error: string | null;
  onSelectDirection: (direction: TrainingDirection) => void;
}

export function TrainingDirectionsView({
  directions,
  loading,
  error,
  onSelectDirection,
}: TrainingDirectionsViewProps) {
  if (loading) {
    return <LoadingState label="Загрузка направлений…" variant="panel" />;
  }

  if (error) {
    return <p className={styles.alert}>{error}</p>;
  }

  if (directions.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h2 className={styles.emptyTitle}>Направления пока недоступны</h2>
        <p className={styles.emptyText}>
          Разделы с карточками появятся, когда преподаватель добавит материал
          или откроет ответы в тестах.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.cardGrid}>
      {directions.map((direction) => (
        <button
          key={direction.id}
          type="button"
          className={styles.sectionCard}
          onClick={() => onSelectDirection(direction)}
        >
          <h3 className={styles.cardName}>{direction.name}</h3>
          <p className={styles.cardMeta}>
            {direction.sections.length}{" "}
            {direction.sections.length === 1 ? "раздел" : "разделов"} ·{" "}
            {direction.learned_cards} / {direction.total_cards} выучено
          </p>
          <div className={styles.progressRow}>
            <span className={styles.progressLabel}>
              {getProgressLabel(direction.progress_percent)}
            </span>
            <span className={styles.progressValue}>
              {direction.progress_percent}%
            </span>
          </div>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${direction.progress_percent}%` }}
            />
          </div>
        </button>
      ))}
    </div>
  );
}

/** @deprecated use TrainingDirectionsView */
export const TrainingSectionsView = TrainingDirectionsView;
