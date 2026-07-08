"use client";

import styles from "@/components/student/training/student-training.module.css";
import { TrainingFlashcards } from "@/components/student/training/training-flashcards";
import { TrainingSectionDetail } from "@/components/student/training/training-section-detail";
import { TrainingSectionsListView } from "@/components/student/training/training-topics-view";
import { SectionHeroBanner } from "@/components/student/section-hero-banner";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/lib/auth/types";
import { fetchTrainingTree } from "@/lib/training/training-api";
import {
  parseTrainingPath,
  trainingBasePath,
  trainingDirectionPath,
  trainingSectionPath,
  trainingStudyPath,
} from "@/lib/training/training-routes";
import { STUDENT_SECTION_BANNERS } from "@/lib/student/section-banners";
import type {
  StudyFilter,
  TrainingDirection,
  TrainingSectionNode,
} from "@/lib/training/training-types";
import { calcProgressPercent } from "@/lib/training/training-utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TrainingView = "sections" | "detail" | "flashcards";

interface StudentTrainingSectionProps {
  role: UserRole;
  pathSegments: string[];
}

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

function sectionIdentityEqual(
  a: TrainingSectionNode | null,
  b: TrainingSectionNode | null,
): boolean {
  if (!a || !b) return a === b;
  return a.kind === b.kind && a.refId === b.refId;
}

export function StudentTrainingSection({
  role,
  pathSegments,
}: StudentTrainingSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const pathSegmentsKey = pathSegments.join("/");
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
  const [treeReady, setTreeReady] = useState(false);
  const loadInFlightRef = useRef(false);
  const invalidPathHandledRef = useRef<string | null>(null);
  const directionsRef = useRef<TrainingDirection[]>([]);

  const pathSearchParams = useMemo(
    () => new URLSearchParams(searchParamsString),
    [searchParamsString],
  );

  directionsRef.current = directions;

  const applyTree = useCallback((tree: TrainingDirection[]) => {
    directionsRef.current = tree;
    setDirections(tree);
    setTreeReady(tree.length > 0);
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

  const loadTree = useCallback(async () => {
    if (!user?.id) {
      setError("ID ученика не найден");
      setLoading(false);
      return;
    }
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const tree = await fetchTrainingTree(user.id);
      applyTree(tree);
    } catch (err) {
      directionsRef.current = [];
      setDirections([]);
      setTreeReady(false);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      loadInFlightRef.current = false;
      setLoading(false);
    }
  }, [applyTree, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    void loadTree();
  }, [user?.id, loadTree]);

  useEffect(() => {
    if (!treeReady || directionsRef.current.length === 0) return;

    const parsed = parseTrainingPath(
      pathSegments,
      directionsRef.current,
      pathSearchParams,
    );
    const pathKey = `${pathSegmentsKey}?${searchParamsString}`;

    if (!parsed.isValid) {
      if (invalidPathHandledRef.current !== pathKey) {
        invalidPathHandledRef.current = pathKey;
        if (pathSegments.length >= 2 && parsed.direction) {
          router.replace(trainingDirectionPath(role, parsed.direction));
        } else {
          router.replace(trainingBasePath(role));
        }
      }
      return;
    }

    invalidPathHandledRef.current = null;

    setView((prev) => (prev === parsed.view ? prev : parsed.view));
    setFlashBatch((prev) => (prev === parsed.batch ? prev : parsed.batch));
    setFlashStudyMode((prev) =>
      prev === parsed.studyMode ? prev : parsed.studyMode,
    );
    setSelectedDirection((prev) => {
      const next = parsed.direction;
      if (!next) return null;
      if (prev?.id === next.id) return prev;
      return next;
    });
    setSelectedSection((prev) => {
      const next = parsed.section;
      if (!next) return null;
      if (sectionIdentityEqual(prev, next)) return prev;
      return next;
    });
  }, [
    pathSegments,
    pathSegmentsKey,
    pathSearchParams,
    role,
    router,
    searchParamsString,
    treeReady,
  ]);

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
        const next = updateSectionInDirection(prev, directionId, section);
        directionsRef.current = next;
        return next;
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

  const navigateToCatalog = useCallback(
    (direction?: TrainingDirection | null) => {
      if (!direction) {
        router.push(trainingBasePath(role));
        return;
      }
      router.push(trainingDirectionPath(role, direction));
    },
    [role, router],
  );

  const navigateToSection = useCallback(
    (direction: TrainingDirection, section: TrainingSectionNode) => {
      router.push(trainingSectionPath(role, direction, section));
    },
    [role, router],
  );

  const navigateToStudy = useCallback(
    (
      direction: TrainingDirection,
      section: TrainingSectionNode,
      batchIndex: number,
      studyMode: StudyFilter,
    ) => {
      router.push(
        trainingStudyPath(role, direction, section, {
          batch: batchIndex,
          mode: studyMode,
        }),
      );
    },
    [role, router],
  );

  const sectionDetailKey =
    selectedSection != null
      ? `${selectedSection.kind}:${selectedSection.refId}`
      : "none";

  if (view === "flashcards" && selectedSection && selectedDirection && user?.id) {
    return (
      <TrainingFlashcards
        key={sectionDetailKey}
        section={selectedSection}
        studentId={user.id}
        batchIndex={flashBatch}
        studyMode={flashStudyMode}
        onBack={() => navigateToSection(selectedDirection, selectedSection)}
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

  if (view === "detail" && selectedSection && selectedDirection && user?.id) {
    return (
      <TrainingSectionDetail
        key={sectionDetailKey}
        section={selectedSection}
        studentId={user.id}
        onBack={() => navigateToCatalog(selectedDirection)}
        onStartFlashcards={(batchIndex, studyMode) => {
          navigateToStudy(
            selectedDirection,
            selectedSection,
            batchIndex,
            studyMode,
          );
        }}
        onProgressChange={handleSectionProgress}
      />
    );
  }

  return (
    <div className={styles.page}>
      <SectionHeroBanner
        imageSrc={STUDENT_SECTION_BANNERS.train}
        eyebrow="Обучение"
        title="Карточки"
        subtitle="Выберите направление и раздел, учите карточки батчами"
      />

      {selectedDirection && user?.id ? (
        <TrainingSectionsListView
          directions={directions}
          direction={selectedDirection}
          selectedDirectionId={selectedDirection.id}
          onSelectDirection={(directionId) => {
            const next = directions.find((item) => item.id === directionId);
            if (!next) return;
            navigateToCatalog(next);
          }}
          studentId={user.id}
          loading={loading}
          error={error}
          onSelectSection={(section) => {
            navigateToSection(selectedDirection, section);
          }}
        />
      ) : null}
    </div>
  );
}
