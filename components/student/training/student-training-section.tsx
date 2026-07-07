"use client";

import styles from "@/components/student/training/student-training.module.css";
import { TrainingFlashcards } from "@/components/student/training/training-flashcards";
import { TrainingDirectionsView } from "@/components/student/training/training-sections-view";
import { TrainingSectionDetail } from "@/components/student/training/training-section-detail";
import { TrainingSectionsListView } from "@/components/student/training/training-topics-view";
import { SectionHeroBanner } from "@/components/student/section-hero-banner";
import heroStyles from "@/components/student/section-hero-banner.module.css";
import { useAuth } from "@/contexts/AuthContext";
import { fetchTrainingTree } from "@/lib/training/training-api";
import { STUDENT_SECTION_BANNERS } from "@/lib/student/section-banners";
import type {
  StudyFilter,
  TrainingDirection,
  TrainingSectionNode,
} from "@/lib/training/training-types";
import { calcProgressPercent } from "@/lib/training/training-utils";
import { useCallback, useEffect, useRef, useState } from "react";

type TrainingView = "directions" | "sections" | "detail" | "flashcards";

function updateSectionInDirection(
  directions: TrainingDirection[],
  directionId: number,
  section: TrainingSectionNode,
): TrainingDirection[] {
  return directions.map((direction) => {
    if (direction.id !== directionId) return direction;
    const sections = direction.sections.map((s) =>
      s.kind === section.kind && s.refId === section.refId ? section : s,
    );
    const total_cards = sections.reduce((sum, s) => sum + s.total_cards, 0);
    const learned_cards = sections.reduce((sum, s) => sum + s.learned_cards, 0);
    const answer_changed_cards = sections.reduce(
      (sum, s) => sum + (s.answer_changed_cards ?? 0),
      0,
    );
    return {
      ...direction,
      sections,
      topics: sections,
      total_cards,
      learned_cards,
      answer_changed_cards,
      progress_percent: calcProgressPercent(learned_cards, total_cards),
    };
  });
}

export function StudentTrainingSection() {
  const { user } = useAuth();
  const [view, setView] = useState<TrainingView>("directions");
  const [directions, setDirections] = useState<TrainingDirection[]>([]);
  const [selectedDirection, setSelectedDirection] =
    useState<TrainingDirection | null>(null);
  const [selectedSection, setSelectedSection] =
    useState<TrainingSectionNode | null>(null);
  const [flashBatch, setFlashBatch] = useState(0);
  const [flashStudyMode, setFlashStudyMode] = useState<StudyFilter>("unlearned");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadInFlightRef = useRef(false);

  const applyTree = useCallback((tree: TrainingDirection[]) => {
    setDirections(tree);
    setSelectedDirection((prev) => {
      if (!prev) return prev;
      return tree.find((d) => d.id === prev.id) ?? prev;
    });
    setSelectedSection((prev) => {
      if (!prev) return prev;
      for (const direction of tree) {
        const section = direction.sections.find(
          (s) => s.kind === prev.kind && s.refId === prev.refId,
        );
        if (section) return section;
      }
      return prev;
    });
  }, []);

  const loadTree = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!user?.id) {
        setError("ID ученика не найден");
        setLoading(false);
        return;
      }
      if (loadInFlightRef.current) return;
      loadInFlightRef.current = true;

      if (!options?.silent) setLoading(true);
      setError(null);

      try {
        const tree = await fetchTrainingTree(user.id);
        applyTree(tree);
      } catch (err) {
        setDirections([]);
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        loadInFlightRef.current = false;
        setLoading(false);
      }
    },
    [applyTree, user?.id],
  );

  useEffect(() => {
    if (!user?.id) return;
    void loadTree();
  }, [user?.id, loadTree]);

  const handleSectionProgress = useCallback(
    (section: TrainingSectionNode) => {
      setSelectedSection(section);
      const directionId = selectedDirection?.id;
      if (!directionId) return;
      setDirections((prev) => updateSectionInDirection(prev, directionId, section));
      setSelectedDirection((prev) => {
        if (!prev) return prev;
        return updateSectionInDirection([prev], directionId, section)[0];
      });
    },
    [selectedDirection?.id],
  );

  if (view === "flashcards" && selectedSection && user?.id) {
    return (
      <TrainingFlashcards
        section={selectedSection}
        studentId={user.id}
        batchIndex={flashBatch}
        studyMode={flashStudyMode}
        onBack={() => setView("detail")}
        onLearnedCountChange={(learned, total) => {
          handleSectionProgress({
            ...selectedSection,
            learned_cards: learned,
            total_cards: total,
            progress_percent: calcProgressPercent(learned, total),
          });
        }}
      />
    );
  }

  if (view === "detail" && selectedSection && user?.id) {
    return (
      <TrainingSectionDetail
        section={selectedSection}
        studentId={user.id}
        onBack={() => setView("sections")}
        onStartFlashcards={(batchIndex, studyMode) => {
          setFlashBatch(batchIndex);
          setFlashStudyMode(studyMode);
          setView("flashcards");
        }}
        onProgressChange={handleSectionProgress}
      />
    );
  }

  const breadcrumb =
    view === "sections" && selectedDirection ? (
      <nav className={heroStyles.breadcrumb} aria-label="Навигация">
        <button
          type="button"
          className={heroStyles.breadcrumbLink}
          onClick={() => {
            setSelectedDirection(null);
            setView("directions");
          }}
        >
          Направления
        </button>
        <span className={heroStyles.breadcrumbSep}>/</span>
        <span className={heroStyles.breadcrumbCurrent}>
          {selectedDirection.name}
        </span>
      </nav>
    ) : null;

  return (
    <div className={styles.page}>
      <SectionHeroBanner
        imageSrc={STUDENT_SECTION_BANNERS.train}
        eyebrow="Тренировка"
        title={
          view === "sections" && selectedDirection
            ? selectedDirection.name
            : "Направления"
        }
        subtitle={
          view === "sections"
            ? "Выберите раздел и учите карточки батчами"
            : "Предметы с карточками и тестами для запоминания"
        }
        leading={breadcrumb ?? undefined}
      />

      {view === "directions" ? (
        <TrainingDirectionsView
          directions={directions}
          loading={loading}
          error={error}
          onSelectDirection={(direction) => {
            setSelectedDirection(direction);
            setView("sections");
          }}
        />
      ) : selectedDirection ? (
        <TrainingSectionsListView
          direction={selectedDirection}
          loading={loading}
          error={error}
          onSelectSection={(section) => {
            setSelectedSection(section);
            setView("detail");
          }}
        />
      ) : null}
    </div>
  );
}
