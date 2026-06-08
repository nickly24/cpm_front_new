"use client";

import styles from "@/components/student/training/student-training.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import type { TrainingSection } from "@/lib/training/training-types";
import { getProgressLabel } from "@/lib/training/training-utils";

interface TrainingSectionsViewProps {
  sections: TrainingSection[];
  loading: boolean;
  error: string | null;
  onSelectSection: (section: TrainingSection) => void;
}

export function TrainingSectionsView({
  sections,
  loading,
  error,
  onSelectSection,
}: TrainingSectionsViewProps) {
  if (loading) {
    return <LoadingState label="Загрузка тем…" variant="panel" />;
  }

  if (error) {
    return <p className={styles.alert}>{error}</p>;
  }

  if (sections.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h2 className={styles.emptyTitle}>Темы пока недоступны</h2>
        <p className={styles.emptyText}>
          Разделы тренировки появятся, когда преподаватель добавит карточки.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.cardGrid}>
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          className={styles.sectionCard}
          onClick={() => onSelectSection(section)}
        >
          <h3 className={styles.cardName}>{section.name}</h3>
          <p className={styles.cardMeta}>
            {section.topics.length}{" "}
            {section.topics.length === 1 ? "тренировка" : "тренировок"} ·{" "}
            {section.learned_cards} / {section.total_cards} карточек
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
