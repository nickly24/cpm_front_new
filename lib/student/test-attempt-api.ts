import { ApiError, apiRequest } from "@/lib/api/client";
import type {
  AttemptEnvelope,
  PracticeFeedback,
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
      clientSchemaVersion: options?.practice ? 1 : 2,
    }),
  });
}

export interface CommitSyncResponse {
  success: boolean;
  ackedCommitIds?: string[];
  conflicts?: Array<{ questionId?: number; commitId?: string; error: string }>;
  errors?: Array<{ questionId?: number; commitId?: string; error: string }>;
  serverAnswerCount?: number;
  serverNowMoscow?: string;
  serverNowEpochMs?: number;
  error?: string;
}

export async function syncTestAttemptCommits(
  attemptId: string,
  commits: Array<StoredAttemptAnswer & { commitId: string; sequence: number; committedAtMoscow: string }>,
): Promise<CommitSyncResponse> {
  return apiRequest(`/test-attempt/${attemptId}/commits`, {
    method: "POST",
    body: JSON.stringify({ commits }),
  });
}

export async function finalizeTestAttemptV2(
  attemptId: string,
  snapshot: unknown,
): Promise<SubmitAttemptResponse & { alreadyFinalized?: boolean }> {
  return apiRequest(`/test-attempt/${attemptId}/finalize`, {
    method: "POST",
    body: JSON.stringify({ snapshot }),
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

export interface PracticeAnswerResponse {
  success: boolean;
  feedback?: PracticeFeedback;
  answeredCount?: number;
  totalQuestions?: number;
  idempotent?: boolean;
  error?: string;
}

export async function checkPracticeAnswer(
  attemptId: string,
  answer: StoredAttemptAnswer,
): Promise<PracticeAnswerResponse> {
  return apiRequest<PracticeAnswerResponse>(
    `/test-attempt/${attemptId}/practice-answer`,
    {
      method: "POST",
      body: JSON.stringify(answer),
    },
  );
}

export interface BatchSyncResponse {
  success: boolean;
  attempt?: TestAttempt;
  syncedQuestionIds?: number[];
  skippedQuestionIds?: number[];
  errors?: Array<{ questionId?: number; error: string }>;
  error?: string;
}

export async function syncTestAttemptAnswersBatch(
  attemptId: string,
  answers: StoredAttemptAnswer[],
): Promise<BatchSyncResponse> {
  return apiRequest<BatchSyncResponse>(`/test-attempt/${attemptId}/answers`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export async function submitTestAttempt(
  attemptId: string,
): Promise<SubmitAttemptResponse> {
  return apiRequest<SubmitAttemptResponse>(`/test-attempt/${attemptId}/submit`, {
    method: "POST",
  });
}

export function getNetworkErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return getAttemptErrorMessage(err.message);
  }
  if (err instanceof TypeError) {
    return "Не удалось связаться с сервером. Проверьте интернет и попробуйте снова.";
  }
  if (err instanceof Error) {
    if (/failed to fetch|network|load failed/i.test(err.message)) {
      return "Не удалось связаться с сервером. Проверьте интернет и попробуйте снова.";
    }
    return err.message;
  }
  return "Не удалось отправить. Попробуйте ещё раз.";
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
    practice_not_published:
      "Тренировка станет доступна после публикации ответов преподавателем",
    practice_before_official_completion:
      "Сначала завершите официальное прохождение или дождитесь окончания теста",
    practice_attempt_required: "Эта операция доступна только в тренировке",
    official_attempt_pending:
      "Сначала отправьте или завершите сохранённую официальную попытку",
    results_hidden: "Результаты пока скрыты преподавателем",
    answers_required: "Нет ответов для синхронизации",
    answers_batch_too_large: "Слишком много ответов в одном запросе",
    answers_not_synced:
      "Ответы сохранены на устройстве, но не все дошли до сервера. Подключитесь к сети и повторите отправку.",
    empty_attempt_answers:
      "Сервер ещё не получил сохранённые ответы. Подключитесь к сети и повторите отправку.",
    upload_window_closed: "Срок самостоятельной отправки истёк. Обратитесь к администратору.",
    invalid_snapshot: "Локальный слепок содержит некорректные ответы",
    test_version_mismatch: "Версия теста не совпадает. Локальные данные сохранены — обратитесь к администратору.",
    snapshot_hash_mismatch: "Локальный слепок повреждён. Данные не удалены — обратитесь к администратору.",
    corrupted_local_bundle: "Локальные данные попытки повреждены. Они не удалены и не будут смешаны с новой попыткой.",
    indexeddb_upgrade_blocked: "Закройте другие вкладки CPM, обновите страницу и попробуйте снова.",
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
