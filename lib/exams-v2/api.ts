import {
  apiFormRequest,
  apiRequest,
  ApiError,
  responseError,
} from "@/lib/api/client";
import type {
  Capabilities,
  CommandResult,
  Direction,
  ImportSession,
} from "./types";

export type Query = Record<
  string,
  string | number | boolean | null | undefined
>;
export function queryString(params: Query = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "")
      query.set(key, String(value));
  }
  return query.size ? `?${query}` : "";
}

export function updateExamQuery(
  current: URLSearchParams,
  changes: Record<string, string | number | null>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) next.delete(key);
    else next.set(key, String(value));
  }
  return next;
}

function unwrap<T>(response: unknown): T {
  if (!response || typeof response !== "object")
    throw new ApiError(
      "Некорректный ответ сервера",
      502,
      undefined,
      "invalid_response",
    );
  const body = response as { success?: boolean; data?: T };
  if (body.success === false) throw responseError(response, 400);
  if (body.success !== true || body.data === undefined)
    throw new ApiError(
      "Сервер вернул несовместимый формат экзаменов",
      502,
      undefined,
      "invalid_response",
    );
  return body.data;
}

export async function examGet<T>(
  path: string,
  params: Query = {},
  signal?: AbortSignal,
): Promise<T> {
  return unwrap<T>(
    await apiRequest<unknown>(`${path}${queryString(params)}`, {
      cache: "no-store",
      signal,
    }),
  );
}

export interface ExamCommand {
  path: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  confirmationToken?: string;
  key: string;
  createdAt?: number;
}
export async function examMutate<T>(command: ExamCommand): Promise<T> {
  const headers: Record<string, string> = { "Idempotency-Key": command.key };
  if (command.confirmationToken)
    headers["X-Exam-Confirmation"] = command.confirmationToken;
  const response = await apiRequest<unknown>(command.path, {
    method: command.method,
    headers,
    cache: "no-store",
    body: command.body === undefined ? undefined : JSON.stringify(command.body),
  });
  if (command.method === "DELETE") return undefined as T;
  return unwrap<T>(response);
}

export function importPrefix(
  examId: number,
  kind: "questions" | "assignments" | "outside",
) {
  return kind === "outside"
    ? "/api/outside-exam-results-import"
    : `/api/exams/${examId}/imports/${kind}`;
}
export async function parseExamImport(
  examId: number,
  kind: "questions" | "assignments" | "outside",
  file: File,
  key: string,
): Promise<{ session: ImportSession }> {
  const form = new FormData();
  form.append("file", file);
  if (kind === "outside") form.append("exam_id", String(examId));
  return unwrap(
    await apiFormRequest(`${importPrefix(examId, kind)}/parse`, form, {
      headers: { "Idempotency-Key": key },
    }),
  );
}
export const getCapabilities = (signal?: AbortSignal) =>
  examGet<Capabilities>("/api/exams/capabilities", {}, signal);
export async function getExamDirections(
  signal?: AbortSignal,
): Promise<Direction[]> {
  const response = await apiRequest<{ directions: Direction[] } | Direction[]>(
    "/directions",
    { signal, cache: "no-store" },
  );
  return Array.isArray(response) ? response : (response.directions ?? []);
}
export function attemptCommand(
  attemptId: number,
  command: "ready" | "start" | "vote" | "next-question" | "replace-question",
  body: unknown,
  key: string,
) {
  return examMutate<CommandResult>({
    path: `/api/examiner/attempts/${attemptId}/${command}`,
    method: "POST",
    body,
    key,
  });
}
