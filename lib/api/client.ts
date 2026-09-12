import { API_BASE_URL } from "../config";
import { getToken } from "../auth/storage";

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public retryAfterSeconds?: number,
    public code?: string,
    public details?: Record<string, unknown>,
    public correlationId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Both JSON and multipart requests expose the same stable error contract. */
export function responseError(data: unknown, status: number): ApiError {
  const body = typeof data === "object" && data !== null
    ? data as Record<string, unknown> : {};
  const details = typeof body.details === "object" && body.details !== null
    ? body.details as Record<string, unknown> : undefined;
  const message = typeof body.message === "string" ? body.message
    : typeof body.error === "string" ? body.error : "Ошибка запроса";
  const retry = Number(details?.retry_after_seconds);
  return new ApiError(message, status, Number.isFinite(retry) && retry > 0 ? retry : undefined,
    typeof body.error === "string" ? body.error : typeof body.code === "string" ? body.code : undefined,
    details, typeof body.correlationId === "string" ? body.correlationId : undefined);
}

function requestTimeoutMs(path: string): number {
  if (path.includes("/finalize")) return 30_000;
  if (path.includes("/test-attempt")) return 15_000;
  return 10_000;
}

async function fetchWithTimeout(url: string, path: string, options: RequestInit) {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), requestTimeoutMs(path));
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}${path}`, path, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      "Не удалось связаться с сервером. Проверьте интернет и попробуйте снова.",
    );
  }

  let data: T;
  try {
    data = (await response.json()) as T;
  } catch {
    data = {} as T;
  }

  if (!response.ok) {
    throw responseError(data, response.status);
  }

  return data;
}

export async function apiFormRequest<T>(
  path: string,
  formData: FormData,
  options: Omit<RequestInit, "body"> = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  // The browser must attach the multipart boundary itself.
  headers.delete("Content-Type");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}${path}`, path, {
      ...options,
      method: options.method ?? "POST",
      headers,
      body: formData,
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      "Не удалось связаться с сервером. Проверьте интернет и попробуйте снова.",
    );
  }

  let data: T;
  try {
    data = (await response.json()) as T;
  } catch {
    data = {} as T;
  }

  if (!response.ok) {
    throw responseError(data, response.status);
  }

  return data;
}
