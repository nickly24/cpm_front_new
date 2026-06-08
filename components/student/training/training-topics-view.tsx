"use client";

import styles from "@/components/student/training/student-training.module.css";
import { LoadingState } from "@/components/ui/loading-state";
import type { TrainingSection, TrainingTopic } from "@/lib/training/training-types";
import { getProgressLabel } from "@/lib/training/training-utils";

interface TrainingTopicsViewProps {
  section: TrainingSection;
  loading: boolean;
  error: string | null;
  onSelectTopic: (topic: TrainingTopic) => void;
}

export function TrainingTopicsView({
  section,
  loading,
  error,
  onSelectTopic,
}: TrainingTopicsViewProps) {
  if (loading) {
    return <LoadingState label="Загрузка тренировок…" variant="panel" />;
  }

  if (error) {
    return <p className={styles.alert}>{error}</p>;
  }

  const topics = section.topics;

  if (topics.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h2 className={styles.emptyTitle}>Тренировок нет</h2>
        <p className={styles.emptyText}>
          В разделе «{section.name}» пока нет тем с карточками.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.cardGrid}>
      {topics.map((topic) => (
        <button
          key={topic.id}
          type="button"
          className={styles.topicCard}
          onClick={() => onSelectTopic(topic)}
        >
          <h3 className={styles.cardName}>{topic.name}</h3>
          <p className={styles.cardMeta}>
            {topic.learned_cards} / {topic.total_cards} выучено
          </p>
          <div className={styles.progressRow}>
            <span className={styles.progressLabel}>
              {getProgressLabel(topic.progress_percent)}
            </span>
            <span className={styles.progressValue}>
              {topic.progress_percent}%
            </span>
          </div>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${topic.progress_percent}%` }}
            />
          </div>
        </button>
      ))}
    </div>
  );
}
