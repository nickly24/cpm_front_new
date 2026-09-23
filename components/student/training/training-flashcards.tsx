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
  SectionStats,
  StudyFilter,
  TrainingCard,
  TrainingSectionNode,
} from "@/lib/training/training-types";
import {
  FLASH_ONBOARDING_KEY,
  shuffleCards,
} from "@/lib/training/training-utils";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api/client";
import { filterStudyCards, trainingError } from "@/lib/training/exam-training";
import { ArrowLeft, Check, RotateCcw } from "lucide-react";
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
  previewCards?: TrainingCard[];
}

export function TrainingFlashcards({
  section,
  studentId,
  batchIndex,
  studyMode,
  onBack,
  previewCards,
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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fatal, setFatal] = useState(false);
  const [summary, setSummary] = useState<SectionStats | null>(null);
  const submitting = useRef(false);

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
    if (previewCards) return;
    setImmersive(true);
    return () => setImmersive(false);
  }, [setImmersive, previewCards]);

  const loadDeck = useCallback(async () => {
    try {
      let deck: TrainingCard[];
      if (previewCards) {
        deck = filterStudyCards(await Promise.resolve(previewCards), studyMode);
      } else if (batchIndex === -1) {
        const view = await fetchSectionStudyView(studentId, sectionKind, sectionRefId);
        deck = filterStudyCards(view.cards, studyMode);
      } else {
        const data = await fetchSectionBatch(
          studentId,
          sectionKind,
          sectionRefId,
          batchIndex,
          studyMode,
        );
        deck = data.cards;
      }
      setError(null);
      setNotice(null);
      setFatal(false);
      setSummary(null);
      try { setShowOnboarding(!previewCards && localStorage.getItem(FLASH_ONBOARDING_KEY) !== "true"); }
      catch { setShowOnboarding(!previewCards); }
      setCards(shuffleCards(deck));
      setLearnedCount(0);
      setTotalCount(deck.length);
      setIsFlipped(false);
    } catch (err) {
      setError(trainingError(err));
      setFatal(err instanceof ApiError && [403, 404, 422].includes(err.status ?? 0));
    } finally {
      setLoading(false);
    }
  }, [batchIndex, sectionKind, sectionRefId, studentId, studyMode, previewCards]);
  const reloadDeck = () => { setLoading(true); void loadDeck(); };

  useEffect(() => {
    // State is updated after the awaited deck read (including preview's resolved promise).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDeck();
  }, [loadDeck]);

  useEffect(() => {
    if (sectionKind !== "exam" || previewCards || loading || cards.length || !learnedCount) return;
    let cancelled = false;
    fetchSectionStudyView(studentId, sectionKind, sectionRefId).then((view) => {
      if (!cancelled) setSummary(view.stats);
    }, (err) => {
      if (!cancelled) { setError(trainingError(err)); setFatal(err instanceof ApiError && [403, 404, 422].includes(err.status ?? 0)); }
    });
    return () => { cancelled = true; };
  }, [cards.length, learnedCount, loading, previewCards, sectionKind, sectionRefId, studentId]);

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
    if (animationState !== "idle" || cards.length === 0 || submitting.current) return;
    const card = cards[0];
    if (!card) return;

    setIsFlipped(false);
    submitting.current = true;
    setNotice(null);

    try {
      await animateTransition("right");
      if (!previewCards) await markCardLearned({
        student_id: studentId,
        section_kind: sectionKind,
        section_ref_id: sectionRefId,
        card_ref: card.card_ref,
        content_fingerprint: card.content_fingerprint,
      });

      const nextLearned = learnedCount + 1;
      setLearnedCount(nextLearned);

      flushSync(() => {
        setAnimationState("idle");
        setSwipe(0);
      });
      setCards((prev) => {
        if (prev.length <= 1) return [];
        return prev.slice(1);
      });
      setIsFlipped(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === "content_changed") {
        const updated = err.details?.card as TrainingCard | undefined;
        if (updated) setCards((prev) => prev.map((item) => item.card_ref === card.card_ref ? updated : item));
        else {
          try {
            const fresh = await fetchSectionStudyView(studentId, sectionKind, sectionRefId);
            const updatedCard = fresh.cards.find((item) => item.card_ref === card.card_ref);
            if (updatedCard) setCards((prev) => prev.map((item) => item.card_ref === card.card_ref ? updatedCard : item));
          } catch (reloadError) { setError(trainingError(reloadError)); setFatal(true); }
        }
        setNotice(trainingError(err));
      } else if (err instanceof ApiError && err.code === "question_not_found") {
        setCards((prev) => prev.filter((item) => item.card_ref !== card.card_ref));
        setTotalCount((prev) => Math.max(0, prev - 1));
        setNotice(trainingError(err));
      } else if (err instanceof ApiError && [403, 404, 422].includes(err.status ?? 0)) {
        setError(trainingError(err));
        setFatal(true);
      } else setNotice("Не удалось сохранить прогресс. Повторите попытку.");
      setAnimationState("idle");
      setSwipe(0);
    } finally {
      submitting.current = false;
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

  if (error) return <div className={styles.flashShell}><p className={styles.alert} role="alert">{error}</p>
    {!fatal ? <Button onClick={reloadDeck}>Повторить загрузку</Button> : null}<Button onClick={onBack}>{sectionKind === "exam" ? "К частям экзамена" : "Назад к разделу"}</Button></div>;

  if (cards.length === 0) {
    return (
      <div className={styles.flashShell}>
        <button type="button" className={styles.flashBackBtn} onClick={onBack}>
          <ArrowLeft size={16} aria-hidden />
          Назад к разделу
        </button>
        <div className={styles.completeBox}>
          <h3>{learnedCount > 0 ? "Занятие завершено" : "Нет карточек в этом режиме"}</h3>
          <p className={styles.cardMeta}>
            {learnedCount > 0 ? `Пройдено ${learnedCount} из ${totalCount}. ${previewCards ? "Прогресс не сохранялся." : "Прогресс сохранён."}` : "Выберите другой набор или режим заучивания."}
          </p>
          {notice ? <p role="status">{notice}</p> : null}
          {summary ? <p>Прогресс области: {summary.learned} из {summary.total} выучено · {summary.total ? Math.round(summary.learned * 100 / summary.total) : 0}%</p> : null}
          <Button type="button" onClick={onBack}>
            К разделу
          </Button>
          {learnedCount > 0 ? <Button onClick={reloadDeck}>Повторить выбранную область</Button> : null}
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
              Пройдено <strong>{learnedCount}</strong> из {total}
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

      {previewCards ? <p className={styles.examNotice}>Предпросмотр: прогресс не сохраняется</p> : null}
      {notice ? <p className={styles.alert} role="status">{notice}</p> : null}

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
        {currentCard.part_code ? `Часть ${currentCard.part_code} · ` : ""}
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
