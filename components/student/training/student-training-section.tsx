"use client";

import styles from "@/components/student/training/student-training.module.css";
import { TrainingFlashcards } from "@/components/student/training/training-flashcards";
import { TrainingSectionDetail } from "@/components/student/training/training-section-detail";
import { TrainingSectionsListView } from "@/components/student/training/training-topics-view";
import { SectionHeroBanner } from "@/components/student/section-hero-banner";
import heroStyles from "@/components/student/section-hero-banner.module.css";
import { useAuth } from "@/contexts/AuthContext";
import { fetchTrainingTree } from "@/lib/training/training-api";
import { STUDENT_SECTION_BANNERS } from "@/lib/student/section-banners";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  StudyFilter,
  TrainingDirection,
  TrainingSectionNode,
} from "@/lib/training/training-types";
import { calcProgressPercent } from "@/lib/training/training-utils";
import { useCallback, useEffect, useRef, useState } from "react";

type TrainingView = "sections" | "detail" | "flashcards";

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

function sectionProgressEqual(
  a: TrainingSectionNode,
  b: TrainingSectionNode,
): boolean {
  return (
    a.kind === b.kind &&
    a.refId === b.refId &&
    a.total_cards === b.total_cards &&
    a.learned_cards === b.learned_cards &&
    a.answer_changed_cards === b.answer_changed_cards &&
    a.progress_percent === b.progress_percent
  );
}

export function StudentTrainingSection() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [view, setView] = useState<TrainingView>("sections");
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
  const restoredFromUrlRef = useRef(false);

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

        if (!restoredFromUrlRef.current) {
          const urlView = searchParams.get("view") as TrainingView | null;
          const directionId = Number(searchParams.get("direction"));
          const sectionKind = searchParams.get("sectionKind");
          const sectionRef = searchParams.get("sectionRef");
          const batchIndexRaw = searchParams.get("batch");
          const studyModeRaw = searchParams.get("mode") as StudyFilter | null;

          const direction = Number.isFinite(directionId)
            ? tree.find((item) => item.id === directionId) ?? null
            : null;

          if (direction) {
            setSelectedDirection(direction);
          }

          if (direction && sectionKind && sectionRef) {
            const section =
              direction.sections.find(
                (item) => item.kind === sectionKind && item.refId === sectionRef,
              ) ?? null;
            if (section) {
              setSelectedSection(section);

              if (urlView === "flashcards") {
                const parsedBatch = Number(batchIndexRaw ?? "0");
                setFlashBatch(Number.isFinite(parsedBatch) ? parsedBatch : 0);
                setFlashStudyMode(studyModeRaw ?? "unlearned");
                setView("flashcards");
              } else if (urlView === "detail") {
                setView("detail");
              } else {
                setView("sections");
              }
            } else {
              setView("sections");
            }
          } else if (direction && urlView === "sections") {
            setView("sections");
          } else {
            setView("sections");
          }

          restoredFromUrlRef.current = true;
        }
      } catch (err) {
        setDirections([]);
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        loadInFlightRef.current = false;
        setLoading(false);
      }
    },
    [applyTree, searchParams, user?.id],
  );

  useEffect(() => {
    if (!user?.id) return;
    void loadTree();
  }, [user?.id, loadTree]);

  const handleSectionProgress = useCallback(
    (section: TrainingSectionNode) => {
      setSelectedSection((prev) => {
        if (prev && sectionProgressEqual(prev, section)) return prev;
        return section;
      });
      const directionId = selectedDirection?.id;
      if (!directionId) return;
      setDirections((prev) => {
        const direction = prev.find((d) => d.id === directionId);
        const prevSection = direction?.sections.find(
          (s) => s.kind === section.kind && s.refId === section.refId,
        );
        if (prevSection && sectionProgressEqual(prevSection, section)) return prev;
        return updateSectionInDirection(prev, directionId, section);
      });
      setSelectedDirection((prev) => {
        if (!prev) return prev;
        const prevSection = prev.sections.find(
          (s) => s.kind === section.kind && s.refId === section.refId,
        );
        if (prevSection && sectionProgressEqual(prevSection, section)) return prev;
        return updateSectionInDirection([prev], directionId, section)[0];
      });
    },
    [selectedDirection?.id],
  );

  useEffect(() => {
    if (!restoredFromUrlRef.current) return;

    const params = new URLSearchParams();
    if (view === "sections" && selectedDirection) {
      params.set("view", "sections");
      params.set("direction", String(selectedDirection.id));
    } else if (view === "detail" && selectedDirection && selectedSection) {
      params.set("view", "detail");
      params.set("direction", String(selectedDirection.id));
      params.set("sectionKind", selectedSection.kind);
      params.set("sectionRef", selectedSection.refId);
    } else if (view === "flashcards" && selectedDirection && selectedSection) {
      params.set("view", "flashcards");
      params.set("direction", String(selectedDirection.id));
      params.set("sectionKind", selectedSection.kind);
      params.set("sectionRef", selectedSection.refId);
      params.set("batch", String(flashBatch));
      params.set("mode", flashStudyMode);
    }

    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) return;

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [
    flashBatch,
    flashStudyMode,
    pathname,
    router,
    searchParams,
    selectedDirection,
    selectedSection,
    view,
  ]);

  useEffect(() => {
    if (selectedDirection || directions.length === 0) return;
    setSelectedDirection(directions[0]);
  }, [directions, selectedDirection]);

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
        <span className={heroStyles.breadcrumbCurrent}>{selectedDirection.name}</span>
      </nav>
    ) : null;

  return (
    <div className={styles.page}>
      <SectionHeroBanner
        imageSrc={STUDENT_SECTION_BANNERS.train}
        eyebrow="Карточки"
        title={
          view === "sections" && selectedDirection ? selectedDirection.name : "Карточки"
        }
        subtitle={
          view === "sections"
            ? "Выберите раздел и учите карточки батчами"
            : "Разделы с карточками для заучивания"
        }
        leading={breadcrumb ?? undefined}
      />

      {selectedDirection ? (
        <TrainingSectionsListView
          directions={directions}
          direction={selectedDirection}
          selectedDirectionId={selectedDirection.id}
          onSelectDirection={(directionId) => {
            const next = directions.find((item) => item.id === directionId);
            if (!next) return;
            setSelectedDirection(next);
            setSelectedSection(null);
            setView("sections");
          }}
          studentId={user.id}
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
