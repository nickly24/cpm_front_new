import type { UserRole } from "@/lib/auth/types";
import type { StudyFilter, TrainingDirection, TrainingSectionNode } from "./training-types";

export function encodeTrainingSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

export function decodeTrainingSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function trainingBasePath(role: UserRole): string {
  return `/cabinet/${role}/train`;
}

export function trainingDirectionPath(
  role: UserRole,
  direction: Pick<TrainingDirection, "name">,
): string {
  return `${trainingBasePath(role)}/${encodeTrainingSegment(direction.name)}`;
}

export function trainingSectionPath(
  role: UserRole,
  direction: Pick<TrainingDirection, "name">,
  section: Pick<TrainingSectionNode, "name">,
): string {
  return `${trainingDirectionPath(role, direction)}/${encodeTrainingSegment(section.name)}`;
}

export function trainingStudyPath(
  role: UserRole,
  direction: Pick<TrainingDirection, "name">,
  section: Pick<TrainingSectionNode, "name">,
  options?: { batch?: number; mode?: StudyFilter },
): string {
  const path = `${trainingSectionPath(role, direction, section)}/study`;
  if (!options) return path;

  const params = new URLSearchParams();
  if (options.batch != null) params.set("batch", String(options.batch));
  if (options.mode) params.set("mode", options.mode);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function segmentMatchesName(segment: string, name: string): boolean {
  return decodeTrainingSegment(segment) === name.trim();
}

export function findTrainingDirection(
  directions: TrainingDirection[],
  segment: string,
): TrainingDirection | null {
  return directions.find((item) => segmentMatchesName(segment, item.name)) ?? null;
}

export function findTrainingSection(
  direction: TrainingDirection,
  segment: string,
): TrainingSectionNode | null {
  const sections = direction.sections ?? direction.topics ?? [];
  return sections.find((item) => segmentMatchesName(segment, item.name)) ?? null;
}

export type TrainingPathView = "sections" | "detail" | "flashcards";

export interface ParsedTrainingPath {
  view: TrainingPathView;
  direction: TrainingDirection | null;
  section: TrainingSectionNode | null;
  batch: number;
  studyMode: StudyFilter;
  isValid: boolean;
}

export function parseTrainingPath(
  segments: string[],
  directions: TrainingDirection[],
  searchParams: Pick<URLSearchParams, "get">,
): ParsedTrainingPath {
  const emptyState: ParsedTrainingPath = {
    view: "sections",
    direction: directions[0] ?? null,
    section: null,
    batch: 0,
    studyMode: "unlearned",
    isValid: true,
  };

  if (segments.length === 0) {
    return emptyState;
  }

  const direction = findTrainingDirection(directions, segments[0]);
  if (!direction) {
    return { ...emptyState, direction: directions[0] ?? null, isValid: false };
  }

  if (segments.length === 1) {
    return {
      view: "sections",
      direction,
      section: null,
      batch: 0,
      studyMode: "unlearned",
      isValid: true,
    };
  }

  const section = findTrainingSection(direction, segments[1]);
  if (!section) {
    return {
      view: "sections",
      direction,
      section: null,
      batch: 0,
      studyMode: "unlearned",
      isValid: false,
    };
  }

  if (segments[2] === "study") {
    const batchRaw = Number(searchParams.get("batch") ?? "0");
    const modeRaw = searchParams.get("mode") as StudyFilter | null;
    return {
      view: "flashcards",
      direction,
      section,
      batch: Number.isFinite(batchRaw) ? batchRaw : 0,
      studyMode: modeRaw ?? "unlearned",
      isValid: segments.length === 3,
    };
  }

  if (segments.length > 2) {
    return {
      view: "detail",
      direction,
      section,
      batch: 0,
      studyMode: "unlearned",
      isValid: false,
    };
  }

  return {
    view: "detail",
    direction,
    section,
    batch: 0,
    studyMode: "unlearned",
    isValid: true,
  };
}
