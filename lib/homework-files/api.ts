import { ApiError } from "@/lib/api/client";
import { getToken } from "@/lib/auth/storage";
import { HOMEWORK_SERVICE_URL } from "@/lib/config";
import type {
  ActiveJobsResponse,
  HomeworkWorkspace,
  ReviewQueueItem,
  UploadInitialization,
  UploadJob,
  HomeworkListQuery,
  HomeworkPage,
} from "./types";

const ERROR_LABELS: Record<string, string> = {
  unauthorized: "Нужно войти в кабинет заново",
  forbidden: "Недостаточно прав",
  source_too_large: "PDF больше 10 МБ",
  too_many_pages: "В PDF больше 35 страниц",
  encrypted_pdf: "PDF защищён паролем",
  active_content: "PDF содержит небезопасное активное содержимое",
  corrupt_pdf: "PDF повреждён или не читается",
  staging_owner_mismatch: "Не удалось подтвердить владельца загрузки",
  invalid_pdf_signature: "Этот файл не является PDF. Сохраните работу в формате PDF и выберите её снова.",
  empty_pdf: "В PDF нет страниц",
  processed_too_large: "После обработки PDF превышает допустимый размер. Уменьшите файл и загрузите снова.",
  not_reviewer: "Работу проверяет другой сотрудник. Обновите список.",
  invalid_state: "Состояние работы изменилось. Обновите её и повторите действие.",
  invalid_result: "Укажите целое число от 0 до 100",
  already_graded: "Работа уже оценена. Для пересдачи обратитесь к проверяющему.",
  file_locked_after_submit: "Работа уже отправлена. Заменить файл можно после возврата на доработку.",
  upload_in_progress: "Для этой работы уже загружается файл. Дождитесь завершения или отмените загрузку.",
  active_upload_exists: "Для этой работы уже загружается файл. Дождитесь завершения или отмените загрузку.",
  draft_not_ready: "Сначала дождитесь готовности PDF",
  staging_object_expired: "Время хранения загрузки истекло. Выберите файл заново.",
  staging_object_not_found: "Файл ещё не загружен. Выберите его заново.",
  job_not_found: "Загрузка не найдена. Выберите файл заново.",
  job_not_retryable: "Эту загрузку нельзя повторить. Выберите файл заново.",
  manual_retry_limit: "Повторные попытки исчерпаны. Выберите файл заново.",
  upload_expired: "Загрузка прервалась. Выберите файл заново.",
  storage_unavailable: "Хранилище временно недоступно. Попробуйте ещё раз.",
  job_superseded: "Загрузка устарела. Откройте работу и выберите файл заново.",
  client_upload_id_conflict: "Не удалось повторить загрузку. Выберите файл заново.",
  use_file_review: "Эта работа с PDF. Откройте её в очереди проверки или архиве.",
  student_not_in_current_group: "Ученик не относится к вашей текущей группе",
};

export function homeworkErrorMessage(code?: string | null) {
  if (!code) return "Не удалось обработать PDF. Попробуйте ещё раз или выберите другой файл.";
  return ERROR_LABELS[code] ?? (/^[a-z_]+$/.test(code) ? "Не удалось обработать PDF. Повторите попытку или выберите другой файл." : code);
}

function queryString(query: HomeworkListQuery = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => { if (value !== undefined && value !== "") params.set(key, String(value)); });
  return params.size ? `?${params}` : "";
}

async function homeworkRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20_000);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  let response: Response;
  try {
    response = await fetch(`${HOMEWORK_SERVICE_URL}${path}`, {
      ...options,
      headers,
      credentials: "omit",
      signal: controller.signal,
    });
  } catch {
    throw new ApiError("Не удалось связаться с сервисом домашних работ");
  } finally {
    window.clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
  let data: T & { error?: string };
  try { data = await response.json() as T & { error?: string }; }
  catch { data = {} as T & { error?: string }; }
  if (!response.ok) {
    const code = data.error ?? "homework_service_error";
    throw new ApiError(homeworkErrorMessage(code), response.status);
  }
  return data;
}

export const homeworkFilesApi = {
  workspace: (homeworkId: number, studentId?: number) =>
    homeworkRequest<HomeworkWorkspace>(`/api/workspaces/${homeworkId}${studentId ? `?student_id=${studentId}` : ""}`),
  createUpload: (homeworkId: number, clientId: string) =>
    homeworkRequest<UploadInitialization>(`/api/workspaces/${homeworkId}/uploads`, {
      method: "POST",
      headers: { "Idempotency-Key": clientId },
      body: JSON.stringify({ client_upload_id: clientId }),
    }),
  completeUpload: (jobId: string) =>
    homeworkRequest<UploadJob>(`/api/uploads/${jobId}/complete`, { method: "POST" }),
  job: (id: string) => homeworkRequest<UploadJob>(`/api/jobs/${id}`),
  jobs: () => homeworkRequest<ActiveJobsResponse>("/api/jobs/active"),
  cancel: (id: string) => homeworkRequest<UploadJob>(`/api/jobs/${id}/cancel`, { method: "POST" }),
  retry: (id: string) => homeworkRequest<UploadJob>(`/api/jobs/${id}/retry`, { method: "POST" }),
  submit: (homeworkId: number) => homeworkRequest(`/api/workspaces/${homeworkId}/submit`, { method: "POST" }),
  removeDraft: (homeworkId: number) => homeworkRequest(`/api/workspaces/${homeworkId}/draft`, { method: "DELETE" }),
  queue: (query: HomeworkListQuery | string = {}) => homeworkRequest<HomeworkPage<ReviewQueueItem>>(`/api/review-queue${queryString(typeof query === "string" ? { state: query } : query)}`),
  transition: (id: number, action: string, payload: object = {}) => {
    if ("result" in payload && (typeof payload.result !== "number" || !Number.isInteger(payload.result) || payload.result < 0 || payload.result > 100)) {
      return Promise.reject(new ApiError(ERROR_LABELS.invalid_result));
    }
    return homeworkRequest(`/api/submissions/${id}/${action}`, { method: "POST", body: JSON.stringify(payload) });
  },
  fileUrl: (id: number, draft = false, download = false) => homeworkRequest<{ url: string; filename?: string; expires_in?: number }>(`/api/submissions/${id}/file-url?draft=${draft ? 1 : 0}&download=${download ? 1 : 0}`),
  archive: (query: HomeworkListQuery | string = {}) => homeworkRequest<HomeworkPage<ArchiveItem>>(`/api/archive${typeof query === "string" ? (query ? `?${query}` : "") : queryString(query)}`),
  monitoring: () => homeworkRequest<MonitoringData>("/api/monitoring"),
};

export interface ArchiveItem {
  id: number; student_name: string; homework_name: string; group_name: string | null;
  submitted_at_utc: string; size_bytes: number; page_count: number;
  homework_id: number; student_id: number; result: number;
  deadline?: string | null; filename?: string;
}

export interface MonitoringData {
  jobs: { status: string; count: number }[];
  recent_jobs: { id: string; status: string; stage: string; error_code: string | null; attempts: number; manual_attempts: number }[];
  runner: { started: boolean; heartbeat_age_seconds: number | null };
  storage: { file_count: number | null; total_bytes: number | null };
  warnings: string[];
  failed_last_hour: number;
}

export function postFileToS3(
  initialization: UploadInitialization,
  file: File,
  onProgress: (value: number) => void,
  signal?: AbortSignal,
) {
  if (!initialization.upload) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(initialization.upload!.method, initialization.upload!.url);
    xhr.timeout = 180_000;
    const abort = () => xhr.abort();
    signal?.addEventListener("abort", abort, { once: true });
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.max(1, Math.round(event.loaded / event.total * 100)));
    };
    const cleanup = () => signal?.removeEventListener("abort", abort);
    xhr.onerror = () => { cleanup(); reject(new Error("Не удалось загрузить PDF. Проверьте интернет и повторите попытку.")); };
    xhr.ontimeout = () => { cleanup(); reject(new Error("Загрузка заняла слишком много времени. Проверьте интернет и повторите попытку.")); };
    xhr.onabort = () => { cleanup(); reject(new DOMException("Загрузка отменена", "AbortError")); };
    xhr.onload = () => {
      signal?.removeEventListener("abort", abort);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`S3 отклонил загрузку (${xhr.status})`));
    };
    const form = new FormData();
    Object.entries(initialization.upload!.fields).forEach(([key, value]) => form.append(key, value));
    form.append("file", file);
    if (signal?.aborted) { cleanup(); reject(new DOMException("Загрузка отменена", "AbortError")); return; }
    xhr.send(form);
  });
}

export async function uploadHomeworkFile(
  homeworkId: number,
  file: File,
  clientId: string,
  onProgress: (value: number) => void,
  signal?: AbortSignal,
) {
  const initialization = await homeworkFilesApi.createUpload(homeworkId, clientId);
  if (!initialization.upload) return initialization.job;
  try {
    await postFileToS3(initialization, file, onProgress, signal);
    return await homeworkFilesApi.completeUpload(initialization.job.id);
  } catch (error) {
    if (signal?.aborted) await homeworkFilesApi.cancel(initialization.job.id).catch(() => undefined);
    throw error;
  }
}
