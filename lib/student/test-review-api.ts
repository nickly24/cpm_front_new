import { BFF_DEV } from "@/lib/config";
import { studentReview } from "@/lib/bff/tests-student";
import { apiRequest } from "@/lib/api/client";
import type { TestReviewResponse } from "./test-review-types";

export async function fetchTestSessionReview(
  sessionId: string,
  signal?: AbortSignal,
): Promise<TestReviewResponse> {
  if (BFF_DEV) return studentReview(sessionId, signal);
  return apiRequest<TestReviewResponse>(
    `/test-session/${encodeURIComponent(sessionId)}/review`,
    { signal },
  );
}

export function getReviewErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    calculation_pending: "Ответы приняты. Проверка ещё выполняется — попробуйте позже.",
    review_hidden: "Просмотр ответов пока закрыт преподавателем",
    session_not_found: "Сессия теста не найдена",
    test_not_found: "Тест не найден",
    forbidden: "Нет доступа к этому разбору",
    results_hidden: "Результаты пока скрыты преподавателем",
  };

  return messages[code] ?? code;
}
