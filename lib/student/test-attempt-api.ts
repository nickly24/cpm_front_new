import { apiRequest } from "@/lib/api/client";
import type {
  AttemptEnvelope,
  StoredAttemptAnswer,
  SubmitAttemptResponse,
  TestAttempt,
} from "./test-attempt-types";

export async function startTestAttempt(
  testId: string,
  options?: { practice?: boolean },
): Promise<AttemptEnvelope> {
  return apiRequest<AttemptEnvelope>("/test-attempt/start", {
    method: "POST",
    body: JSON.stringify({
      testId,
      isPractice: Boolean(options?.practice),
    }),
  });
}

export async function fetchActiveTestAttempt(
  testId: string,
): Promise<AttemptEnvelope> {
  return apiRequest<AttemptEnvelope>(
    `/test-attempt/active?testId=${encodeURIComponent(testId)}`,
  );
}

export async function fetchTestAttempt(
  attemptId: string,
): Promise<AttemptEnvelope> {
  return apiRequest<AttemptEnvelope>(`/test-attempt/${attemptId}`);
}

export async function saveTestAttemptAnswer(
  attemptId: string,
  answer: StoredAttemptAnswer,
): Promise<AttemptEnvelope> {
  return apiRequest<AttemptEnvelope>(`/test-attempt/${attemptId}/answer`, {
    method: "PATCH",
    body: JSON.stringify(answer),
  });
}

export async function submitTestAttempt(
  attemptId: string,
): Promise<SubmitAttemptResponse> {
  return apiRequest<SubmitAttemptResponse>(`/test-attempt/${attemptId}/submit`, {
    method: "POST",
  });
}

export function getAttemptErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    testId_required: "Не указан тест",
    test_not_found: "Тест не найден",
    test_has_no_questions: "В тесте нет вопросов",
    test_not_started: "Тест ещё не открыт для сдачи",
    test_ended: "Окно сдачи теста уже закрыто",
    test_already_completed: "Тест уже сдан",
    attempt_expired: "Время попытки истекло",
    attempt_not_found: "Попытка не найдена",
    attempt_not_active: "Попытка больше не активна",
    answer_locked: "Ответ на этот вопрос уже зафиксирован",
    time_expired: "Время попытки истекло",
    question_id_required: "Не указан вопрос",
    invalid_answer_type: "Неверный тип ответа",
    invalid_question_id: "Неверный вопрос",
    test_not_completed: "Сначала нужно официально сдать этот тест",
    practice_use_frontend_only: "Тренировка пока недоступна через сервер",
  };

  return messages[code] ?? code;
}

export function isValidAttempt(attempt: TestAttempt | null | undefined): boolean {
  return Boolean(
    attempt &&
      attempt.attemptId &&
      Array.isArray(attempt.questions) &&
      attempt.questions.length > 0,
  );
}
