import { API_BASE_URL } from "../config";
import { getToken } from "../auth/storage";

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function requestTimeoutMs(path: string): number {
  if (path.includes("/finalize")) return 30_000;
  if (path.includes("/test-attempt")) return 15_000;
  return 10_000;
}

async function fetchWithTimeout(url: string, path: string, options: RequestInit) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), requestTimeoutMs(path));
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body) {
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
    const message =
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as { message?: string }).message === "string"
        ? (data as { message: string }).message
        : typeof data === "object" &&
            data !== null &&
            "error" in data &&
            typeof (data as { error?: string }).error === "string"
          ? (data as { error: string }).error
          : "Ошибка запроса";

    const retryAfterSeconds = typeof data === "object" && data !== null && "details" in data
      ? Number((data as { details?: { retry_after_seconds?: number } }).details?.retry_after_seconds) || undefined
      : undefined;
    throw new ApiError(message, response.status, retryAfterSeconds);
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
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error?: string }).error === "string"
        ? (data as { error: string }).error
        : "Ошибка запроса";

    throw new ApiError(message, response.status);
  }

  return data;
}
