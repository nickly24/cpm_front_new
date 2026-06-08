import { apiRequest } from "@/lib/api/client";
import type {
  AdminCardsByThemeResponse,
  AdminTrainingCatalogResponse,
  AdminTrainingCardRow,
  TrainingMutationResponse,
} from "./admin-training-types";

export async function fetchAdminTrainingCatalog() {
  const data = await apiRequest<AdminTrainingCatalogResponse>(
    "/get-admin-training-catalog",
  );
  if (!data.success) {
    throw new Error(data.error ?? "Не удалось загрузить каталог");
  }
  return data.sections.sort((a, b) => a.sort_order - b.sort_order);
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

export async function createTrainingSection(payload: {
  name: string;
  sort_order?: number;
}) {
  return apiRequest<TrainingMutationResponse>("/create-training-section", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTrainingSection(
  sectionId: number,
  payload: { name?: string; sort_order?: number },
) {
  return apiRequest<TrainingMutationResponse>(
    `/training-section/${sectionId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteTrainingSection(sectionId: number) {
  return apiRequest<TrainingMutationResponse>(
    `/training-section/${sectionId}`,
    { method: "DELETE" },
  );
}

export async function createTrainingTheme(payload: {
  name: string;
  section_id: number;
}) {
  return apiRequest<TrainingMutationResponse>("/create-training-theme", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTrainingTheme(
  themeId: number,
  payload: { name?: string; section_id?: number },
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
  payload: { question?: string; answer?: string },
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
