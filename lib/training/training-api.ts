import { ApiError, apiRequest } from "@/lib/api/client";
import { calcProgressPercent } from "./training-utils";
import type {
  AddLearnedPayload,
  AddLearnedResponse,
  AllCardsByThemeResponse,
  CardsToLearnResponse,
  LearnedQuestionsResponse,
  RemoveLearnedResponse,
  ThemesApiPayload,
  TrainingSection,
  TrainingSectionMeta,
  TrainingThemeRow,
  TrainingTopic,
  TrainingTreeResponse,
  TrainingSectionsResponse,
} from "./training-types";

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

function parseThemesPayload(data: ThemesApiPayload): TrainingThemeRow[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.themes)) {
    return data.themes;
  }
  return [];
}

async function enrichTopic(
  studentId: number,
  theme: TrainingThemeRow,
): Promise<TrainingTopic> {
  const stats = await fetchAllCardsByTheme(studentId, theme.id);
  return {
    id: theme.id,
    name: theme.name,
    section_id: theme.section_id ?? 0,
    total_cards: stats.total_cards,
    learned_cards: stats.learned_cards,
    progress_percent: calcProgressPercent(
      stats.learned_cards,
      stats.total_cards,
    ),
  };
}

function aggregateSection(
  meta: TrainingSectionMeta,
  topics: TrainingTopic[],
): TrainingSection {
  const total_cards = topics.reduce((sum, t) => sum + t.total_cards, 0);
  const learned_cards = topics.reduce((sum, t) => sum + t.learned_cards, 0);
  return {
    id: meta.id,
    name: meta.name,
    sort_order: meta.sort_order,
    topics,
    total_cards,
    learned_cards,
    progress_percent: calcProgressPercent(learned_cards, total_cards),
  };
}

function normalizeTopic(raw: TrainingTopic): TrainingTopic {
  const total = Number(raw.total_cards) || 0;
  const learned = Number(raw.learned_cards) || 0;
  return {
    id: raw.id,
    name: raw.name,
    section_id: Number(raw.section_id) || 0,
    total_cards: total,
    learned_cards: learned,
    progress_percent:
      typeof raw.progress_percent === "number"
        ? raw.progress_percent
        : calcProgressPercent(learned, total),
  };
}

/** Дополняет агрегаты раздела, если бэкенд отдал только topics. */
export function normalizeTrainingSections(
  sections: TrainingSection[],
): TrainingSection[] {
  return sections.map((section) => {
    const topics = (Array.isArray(section.topics) ? section.topics : []).map(
      normalizeTopic,
    );
    const hasAggregates =
      typeof section.total_cards === "number" &&
      typeof section.learned_cards === "number" &&
      typeof section.progress_percent === "number";
    if (hasAggregates) {
      return { ...section, topics };
    }
    return aggregateSection(
      {
        id: section.id,
        name: section.name,
        sort_order: section.sort_order ?? 0,
      },
      topics,
    );
  });
}

/**
 * Предпочтительный источник: GET /get-training-tree/:studentId
 * Если эндпоинт ещё не развёрнут — fallback:
 * GET /get-training-sections + GET /get-themes?section_id=… + прогресс по темам.
 */
export async function fetchTrainingTree(
  studentId: number,
): Promise<TrainingSection[]> {
  try {
    const data = await apiRequest<TrainingTreeResponse>(
      `/get-training-tree/${studentId}`,
    );
    if (data.success && Array.isArray(data.sections)) {
      return normalizeTrainingSections(
        data.sections.sort((a, b) => a.sort_order - b.sort_order),
      );
    }
  } catch (err) {
    if (!(err instanceof ApiError && (err.status === 404 || err.status === 501))) {
      throw err;
    }
  }

  return fetchTrainingTreeFallback(studentId);
}

async function fetchTrainingSectionsList(): Promise<TrainingSectionMeta[]> {
  try {
    const data = await apiRequest<TrainingSectionsResponse>(
      "/get-training-sections",
    );
    if (data.success && Array.isArray(data.sections)) {
      return [...data.sections].sort((a, b) => a.sort_order - b.sort_order);
    }
  } catch (err) {
    if (!(err instanceof ApiError && (err.status === 404 || err.status === 501))) {
      throw err;
    }
  }
  return [];
}

export async function fetchThemes(
  sectionId?: number,
): Promise<TrainingThemeRow[]> {
  const data = await apiRequest<ThemesApiPayload>(
    `/get-themes${buildQuery({ section_id: sectionId })}`,
  );
  return parseThemesPayload(data);
}

async function fetchTrainingTreeFallback(
  studentId: number,
): Promise<TrainingSection[]> {
  const sectionMetas = await fetchTrainingSectionsList();

  if (sectionMetas.length > 0) {
    const sections = await Promise.all(
      sectionMetas.map(async (meta) => {
        const themes = await fetchThemes(meta.id);
        const topics = await Promise.all(
          themes.map((theme) => enrichTopic(studentId, theme)),
        );
        return aggregateSection(meta, topics);
      }),
    );
    return normalizeTrainingSections(sections);
  }

  const allThemes = await fetchThemes();
  const topics = await Promise.all(
    allThemes.map((theme) => enrichTopic(studentId, theme)),
  );

  const bySection = new Map<number, TrainingTopic[]>();
  for (const topic of topics) {
    const sid = topic.section_id || 0;
    const list = bySection.get(sid) ?? [];
    list.push(topic);
    bySection.set(sid, list);
  }

  if (bySection.size <= 1) {
    const sid = topics[0]?.section_id ?? 0;
    return normalizeTrainingSections([
      aggregateSection(
        { id: sid || 1, name: "Темы", sort_order: 0 },
        topics,
      ),
    ]);
  }

  return normalizeTrainingSections(
    Array.from(bySection.entries())
      .sort(([a], [b]) => a - b)
      .map(([sectionId, sectionTopics], index) =>
        aggregateSection(
          {
            id: sectionId,
            name: `Раздел ${sectionId}`,
            sort_order: index,
          },
          sectionTopics,
        ),
      ),
  );
}

export async function fetchAllCardsByTheme(
  studentId: number,
  themeId: number,
): Promise<AllCardsByThemeResponse> {
  return apiRequest<AllCardsByThemeResponse>(
    `/all-cards-by-theme/${studentId}/${themeId}`,
  );
}

export async function fetchCardsToLearn(
  studentId: number,
  themeId: number,
): Promise<CardsToLearnResponse> {
  return apiRequest<CardsToLearnResponse>(
    `/cadrs-by-theme/${studentId}/${themeId}`,
  );
}

export async function fetchLearnedQuestions(
  studentId: number,
  themeId: number,
): Promise<LearnedQuestionsResponse> {
  return apiRequest<LearnedQuestionsResponse>(
    `/learned-questions/${studentId}/${themeId}`,
  );
}

export async function markQuestionLearned(
  payload: AddLearnedPayload,
): Promise<AddLearnedResponse> {
  return apiRequest<AddLearnedResponse>("/add-learned-question", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function unmarkQuestionLearned(
  studentId: number,
  questionId: number,
): Promise<RemoveLearnedResponse> {
  return apiRequest<RemoveLearnedResponse>(
    `/remove-learned-question/${studentId}/${questionId}`,
    { method: "DELETE" },
  );
}
