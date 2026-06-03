import { apiRequest } from "@/lib/api/client";
import type { TestReviewResponse } from "./test-review-types";

export async function fetchTestSessionReview(
  sessionId: string,
): Promise<TestReviewResponse> {
  return apiRequest<TestReviewResponse>(
    `/test-session/${encodeURIComponent(sessionId)}/review`,
  );
}

export function getReviewErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    session_not_found: "Сессия теста не найдена",
    test_not_found: "Тест не найден",
    forbidden: "Нет доступа к этому разбору",
  };

  return messages[code] ?? code;
}
