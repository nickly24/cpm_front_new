"use client";

import styles from "@/components/student/training/student-training.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import {
  fetchAllCardsByTheme,
  markQuestionLearned,
  unmarkQuestionLearned,
} from "@/lib/training/training-api";
import type { TrainingCard, TrainingTopic } from "@/lib/training/training-types";
import { calcProgressPercent, splitCardsByLearned } from "@/lib/training/training-utils";
import { cn } from "@/lib/cn";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Play,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface TrainingTopicDetailProps {
  topic: TrainingTopic;
  studentId: number;
  onBack: () => void;
  onStartFlashcards: () => void;
  onProgressChange?: (topic: TrainingTopic) => void;
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
  const learned = Boolean(card.is_learned);

  return (
    <div
      className={cn(styles.cardRow, learned && styles.cardRowLearned)}
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
          learned && styles.cardRowToggleLearned,
        )}
        onClick={onToggleLearned}
        aria-label={
          learned ? "Пометить как невыученное" : "Пометить как выученное"
        }
        title={learned ? "Сбросить прогресс" : "Выучено"}
      >
        {learned ? <RotateCcw size={18} /> : <Check size={18} strokeWidth={2.5} />}
      </button>
    </div>
  );
}

function CardsSection({
  title,
  count,
  cards,
  expandedId,
  onToggleExpand,
  onToggleLearned,
  emptyText,
}: {
  title: string;
  count: number;
  cards: TrainingCard[];
  expandedId: number | null;
  onToggleExpand: (id: number) => void;
  onToggleLearned: (id: number, learned: boolean) => void;
  emptyText: string;
}) {
  return (
    <section className={styles.cardsSection}>
      <div className={styles.cardsSectionHead}>
        <h3 className={styles.cardsSectionTitle}>{title}</h3>
        <span className={styles.cardsSectionCount}>{count}</span>
      </div>
      {cards.length === 0 ? (
        <p className={styles.cardMeta}>{emptyText}</p>
      ) : (
        <div className={styles.cardsList}>
          {cards.map((card) => (
            <CardListItem
              key={card.id}
              card={card}
              expanded={expandedId === card.id}
              onToggleExpand={() => onToggleExpand(card.id)}
              onToggleLearned={() =>
                onToggleLearned(card.id, Boolean(card.is_learned))
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function TrainingTopicDetail({
  topic,
  studentId,
  onBack,
  onStartFlashcards,
  onProgressChange,
}: TrainingTopicDetailProps) {
  const [cards, setCards] = useState<TrainingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [topicStats, setTopicStats] = useState(topic);
  const onProgressChangeRef = useRef(onProgressChange);

  useEffect(() => {
    onProgressChangeRef.current = onProgressChange;
  }, [onProgressChange]);

  useEffect(() => {
    setTopicStats(topic);
  }, [topic]);

  const syncTopicStats = useCallback(
    (allCards: TrainingCard[], notifyParent: boolean) => {
      const learned = allCards.filter((c) => c.is_learned).length;
      const total = allCards.length;
      const updated: TrainingTopic = {
        ...topic,
        learned_cards: learned,
        total_cards: total,
        progress_percent: calcProgressPercent(learned, total),
      };
      setTopicStats(updated);
      if (notifyParent) {
        onProgressChangeRef.current?.(updated);
      }
    },
    [topic],
  );

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllCardsByTheme(studentId, topic.id);
      setCards(data.cards);
      syncTopicStats(data.cards, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки карточек");
    } finally {
      setLoading(false);
    }
  }, [studentId, topic.id, syncTopicStats]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const handleToggleLearned = async (
    cardId: number,
    isCurrentlyLearned: boolean,
  ) => {
    try {
      if (isCurrentlyLearned) {
        await unmarkQuestionLearned(studentId, cardId);
      } else {
        await markQuestionLearned({
          student_id: studentId,
          question_id: cardId,
        });
      }
      setCards((prev) => {
        const updated = prev.map((c) =>
          c.id === cardId ? { ...c, is_learned: !isCurrentlyLearned } : c,
        );
        syncTopicStats(updated, true);
        return updated;
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось обновить статус",
      );
    }
  };

  const { learned, unlearned } = splitCardsByLearned(cards);
  const progressPercent = topicStats.total_cards
    ? Math.round(
        (topicStats.learned_cards / topicStats.total_cards) * 100,
      )
    : 0;

  return (
    <div className={styles.page}>
      <div className={styles.backRow}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          <ArrowLeft size={16} aria-hidden />
          Назад к тренировкам
        </button>
      </div>

      <header className={styles.header}>
        <div className={styles.detailHeader}>
          <div>
            <span className={styles.eyebrow}>Тренировка</span>
            <h1 className={styles.title}>{topicStats.name}</h1>
            <div className={styles.detailProgressBlock}>
              <div className={styles.detailProgressMeta}>
                <span>
                  Выучено{" "}
                  <strong>
                    {topicStats.learned_cards} / {topicStats.total_cards}
                  </strong>
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className={styles.detailProgressTrack}>
                <div
                  className={styles.detailProgressFill}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
          <div className={styles.detailActions}>
            <Button
              type="button"
              className={styles.flashModeBtn}
              onClick={onStartFlashcards}
              disabled={unlearned.length === 0}
            >
              <Play size={18} fill="currentColor" aria-hidden />
              Режим карточек
            </Button>
          </div>
        </div>
      </header>

      {loading ? (
        <LoadingState label="Загрузка карточек…" variant="panel" />
      ) : error ? (
        <p className={styles.alert}>{error}</p>
      ) : (
        <div className={styles.cardsPanel}>
          <CardsSection
            title="Невыученные"
            count={unlearned.length}
            cards={unlearned}
            expandedId={expandedId}
            onToggleExpand={(id) =>
              setExpandedId((prev) => (prev === id ? null : id))
            }
            onToggleLearned={handleToggleLearned}
            emptyText="Все карточки в этой теме выучены."
          />
          <CardsSection
            title="Выученные"
            count={learned.length}
            cards={learned}
            expandedId={expandedId}
            onToggleExpand={(id) =>
              setExpandedId((prev) => (prev === id ? null : id))
            }
            onToggleLearned={handleToggleLearned}
            emptyText="Пока нет выученных карточек."
          />
        </div>
      )}
    </div>
  );
}
