"use client";

import styles from "@/components/student/training/student-training.module.css";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { useCabinetChrome } from "@/contexts/cabinet-chrome-context";
import {
  fetchSectionStudyView,
  fetchSectionBatch,
  markCardLearned,
} from "@/lib/training/training-api";
import type {
  SectionKind,
  StudyFilter,
  TrainingCard,
  TrainingSectionNode,
} from "@/lib/training/training-types";
import {
  FLASH_ONBOARDING_KEY,
  shuffleCards,
} from "@/lib/training/training-utils";
import { cn } from "@/lib/cn";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

type AnimationState =
  | "idle"
  | "flipping"
  | "swiping-left"
  | "swiping-right";

interface TrainingFlashcardsProps {
  section: TrainingSectionNode;
  studentId: number;
  batchIndex: number;
  studyMode: StudyFilter;
  onBack: () => void;
  onLearnedCountChange?: (learned: number, total: number) => void;
}

export function TrainingFlashcards({
  section,
  studentId,
  batchIndex,
  studyMode,
  onBack,
  onLearnedCountChange,
}: TrainingFlashcardsProps) {
  const { setImmersive } = useCabinetChrome();
  const sectionKind = section.kind as SectionKind;
  const sectionRefId = section.refId;

  const [cards, setCards] = useState<TrainingCard[]>([]);
  const [learnedCount, setLearnedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
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
  const onLearnedCountChangeRef = useRef(onLearnedCountChange);

  useEffect(() => {
    onLearnedCountChangeRef.current = onLearnedCountChange;
  }, [onLearnedCountChange]);

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

  const loadDeck = useCallback(async () => {
    setLoading(true);
    try {
      const cardsByMode = (source: TrainingCard[]) => {
        if (studyMode === "all") return source;
        if (studyMode === "learned") {
          return source.filter((card) => card.status === "learned");
        }
        if (studyMode === "stale") {
          return source.filter((card) => card.status === "answer_changed");
        }
        return source.filter((card) => card.status === "unlearned");
      };

      let nextLearned = 0;
      let nextTotal = 0;
      if (batchIndex === -1) {
        const view = await fetchSectionStudyView(studentId, sectionKind, sectionRefId);
        const filtered = cardsByMode(view.cards);
        const shuffled = shuffleCards(filtered);
        setCards(shuffled);
        nextLearned = filtered.filter((card) => card.status === "learned").length;
        nextTotal = filtered.length;
        setLearnedCount(nextLearned);
        setTotalCount(nextTotal);
      } else {
        const data = await fetchSectionBatch(
          studentId,
          sectionKind,
          sectionRefId,
          batchIndex,
          studyMode,
        );
        const shuffled = shuffleCards(data.cards);
        setCards(shuffled);
        const batchStats = data.batch.stats;
        nextLearned = batchStats.learned;
        nextTotal = batchStats.total;
        setLearnedCount(nextLearned);
        setTotalCount(nextTotal);
      }
      setIsFlipped(false);
      onLearnedCountChangeRef.current?.(nextLearned, nextTotal);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [batchIndex, sectionKind, sectionRefId, studentId, studyMode]);

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
      const targetOffset =
        direction === "left"
          ? -Math.max(window.innerWidth, 600)
          : Math.max(window.innerWidth, 600);
      requestAnimationFrame(() => {
        setSwipe(targetOffset);
      });
      window.setTimeout(resolve, 320);
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
    await animateTransition("left");
    flushSync(() => {
      setAnimationState("idle");
      setSwipe(0);
    });
    setCards((prev) => {
      if (prev.length <= 1) return prev;
      const [first, ...rest] = prev;
      return [...rest, first];
    });
    setIsFlipped(false);
  };

  const handleRemember = async () => {
    if (animationState !== "idle" || cards.length === 0) return;
    const card = cards[0];
    if (!card) return;

    setIsFlipped(false);

    try {
      await animateTransition("right");
      await markCardLearned({
        student_id: studentId,
        section_kind: sectionKind,
        section_ref_id: sectionRefId,
        card_ref: card.card_ref,
        content_fingerprint: card.content_fingerprint,
      });

      const nextLearned = learnedCount + 1;
      setLearnedCount(nextLearned);
      onLearnedCountChangeRef.current?.(nextLearned, totalCount);

      flushSync(() => {
        setAnimationState("idle");
        setSwipe(0);
      });
      setCards((prev) => {
        if (prev.length <= 1) return [];
        return prev.slice(1);
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
          Назад к разделу
        </button>
        <div className={styles.completeBox}>
          <h3>Нет карточек в этом режиме</h3>
          <p className={styles.cardMeta}>
            Выберите другой батч или режим заучивания.
          </p>
          <Button type="button" onClick={onBack}>
            К разделу
          </Button>
        </div>
      </div>
    );
  }

  const currentCard = cards[0];
  const nextCard = cards[1];
  const total = totalCount || learnedCount + cards.length;
  const progressPercent =
    total > 0 ? Math.round((learnedCount / total) * 100) : 0;
  const rotation = Math.max(-15, Math.min(15, swipeOffset / 15));
  const rememberOpacity = Math.min(1, Math.max(0, swipeOffset / 140));
  const repeatOpacity = Math.min(1, Math.max(0, -swipeOffset / 140));
  const cardTransform = `translateX(${swipeOffset}px) rotate(${rotation}deg)`;

  return (
    <div className={styles.flashShell}>
      <div className={styles.flashTop}>
        <div className={styles.flashTopNav}>
          <button type="button" className={styles.flashBackBtn} onClick={onBack}>
            <ArrowLeft size={16} aria-hidden />
            Назад
          </button>
          <p className={styles.flashTopicName}>{section.name}</p>
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
              <li>Свайп вправо или «Знаю» — карточка засчитывается.</li>
              <li>Свайп влево или «Повторить» — карточка остаётся в колоде.</li>
            </ul>
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
        {nextCard && cards.length > 1 ? (
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
          key={currentCard.card_ref}
          className={cn(
            styles.flashcard,
            styles.flashcardCurrent,
            animationState !== "idle" && styles.flashcardAnimatingOut,
            isFlipped && styles.flashcardFlipped,
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
