import { apiRequest } from "@/lib/api/client";
import type {
  AdminCardsByThemeResponse,
  AdminTrainingCatalogResponse,
  AdminTrainingCardRow,
  AdminTrainingDirectionRow,
  TrainingMutationResponse,
} from "./admin-training-types";
import { normalizeAdminSection } from "./admin-training-types";

export async function fetchAdminTrainingCatalog() {
  const data = await apiRequest<AdminTrainingCatalogResponse>(
    "/get-admin-training-catalog",
  );
  if (!data.success) {
    throw new Error(data.error ?? "Не удалось загрузить каталог");
  }
  const directions = data.directions ?? data.sections ?? [];
  return directions.map((d) => ({
    ...d,
    sections: (d.sections ?? d.topics ?? []).map(normalizeAdminSection),
    topics: (d.topics ?? d.sections ?? []).map(normalizeAdminSection),
  })) as AdminTrainingDirectionRow[];
}

export async function fetchAdminCardsByTheme(themeId: number) {
  const data = await apiRequest<AdminCardsByThemeResponse>(
    `/admin-cards-by-theme/${themeId}`,
  );
  if (!data.success) {
    throw new Error(data.error ?? "Не удалось загрузить карточки");
  }
  return data.cards;
}

export async function createTrainingTheme(payload: {
  name: string;
  direction_id: number;
}) {
  return apiRequest<TrainingMutationResponse>("/create-training-theme", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTrainingTheme(
  themeId: number,
  payload: { name?: string; direction_id?: number },
) {
  return apiRequest<TrainingMutationResponse>(`/training-theme/${themeId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteTrainingTheme(themeId: number) {
  return apiRequest<TrainingMutationResponse>(`/training-theme/${themeId}`, {
    method: "DELETE",
  });
}

export async function createTrainingCard(payload: {
  theme_id: number;
  question: string;
  answer: string;
  sort_order?: number;
}) {
  return apiRequest<TrainingMutationResponse & AdminTrainingCardRow>(
    "/create-card",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function updateTrainingCard(
  cardId: number,
  payload: { question?: string; answer?: string; sort_order?: number },
) {
  return apiRequest<TrainingMutationResponse>(`/card/${cardId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteTrainingCard(cardId: number) {
  return apiRequest<TrainingMutationResponse>(`/card/${cardId}`, {
    method: "DELETE",
  });
}
