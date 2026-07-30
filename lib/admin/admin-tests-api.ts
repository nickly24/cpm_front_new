import { apiRequest } from "@/lib/api/client";
import type {
  AdminExternalTestDeletePreview,
  AdminExternalTestDeleteResponse,
  AdminTestChangesResponse,
  Direction,
} from "@/lib/admin/admin-tests-types";
import type {
  AdminExternalTestFormData,
  AdminTestChangeEventType,
  AdminTestDetail,
  AdminTestFormData,
  AdminTestListItem,
} from "@/lib/admin/admin-tests-types";

export async function fetchAdminDirections(): Promise<Direction[]> {
  return apiRequest<Direction[]>("/directions");
}

export async function fetchAdminTestsByDirection(
  directionName: string,
): Promise<AdminTestListItem[]> {
  return apiRequest<AdminTestListItem[]>(
    `/tests/${encodeURIComponent(directionName)}`,
  );
}

export async function fetchAdminTestById(
  testId: string,
): Promise<AdminTestDetail> {
  return apiRequest<AdminTestDetail>(`/test/${testId}`);
}

export async function createAdminTest(
  payload: AdminTestFormData,
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>("/create-test", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createExternalAdminTest(
  payload: AdminExternalTestFormData,
): Promise<{ success: boolean; test: AdminTestListItem }> {
  return apiRequest<{ success: boolean; test: AdminTestListItem }>(
    "/external-tests",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export interface AdminTestUpdateRecalcDecision {
  needsRecalc: boolean;
  reasons: string[];
  excludeQuestionIds?: Array<string | number>;
}

export interface AdminTestUpdateRecalc {
  updated: number;
  sessions: number;
  skipped?: boolean;
  error?: string;
  decision?: AdminTestUpdateRecalcDecision;
}

export interface AdminTestUpdateResponse {
  message: string;
  testId: string;
  recalc?: AdminTestUpdateRecalc;
}

const RECALC_REASON_LABELS: Record<string, string> = {
  question_removed: "удалён вопрос",
  question_type_changed: "изменён тип вопроса",
  points_changed: "изменён вес вопроса",
  correct_flag_changed: "изменён правильный ответ",
  option_removed: "удалён вариант ответа",
  text_correct_removed: "удалён эталон текстового ответа",
};

export type AdminTestRecalcOutcomeKind =
  | "saved"
  | "skipped"
  | "recalculated"
  | "error";

export interface AdminTestRecalcOutcome {
  kind: AdminTestRecalcOutcomeKind;
  title: string;
  summary: string;
  reasons: string[];
  updated: number;
  sessions: number;
}

export function describeAdminTestRecalc(
  recalc?: AdminTestUpdateRecalc | null,
): AdminTestRecalcOutcome {
  if (!recalc) {
    return {
      kind: "saved",
      title: "Тест сохранён",
      summary: "Изменения записаны.",
      reasons: [],
      updated: 0,
      sessions: 0,
    };
  }
  if (recalc.error) {
    return {
      kind: "error",
      title: "Тест сохранён с ошибкой пересчёта",
      summary: recalc.error,
      reasons: [],
      updated: Number(recalc.updated || 0),
      sessions: Number(recalc.sessions || 0),
    };
  }
  const decision = recalc.decision;
  if (recalc.skipped || (decision && !decision.needsRecalc)) {
    return {
      kind: "skipped",
      title: "Тест сохранён",
      summary: "Пересчёт старых сдач не требуется.",
      reasons: [],
      updated: 0,
      sessions: Number(recalc.sessions || 0),
    };
  }
  const reasons =
    decision?.reasons
      ?.map((code) => RECALC_REASON_LABELS[code] || code)
      .filter(Boolean) || [];
  const updated = Number(recalc.updated || 0);
  const sessions = Number(recalc.sessions || 0);
  return {
    kind: "recalculated",
    title: "Тест сохранён",
    summary: `Решение: пересчитать старые сдачи. Обновлено сессий: ${updated} из ${sessions}.`,
    reasons:
      reasons.length > 0 ? reasons : ["изменения, влияющие на баллы"],
    updated,
    sessions,
  };
}

export function formatAdminTestRecalcMessage(
  recalc?: AdminTestUpdateRecalc | null,
): string {
  const outcome = describeAdminTestRecalc(recalc);
  if (outcome.kind === "recalculated" && outcome.reasons.length > 0) {
    return `${outcome.title}. ${outcome.summary} Причины: ${outcome.reasons.join(", ")}.`;
  }
  return `${outcome.title}. ${outcome.summary}`;
}

export async function updateAdminTest(
  testId: string,
  payload: AdminTestFormData,
): Promise<AdminTestUpdateResponse> {
  return apiRequest<AdminTestUpdateResponse>(`/test/${testId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminTest(testId: string): Promise<{
  message: string;
  deletedSessions: number;
}> {
  return apiRequest<{ message: string; deletedSessions: number }>(
    `/test/${testId}`,
    { method: "DELETE" },
  );
}

/** Частичное обновление полей теста (работает на проде без отдельных toggle-роутов). */
export async function patchAdminTestFields(
  testId: string,
  fields: { published?: boolean; visible?: boolean },
): Promise<AdminTestUpdateResponse> {
  return apiRequest<AdminTestUpdateResponse>(`/test/${testId}`, {
    method: "PUT",
    body: JSON.stringify(fields),
  });
}

export function getAdminTestId(test: AdminTestListItem): string {
  return String(test.id ?? "");
}

export function getAdminTestTitle(test: AdminTestListItem): string {
  return test.title || test.name || "Без названия";
}

export function isAdminExternalTest(test: AdminTestListItem): boolean {
  return Boolean(test.isExternal || test.externalTest);
}

export async function fetchExternalTestDeletePreview(
  testId: string,
): Promise<AdminExternalTestDeletePreview> {
  return apiRequest<AdminExternalTestDeletePreview>(
    `/external-tests/${encodeURIComponent(testId)}/delete-preview`,
  );
}

export async function deleteExternalAdminTest(
  testId: string,
): Promise<AdminExternalTestDeleteResponse> {
  return apiRequest<AdminExternalTestDeleteResponse>(
    `/external-tests/${encodeURIComponent(testId)}`,
    { method: "DELETE" },
  );
}

export async function fetchAdminTestChanges(
  testId: string,
  params: {
    page?: number;
    limit?: number;
    questionId?: number;
    eventType?: AdminTestChangeEventType;
  } = {},
): Promise<AdminTestChangesResponse> {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.questionId != null) search.set("questionId", String(params.questionId));
  if (params.eventType) search.set("eventType", params.eventType);
  const query = search.toString();
  return apiRequest<AdminTestChangesResponse>(
    `/test/${encodeURIComponent(testId)}/changes${query ? `?${query}` : ""}`,
  );
}
