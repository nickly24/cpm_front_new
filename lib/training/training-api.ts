import { apiRequest } from "@/lib/api/client";
import { calcProgressPercent } from "./training-utils";
import type {
  MarkCardLearnedPayload,
  MarkCardLearnedResponse,
  SectionBatchResponse,
  SectionKind,
  SectionStudyViewResponse,
  StudyFilter,
  StudySettingsPayload,
  StudySettingsResponse,
  TrainingDirection,
  TrainingSectionNode,
  TrainingTreeResponse,
} from "./training-types";

function normalizeSectionNode(raw: TrainingSectionNode): TrainingSectionNode {
  const stats = raw.stats ?? {
    total: raw.total_cards ?? 0,
    learned: raw.learned_cards ?? 0,
    answer_changed: raw.answer_changed_cards ?? 0,
    unlearned: Math.max(
      0,
      (raw.total_cards ?? 0) -
        (raw.learned_cards ?? 0) -
        (raw.answer_changed_cards ?? 0),
    ),
  };
  return {
    ...raw,
    stats: {
      ...stats,
      progress_percent:
        stats.progress_percent ??
        calcProgressPercent(stats.learned, stats.total),
    },
    total_cards: raw.total_cards ?? stats.total,
    learned_cards: raw.learned_cards ?? stats.learned,
    answer_changed_cards: raw.answer_changed_cards ?? stats.answer_changed,
    progress_percent:
      raw.progress_percent ??
      calcProgressPercent(stats.learned, stats.total),
  };
}

export function normalizeTrainingDirections(
  directions: TrainingDirection[],
): TrainingDirection[] {
  return directions.map((direction) => {
    const sections = (direction.sections ?? direction.topics ?? []).map(
      normalizeSectionNode,
    );
    const total_cards = sections.reduce((s, t) => s + t.total_cards, 0);
    const learned_cards = sections.reduce((s, t) => s + t.learned_cards, 0);
    const answer_changed_cards = sections.reduce(
      (s, t) => s + (t.answer_changed_cards ?? 0),
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

export async function fetchTrainingTree(
  studentId: number,
): Promise<TrainingDirection[]> {
  const data = await apiRequest<TrainingTreeResponse>(
    `/get-training-tree/${studentId}`,
  );
  if (!data.success) {
    throw new Error("Не удалось загрузить тренировки");
  }
  const directions = data.directions ?? data.sections ?? [];
  return normalizeTrainingDirections(directions);
}

export async function fetchSectionStudyView(
  studentId: number,
  sectionKind: SectionKind,
  sectionRefId: string,
): Promise<SectionStudyViewResponse> {
  const data = await apiRequest<SectionStudyViewResponse>(
    `/section-study/${studentId}/${sectionKind}/${encodeURIComponent(sectionRefId)}`,
  );
  if (!data.success) {
    throw new Error("Не удалось загрузить раздел");
  }
  return data;
}

export async function fetchSectionBatch(
  studentId: number,
  sectionKind: SectionKind,
  sectionRefId: string,
  batchIndex: number,
  studyMode?: StudyFilter,
): Promise<SectionBatchResponse> {
  const query = studyMode ? `?study_mode=${encodeURIComponent(studyMode)}` : "";
  const data = await apiRequest<SectionBatchResponse>(
    `/section-batch/${studentId}/${sectionKind}/${encodeURIComponent(sectionRefId)}/${batchIndex}${query}`,
  );
  if (!data.success) {
    throw new Error("Не удалось загрузить батч");
  }
  return data;
}

export async function updateSectionStudySettings(
  studentId: number,
  sectionKind: SectionKind,
  sectionRefId: string,
  payload: StudySettingsPayload,
): Promise<StudySettingsResponse> {
  return apiRequest<StudySettingsResponse>(
    `/section-study-settings/${studentId}/${sectionKind}/${encodeURIComponent(sectionRefId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export async function markCardLearned(
  payload: MarkCardLearnedPayload,
): Promise<MarkCardLearnedResponse> {
  return apiRequest<MarkCardLearnedResponse>("/mark-card-learned", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function unmarkCardLearned(
  studentId: number,
  cardRef: string,
): Promise<MarkCardLearnedResponse> {
  return apiRequest<MarkCardLearnedResponse>(
    `/mark-card-learned/${studentId}/${encodeURIComponent(cardRef)}`,
    { method: "DELETE" },
  );
}
