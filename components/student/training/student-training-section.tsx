"use client";

import styles from "@/components/student/training/student-training.module.css";
import { TrainingFlashcards } from "@/components/student/training/training-flashcards";
import { TrainingSectionsView } from "@/components/student/training/training-sections-view";
import { TrainingTopicDetail } from "@/components/student/training/training-topic-detail";
import { TrainingTopicsView } from "@/components/student/training/training-topics-view";
import { SectionHeroBanner } from "@/components/student/section-hero-banner";
import heroStyles from "@/components/student/section-hero-banner.module.css";
import { useAuth } from "@/contexts/AuthContext";
import { fetchTrainingTree } from "@/lib/training/training-api";
import { STUDENT_SECTION_BANNERS } from "@/lib/student/section-banners";
import type {
  TrainingSection,
  TrainingTopic,
} from "@/lib/training/training-types";
import { useCallback, useEffect, useRef, useState } from "react";

type TrainingView = "sections" | "topics" | "detail" | "flashcards";

function updateTopicInSection(
  sections: TrainingSection[],
  sectionId: number,
  topic: TrainingTopic,
): TrainingSection[] {
  return sections.map((section) => {
    if (section.id !== sectionId) return section;
    const topics = section.topics.map((t) =>
      t.id === topic.id ? topic : t,
    );
    const total_cards = topics.reduce((s, t) => s + t.total_cards, 0);
    const learned_cards = topics.reduce((s, t) => s + t.learned_cards, 0);
    const progress_percent =
      total_cards > 0
        ? Math.round((learned_cards / total_cards) * 100)
        : 0;
    return {
      ...section,
      topics,
      total_cards,
      learned_cards,
      progress_percent,
    };
  });
}

export function StudentTrainingSection() {
  const { user } = useAuth();
  const [view, setView] = useState<TrainingView>("sections");
  const [sections, setSections] = useState<TrainingSection[]>([]);
  const [selectedSection, setSelectedSection] =
    useState<TrainingSection | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TrainingTopic | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadInFlightRef = useRef(false);

  const applyTree = useCallback((tree: TrainingSection[]) => {
    setSections(tree);
    setSelectedSection((prev) => {
      if (!prev) return prev;
      return tree.find((s) => s.id === prev.id) ?? prev;
    });
    setSelectedTopic((prev) => {
      if (!prev) return prev;
      for (const section of tree) {
        const top = section.topics.find((t) => t.id === prev.id);
        if (top) return top;
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

      if (!options?.silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const tree = await fetchTrainingTree(user.id);
        applyTree(tree);
      } catch (err) {
        setSections([]);
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

  const handleTopicProgress = useCallback(
    (topic: TrainingTopic) => {
      setSelectedTopic(topic);
      setSections((prev) => {
        const sectionId = topic.section_id || selectedSection?.id;
        if (!sectionId) return prev;
        return updateTopicInSection(prev, sectionId, topic);
      });
      setSelectedSection((prev) => {
        if (!prev) return prev;
        const sectionId = topic.section_id || prev.id;
        return updateTopicInSection([prev], sectionId, topic)[0];
      });
    },
    [selectedSection?.id],
  );

  const handleLearnedCountChange = useCallback(
    (learned: number, total: number) => {
      if (!selectedTopic) return;
      handleTopicProgress({
        ...selectedTopic,
        learned_cards: learned,
        total_cards: total,
        progress_percent:
          total > 0 ? Math.round((learned / total) * 100) : 0,
      });
    },
    [handleTopicProgress, selectedTopic],
  );

  const handleSectionSelect = (section: TrainingSection) => {
    setSelectedSection(section);
    setView("topics");
  };

  const handleTopicSelect = (topic: TrainingTopic) => {
    setSelectedTopic(topic);
    setView("detail");
  };

  const goToSections = () => {
    setSelectedSection(null);
    setSelectedTopic(null);
    setView("sections");
  };

  const goToTopics = () => {
    setSelectedTopic(null);
    setView("topics");
  };

  if (view === "flashcards" && selectedTopic && user?.id) {
    return (
      <TrainingFlashcards
        topic={selectedTopic}
        studentId={user.id}
        onBack={() => setView("detail")}
        onLearnedCountChange={handleLearnedCountChange}
      />
    );
  }

  if (view === "detail" && selectedTopic && user?.id) {
    return (
      <TrainingTopicDetail
        topic={selectedTopic}
        studentId={user.id}
        onBack={goToTopics}
        onStartFlashcards={() => setView("flashcards")}
        onProgressChange={handleTopicProgress}
      />
    );
  }

  const breadcrumb =
    view === "topics" && selectedSection ? (
      <nav className={heroStyles.breadcrumb} aria-label="Навигация">
        <button
          type="button"
          className={heroStyles.breadcrumbLink}
          onClick={goToSections}
        >
          Темы
        </button>
        <span className={heroStyles.breadcrumbSep}>/</span>
        <span className={heroStyles.breadcrumbCurrent}>
          {selectedSection.name}
        </span>
      </nav>
    ) : null;

  return (
    <div className={styles.page}>
      <SectionHeroBanner
        imageSrc={STUDENT_SECTION_BANNERS.train}
        eyebrow="Тренировка"
        title={
          view === "topics" && selectedSection
            ? selectedSection.name
            : "Темы"
        }
        subtitle={
          view === "topics"
            ? "Выберите тренировку и повторяйте карточки"
            : "Разделы с карточками для запоминания материала"
        }
        leading={breadcrumb ?? undefined}
      />

      {view === "sections" ? (
        <TrainingSectionsView
          sections={sections}
          loading={loading}
          error={error}
          onSelectSection={handleSectionSelect}
        />
      ) : selectedSection ? (
        <TrainingTopicsView
          section={selectedSection}
          loading={loading}
          error={error}
          onSelectTopic={handleTopicSelect}
        />
      ) : null}
    </div>
  );
}
