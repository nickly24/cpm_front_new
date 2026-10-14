import { BFF_DEV } from "@/lib/config";
import { examsAdminGet, examsAdminMutate, examsParseImport, examsDownloadTemplate } from "@/lib/bff/exams-admin";
import { examsDirections } from "@/lib/bff/exams-shared";
import { examsConductGet, examsConductMutate } from "@/lib/bff/exams-conduct";
import { examsStudentGet, examsStudentMutate } from "@/lib/bff/exams-student";
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
  ImportKind,
} from "./types";

/** Keep uncertain transport failures in the existing durable command journal. */
async function bffBoundary<T>(run: () => Promise<T>): Promise<T> {
  try { return await run(); }
  catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && "status" in error && typeof error.status === "number") {
      const details = error as Error & { status: number; code?: string; details?: Record<string, unknown>; correlationId?: string; retryAfterSeconds?: number };
      throw new ApiError(details.message, details.status, details.retryAfterSeconds, details.code, details.details, details.correlationId);
    }
    throw error;
  }
}

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
  if (BFF_DEV) return bffBoundary(async () => {
    if (/^\/api\/student\/exams(?:\/|$)/.test(path) || /^\/api\/exams\/\d+\/training(?:\/preview)?(?:\?|$)/.test(path)) return await examsStudentGet(path, params, signal) as T;
    if (/^\/api\/examiner\//.test(path) || /^\/api\/exams\/lookups/.test(path) || /\/attempts\/\d+\/questions(?:\/|\?|$)/.test(path)) return await examsConductGet(path, params, signal) as T;
    return await examsAdminGet(path, params, signal) as T;
  });
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
  if (BFF_DEV) return bffBoundary(async () => {
    if (/^\/api\/student\/exams(?:\/|$)/.test(command.path) || /^\/api\/exams\/\d+\/training(?:\/preview)?(?:\?|$)/.test(command.path)) return await examsStudentMutate(command) as T;
    if (/^\/api\/examiner\//.test(command.path)) return await examsConductMutate(command) as T;
    return await examsAdminMutate(command) as T;
  });
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
  if (BFF_DEV) return `/api/exams/${examId}/imports/${kind}`;
  return kind === "outside"
    ? "/api/outside-exam-results-import"
    : `/api/exams/${examId}/imports/${kind}`;
}
/** Native templates exist only in the new owner contract. Legacy flows stay unchanged. */
export async function downloadExamImportTemplate(examId: number, kind: ImportKind, signal?: AbortSignal): Promise<Blob> {
  if (!BFF_DEV) throw new ApiError("Шаблон нового сервиса недоступен в этом режиме", 501);
  return bffBoundary(() => examsDownloadTemplate(examId, kind, signal));
}
export async function parseExamImport(
  examId: number,
  kind: "questions" | "assignments" | "outside",
  file: File,
  key: string,
): Promise<{ session: ImportSession }> {
  if (BFF_DEV) return bffBoundary(() => examsParseImport(examId, kind, file, key));
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
  if (BFF_DEV) return bffBoundary(() => examsDirections(signal));
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
  examId?: number,
) {
  if (BFF_DEV && (!examId || !Number.isSafeInteger(examId) || examId < 1)) throw new ApiError("Выберите экзамен перед изменением сдачи", 400, undefined, "exam_required");
  return examMutate<CommandResult>({
    path: BFF_DEV ? `/api/examiner/exams/${examId}/attempts/${attemptId}/${command}` : `/api/examiner/attempts/${attemptId}/${command}`,
    method: "POST",
    body,
    key,
  });
}
