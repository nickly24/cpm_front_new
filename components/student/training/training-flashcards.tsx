"use client";

import styles from "@/components/student/training/student-training.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { useCabinetChrome } from "@/contexts/cabinet-chrome-context";
import {
  fetchCardsToLearn,
  fetchLearnedQuestions,
  markQuestionLearned,
} from "@/lib/training/training-api";
import type { TrainingCard, TrainingTopic } from "@/lib/training/training-types";
import {
  FLASH_ONBOARDING_KEY,
  shuffleCards,
} from "@/lib/training/training-utils";
import { cn } from "@/lib/cn";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type AnimationState =
  | "idle"
  | "flipping"
  | "swiping-left"
  | "swiping-right";

interface TrainingFlashcardsProps {
  topic: TrainingTopic;
  studentId: number;
  onBack: () => void;
  onLearnedCountChange?: (learned: number, total: number) => void;
}

export function TrainingFlashcards({
  topic,
  studentId,
  onBack,
  onLearnedCountChange,
}: TrainingFlashcardsProps) {
  const { setImmersive } = useCabinetChrome();
  const [cards, setCards] = useState<TrainingCard[]>([]);
  const [learnedCount, setLearnedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [animationState, setAnimationState] = useState<AnimationState>("idle");
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const touchStartX = useRef(0);
  const swipeOffsetRef = useRef(0);
  const mouseDragging = useRef(false);
  const mouseStartX = useRef(0);
  const wasDragging = useRef(false);

  const setSwipe = (value: number) => {
    swipeOffsetRef.current = value;
    setSwipeOffset(value);
  };

  useEffect(() => {
    setImmersive(true);
    return () => setImmersive(false);
  }, [setImmersive]);

  useEffect(() => {
    try {
      setShowOnboarding(localStorage.getItem(FLASH_ONBOARDING_KEY) !== "true");
    } catch {
      setShowOnboarding(true);
    }
  }, []);

  const onLearnedCountChangeRef = useRef(onLearnedCountChange);

  useEffect(() => {
    onLearnedCountChangeRef.current = onLearnedCountChange;
  }, [onLearnedCountChange]);

  const loadDeck = useCallback(async () => {
    setLoading(true);
    try {
      const [unlearned, learned] = await Promise.all([
        fetchCardsToLearn(studentId, topic.id),
        fetchLearnedQuestions(studentId, topic.id),
      ]);
      const shuffled = shuffleCards(unlearned.cards_to_learn);
      setCards(shuffled);
      const learnedN = learned.count ?? 0;
      const total = learnedN + shuffled.length;
      setLearnedCount(learnedN);
      setTotalCount(total);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [studentId, topic.id]);

  useEffect(() => {
    void loadDeck();
  }, [loadDeck]);

  const dismissOnboarding = () => {
    try {
      localStorage.setItem(FLASH_ONBOARDING_KEY, "true");
    } catch {
      /* ignore */
    }
    setShowOnboarding(false);
  };

  const animateTransition = (direction: "left" | "right") =>
    new Promise<void>((resolve) => {
      setAnimationState(direction === "left" ? "swiping-left" : "swiping-right");
      window.setTimeout(() => {
        setAnimationState("idle");
        resolve();
      }, 320);
    });

  const handleFlip = () => {
    if (animationState !== "idle" || showOnboarding) return;
    if (wasDragging.current) {
      wasDragging.current = false;
      return;
    }
    setAnimationState("flipping");
    setIsFlipped((f) => !f);
    window.setTimeout(() => setAnimationState("idle"), 300);
  };

  const handleSkip = async () => {
    if (animationState !== "idle" || cards.length === 0) return;
    setIsFlipped(false);
    setSwipe(0);
    await animateTransition("left");
    setCurrentIndex((prev) => (prev + 1) % cards.length);
    setIsFlipped(false);
  };

  const handleRemember = async () => {
    if (animationState !== "idle" || cards.length === 0) return;
    const card = cards[currentIndex];
    if (!card) return;

    setIsFlipped(false);
    setSwipe(0);

    try {
      await animateTransition("right");
      await markQuestionLearned({
        student_id: studentId,
        question_id: card.id,
      });

      const nextLearned = learnedCount + 1;
      setLearnedCount(nextLearned);
      onLearnedCountChangeRef.current?.(nextLearned, totalCount);

      setCards((prev) => {
        const next = prev.filter((_, i) => i !== currentIndex);
        if (next.length === 0) {
          return next;
        }
        setCurrentIndex((idx) =>
          idx >= next.length ? 0 : idx,
        );
        return next;
      });
      setIsFlipped(false);
    } catch {
      setAnimationState("idle");
    }
  };

  const finishSwipe = (offset: number) => {
    if (showOnboarding) return;
    if (offset > 100) {
      void handleRemember();
    } else if (offset < -100) {
      void handleSkip();
    } else {
      setSwipe(0);
    }
    window.setTimeout(() => {
      wasDragging.current = false;
    }, 0);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (showOnboarding) return;
    touchStartX.current = e.touches[0].clientX;
    setSwipe(0);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (showOnboarding) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    setSwipe(deltaX);
    if (Math.abs(deltaX) > 5) wasDragging.current = true;
  };

  const onTouchEnd = () => finishSwipe(swipeOffsetRef.current);

  const onMouseDown = (e: React.MouseEvent) => {
    if (showOnboarding) return;
    mouseDragging.current = true;
    mouseStartX.current = e.clientX;
    setSwipe(0);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!mouseDragging.current || showOnboarding) return;
    const deltaX = e.clientX - mouseStartX.current;
    setSwipe(deltaX);
    if (Math.abs(deltaX) > 3) wasDragging.current = true;
  };

  const onMouseUp = () => {
    if (!mouseDragging.current || showOnboarding) return;
    mouseDragging.current = false;
    finishSwipe(swipeOffsetRef.current);
  };

  if (loading) {
    return <LoadingState label="Подготовка карточек…" variant="panel" />;
  }

  if (cards.length === 0) {
    return (
      <div className={styles.flashShell}>
        <button type="button" className={styles.flashBackBtn} onClick={onBack}>
          <ArrowLeft size={16} aria-hidden />
          Назад к теме
        </button>
        <div className={styles.completeBox}>
          <h3>Все карточки изучены</h3>
          <p className={styles.cardMeta}>
            Отличная работа — можно вернуться к списку или выбрать другую
            тренировку.
          </p>
          <Button type="button" onClick={onBack}>
            К теме
          </Button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const nextCard = cards[(currentIndex + 1) % cards.length];
  const total = totalCount || learnedCount + cards.length;
  const progressPercent = total > 0 ? Math.round((learnedCount / total) * 100) : 0;
  const rotation = Math.max(-15, Math.min(15, swipeOffset / 15));
  const rememberOpacity = Math.min(1, Math.max(0, swipeOffset / 140));
  const repeatOpacity = Math.min(1, Math.max(0, -swipeOffset / 140));
  const cardTransform =
    animationState === "idle" && swipeOffset
      ? `translateX(${swipeOffset}px) rotate(${rotation}deg)`
      : undefined;

  return (
    <div className={styles.flashShell}>
      <div className={styles.flashTop}>
        <div className={styles.flashTopNav}>
          <button type="button" className={styles.flashBackBtn} onClick={onBack}>
            <ArrowLeft size={16} aria-hidden />
            Назад
          </button>
          <p className={styles.flashTopicName}>{topic.name}</p>
        </div>

        <div className={styles.flashProgressRow}>
          <div className={styles.flashProgressLabel}>
            <span>
              Выучено <strong>{learnedCount}</strong> из {total}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className={styles.flashProgressTrack}>
            <div
              className={styles.flashProgressFill}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {showOnboarding ? (
        <div className={styles.onboardingOverlay}>
          <div className={styles.onboardingCard}>
            <h3>Режим карточек</h3>
            <ul>
              <li>Нажмите на карточку, чтобы увидеть ответ.</li>
              <li>
                Свайп вправо или кнопка «Знаю» — карточка засчитывается как
                выученная.
              </li>
              <li>
                Свайп влево или «Повторить» — вернётся в конец колоды.
              </li>
            </ul>
            <div className={styles.swipeHints}>
              <span className={styles.swipeHintItem}>
                <RotateCcw size={14} aria-hidden />
                Повторить
              </span>
              <span className={styles.swipeHintItem}>
                Знаю
                <ArrowRight size={14} aria-hidden />
              </span>
            </div>
            <Button type="button" onClick={dismissOnboarding}>
              Начать
            </Button>
          </div>
        </div>
      ) : null}

      <p className={styles.flashHint}>
        {isFlipped ? "Ответ" : "Нажмите на карточку, чтобы перевернуть"}
      </p>

      <div className={styles.cardsWrapper}>
        {animationState === "idle" && nextCard && cards.length > 1 ? (
          <div className={cn(styles.flashcard, styles.flashcardNext)}>
            <div className={styles.flashcardInner}>
              <div className={styles.flashcardFace}>
                <p className={styles.flashcardFaceLabel}>Вопрос</p>
                <p className={styles.flashcardFaceText}>{nextCard.question}</p>
              </div>
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            styles.flashcard,
            styles.flashcardCurrent,
            isFlipped && styles.flashcardFlipped,
            animationState === "swiping-left" && styles.swipeLeft,
            animationState === "swiping-right" && styles.swipeRight,
          )}
          style={{ transform: cardTransform }}
          onClick={handleFlip}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <div className={styles.flashcardInner}>
            <div className={styles.flashcardFace}>
              <p className={styles.flashcardFaceLabel}>Вопрос</p>
              <p className={styles.flashcardFaceText}>{currentCard.question}</p>
              {!isFlipped ? (
                <span className={styles.flashcardTapHint}>
                  Нажмите, чтобы увидеть ответ
                </span>
              ) : null}
            </div>
            <div className={cn(styles.flashcardFace, styles.flashcardBack)}>
              <p className={styles.flashcardFaceLabel}>Ответ</p>
              <p className={styles.flashcardFaceText}>{currentCard.answer}</p>
            </div>
          </div>
          <div
            className={cn(styles.dragBadge, styles.badgeRemember)}
            style={{ opacity: rememberOpacity }}
          >
            Знаю
          </div>
          <div
            className={cn(styles.dragBadge, styles.badgeRepeat)}
            style={{ opacity: repeatOpacity }}
          >
            Повторить
          </div>
        </div>
      </div>

      <div className={styles.flashActionBar}>
        <button
          type="button"
          className={cn(styles.flashActionBtn, styles.flashActionSkip)}
          onClick={() => void handleSkip()}
          disabled={animationState !== "idle"}
        >
          <RotateCcw size={18} aria-hidden />
          Повторить
        </button>
        <button
          type="button"
          className={cn(styles.flashActionBtn, styles.flashActionRemember)}
          onClick={() => void handleRemember()}
          disabled={animationState !== "idle"}
        >
          <Check size={18} strokeWidth={2.5} aria-hidden />
          Знаю
        </button>
      </div>
    </div>
  );
}
