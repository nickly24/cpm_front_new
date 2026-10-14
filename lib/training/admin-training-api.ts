import { apiRequest } from "@/lib/api/client";
import { BFF_DEV } from "@/lib/config";
import { cardsAdminCards, cardsAdminCatalog, cardsAdminMutation } from "@/lib/bff/cards";
import type {
  AdminCardsByThemeResponse,
  AdminTrainingCatalogResponse,
  AdminTrainingCardRow,
  AdminTrainingDirectionRow,
  TrainingMutationResponse,
} from "./admin-training-types";
import { normalizeAdminSection } from "./admin-training-types";

export async function fetchAdminTrainingCatalog() {
  if (BFF_DEV) return cardsAdminCatalog();
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

export async function fetchAdminCardsByTheme(themeId: number, signal?: AbortSignal) {
  if (BFF_DEV) return cardsAdminCards(themeId, signal);
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
  if (BFF_DEV) return cardsAdminMutation("/themes", "POST", payload);
  return apiRequest<TrainingMutationResponse>("/create-training-theme", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTrainingTheme(
  themeId: number,
  payload: { name?: string; direction_id?: number; expected_revision?: number },
) {
  if (BFF_DEV) return cardsAdminMutation(`/themes/${themeId}`, "PUT", payload);
  return apiRequest<TrainingMutationResponse>(`/training-theme/${themeId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteTrainingTheme(themeId: number, expectedRevision?: number) {
  if (BFF_DEV) return cardsAdminMutation(`/themes/${themeId}`, "DELETE", { expected_revision: expectedRevision });
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
  if (BFF_DEV) {
    const { theme_id, ...body } = payload;
    return cardsAdminMutation(`/themes/${theme_id}/cards`, "POST", body);
  }
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
  payload: { question?: string; answer?: string; sort_order?: number; theme_id?: number; expected_revision?: number },
) {
  if (BFF_DEV) {
    const { theme_id, ...body } = payload;
    return cardsAdminMutation(`/themes/${theme_id}/cards/${cardId}`, "PUT", body);
  }
  return apiRequest<TrainingMutationResponse>(`/card/${cardId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteTrainingCard(cardId: number, themeId?: number, expectedRevision?: number) {
  if (BFF_DEV) return cardsAdminMutation(`/themes/${themeId}/cards/${cardId}`, "DELETE", { expected_revision: expectedRevision });
  return apiRequest<TrainingMutationResponse>(`/card/${cardId}`, {
    method: "DELETE",
  });
}
