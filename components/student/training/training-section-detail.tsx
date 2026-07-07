"use client";

import styles from "@/components/student/training/student-training.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import {
  fetchSectionStudyView,
  markCardLearned,
  unmarkCardLearned,
  updateSectionStudySettings,
} from "@/lib/training/training-api";
import {
  BATCH_SIZE_PRESETS,
  CARD_STATUS_LABELS,
  STUDY_FILTER_LABELS,
  type SectionKind,
  type StudyFilter,
  type TrainingCard,
  type TrainingSectionNode,
} from "@/lib/training/training-types";
import { cn } from "@/lib/cn";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Play,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface TrainingSectionDetailProps {
  section: TrainingSectionNode;
  studentId: number;
  onBack: () => void;
  onStartFlashcards: (batchIndex: number, studyMode: StudyFilter) => void;
  onProgressChange?: (section: TrainingSectionNode) => void;
}

function CardListItem({
  card,
  expanded,
  onToggleExpand,
  onToggleLearned,
}: {
  card: TrainingCard;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleLearned: () => void;
}) {
  const status = card.status;

  return (
    <div
      className={cn(
        styles.cardRow,
        status === "learned" && styles.cardRowLearned,
        status === "answer_changed" && styles.cardRowStale,
      )}
    >
      <button
        type="button"
        className={styles.cardRowMain}
        onClick={onToggleExpand}
        aria-expanded={expanded}
      >
        <span className={styles.cardRowStatus} aria-hidden />
        <div className={styles.cardRowBody}>
          <span className={styles.cardRowQuestion}>{card.question}</span>
          <span className={styles.cardMeta}>{CARD_STATUS_LABELS[status]}</span>
          {expanded ? (
            <div className={styles.cardRowAnswer}>
              <span className={styles.cardRowAnswerLabel}>Ответ</span>
              {card.answer}
            </div>
          ) : null}
        </div>
        <ChevronDown
          size={18}
          className={cn(
            styles.cardRowChevron,
            expanded && styles.cardRowChevronOpen,
          )}
          aria-hidden
        />
      </button>
      <button
        type="button"
        className={cn(
          styles.cardRowToggle,
          status === "learned" && styles.cardRowToggleLearned,
        )}
        onClick={onToggleLearned}
        aria-label={
          status === "learned"
            ? "Пометить как невыученное"
            : "Пометить как выученное"
        }
        title={status === "learned" ? "Сбросить" : "Выучено"}
      >
        {status === "learned" ? (
          <RotateCcw size={18} />
        ) : (
          <Check size={18} strokeWidth={2.5} />
        )}
      </button>
    </div>
  );
}

export function TrainingSectionDetail({
  section,
  studentId,
  onBack,
  onStartFlashcards,
  onProgressChange,
}: TrainingSectionDetailProps) {
  const [cards, setCards] = useState<TrainingCard[]>([]);
  const [batches, setBatches] = useState<
    Awaited<ReturnType<typeof fetchSectionStudyView>>["batches"]
  >([]);
  const [batchSize, setBatchSize] = useState(10);
  const [studyMode, setStudyMode] = useState<StudyFilter>("unlearned");
  const [selectedBatch, setSelectedBatch] = useState(0);
  const [stats, setStats] = useState(section.stats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRef, setExpandedRef] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const sectionKind = section.kind as SectionKind;
  const sectionRefId = section.refId;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSectionStudyView(
        studentId,
        sectionKind,
        sectionRefId,
      );
      setCards(data.cards);
      setBatches(data.batches);
      setBatchSize(data.settings.batch_size);
      setStudyMode(data.settings.study_mode);
      setSelectedBatch(data.settings.last_batch_index ?? 0);
      setStats(data.stats);
      onProgressChange?.({
        ...section,
        stats: data.stats,
        total_cards: data.stats.total,
        learned_cards: data.stats.learned,
        answer_changed_cards: data.stats.answer_changed,
        progress_percent: data.stats.progress_percent ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [onProgressChange, section, sectionKind, sectionRefId, studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const persistSettings = async (
    patch: Partial<{ batch_size: number; study_mode: StudyFilter; last_batch_index: number }>,
  ) => {
    setSavingSettings(true);
    try {
      await updateSectionStudySettings(studentId, sectionKind, sectionRefId, {
        batch_size: patch.batch_size ?? batchSize,
        study_mode: patch.study_mode ?? studyMode,
        last_batch_index: patch.last_batch_index ?? selectedBatch,
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleBatchSizeChange = async (size: number) => {
    setBatchSize(size);
    setSelectedBatch(0);
    await persistSettings({ batch_size: size, last_batch_index: 0 });
    void load();
  };

  const handleStudyModeChange = async (mode: StudyFilter) => {
    setStudyMode(mode);
    await persistSettings({ study_mode: mode });
  };

  const handleToggleLearned = async (card: TrainingCard) => {
    try {
      if (card.status === "learned") {
        await unmarkCardLearned(studentId, card.card_ref);
      } else {
        await markCardLearned({
          student_id: studentId,
          section_kind: sectionKind,
          section_ref_id: sectionRefId,
          card_ref: card.card_ref,
          content_fingerprint: card.content_fingerprint,
        });
      }
      await load();
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return <LoadingState label="Загрузка раздела…" variant="panel" />;
  }

  if (error) {
    return <p className={styles.alert}>{error}</p>;
  }

  const currentBatch = batches[selectedBatch];

  return (
    <div className={styles.page}>
      <div className={styles.backRow}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          <ArrowLeft size={16} aria-hidden />
          Назад к разделам
        </button>
      </div>

      <header className={styles.header}>
        <div className={styles.detailHeader}>
          <div>
            <span className={styles.eyebrow}>Раздел</span>
            <h1 className={styles.title}>{section.name}</h1>
        {section.kind === "test" && section.sourceTestTitle ? (
          <p className={styles.cardBadge}>
            На базе теста: {section.sourceTestTitle}
          </p>
        ) : null}
          </div>
        </div>
      </header>

      <div className={styles.statsRow}>
        <span>Выучено: {stats.learned}</span>
        <span>С новым ответом: {stats.answer_changed}</span>
        <span>Осталось: {stats.unlearned}</span>
        <span>Всего: {stats.total}</span>
      </div>

      <h3 className={styles.cardsSectionTitle}>Размер батча</h3>
      <div className={styles.batchPresetRow}>
        {BATCH_SIZE_PRESETS.map((size) => (
          <button
            key={size}
            type="button"
            className={cn(
              styles.batchPresetBtn,
              batchSize === size && styles.batchPresetBtnActive,
            )}
            disabled={savingSettings}
            onClick={() => void handleBatchSizeChange(size)}
          >
            По {size}
          </button>
        ))}
      </div>

      <h3 className={styles.cardsSectionTitle}>Батчи</h3>
      <div className={styles.batchGrid}>
        {batches.map((batch) => (
          <button
            key={batch.index}
            type="button"
            className={cn(
              styles.batchCard,
              selectedBatch === batch.index && styles.batchCardActive,
            )}
            onClick={() => {
              setSelectedBatch(batch.index);
              void persistSettings({ last_batch_index: batch.index });
            }}
          >
            <strong>
              {batch.from}–{batch.to}
            </strong>
            <span className={styles.cardMeta}>
              {batch.stats.learned}/{batch.stats.total} выучено
            </span>
          </button>
        ))}
      </div>

      <h3 className={styles.cardsSectionTitle}>Режим заучивания</h3>
      <div className={styles.filterRow}>
        {(Object.keys(STUDY_FILTER_LABELS) as StudyFilter[]).map((mode) => (
          <button
            key={mode}
            type="button"
            className={cn(
              styles.filterChip,
              studyMode === mode && styles.filterChipActive,
            )}
            onClick={() => void handleStudyModeChange(mode)}
          >
            {STUDY_FILTER_LABELS[mode]}
          </button>
        ))}
      </div>

      {currentBatch ? (
        <Button
          type="button"
          onClick={() => onStartFlashcards(selectedBatch, studyMode)}
        >
          <Play size={16} aria-hidden />
          Учить батч {currentBatch.from}–{currentBatch.to}
        </Button>
      ) : null}

      <section className={styles.cardsSection}>
        <div className={styles.cardsSectionHead}>
          <h3 className={styles.cardsSectionTitle}>Все карточки</h3>
          <span className={styles.cardsSectionCount}>{cards.length}</span>
        </div>
        <div className={styles.cardsList}>
          {cards.map((card) => (
            <CardListItem
              key={card.card_ref}
              card={card}
              expanded={expandedRef === card.card_ref}
              onToggleExpand={() =>
                setExpandedRef((prev) =>
                  prev === card.card_ref ? null : card.card_ref,
                )
              }
              onToggleLearned={() => void handleToggleLearned(card)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}