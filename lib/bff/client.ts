import type { User } from "@/lib/auth/types";
import { parseRetryAfterMs } from "./retry-after";
import { BFF_BASE_URL } from "./config";
export interface Organization { id: number; name: string; divisions: { id: number; name: string; group_id?:number|null; permissions?:Record<string,{view:boolean;edit:boolean}> }[] }
export interface Identity { status: true; user: User; organizations: Organization[]; context_revision: string }
let revision = "";
let current: Identity | null = null;
const pending = new Set<AbortController>();
export const getIdentity = () => current;
export function resetRequests() { for (const c of pending) c.abort(); pending.clear(); }
export function announceSession() { localStorage.setItem("cpm-bff-session-event", crypto.randomUUID()); }
export function acceptIdentity(data: Identity) {
  if (revision && revision !== data.context_revision) { resetRequests(); window.location.replace(window.location.pathname); throw new Error("Кабинет изменился"); }
  revision = data.context_revision; current = data;
  return { ...data.user, organizations: data.organizations, context_revision: data.context_revision };
}
export async function exclusiveContext<T>(fn: () => Promise<T>): Promise<T> {
  if (!navigator.locks) throw new Error("Для переключения кабинета нужен браузер с Web Locks");
  return navigator.locks.request("cpm-bff-context", { mode: "exclusive", ifAvailable: true }, async lock => {
    if (!lock) throw new Error("Закройте редактор или проверку работы и завершите передачу файла в открытых вкладках, затем переключите кабинет.");
    return fn();
  });
}
async function request<T>(path: string, options: RequestInit, binary: boolean): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Недопустимый адрес");
  const snapshot = revision;
  const run = async () => {
    const controller = new AbortController(); pending.add(controller);
    const timer = setTimeout(() => controller.abort(), 28000);
    const abort = () => controller.abort(); options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) controller.abort();
    try {
      const headers = new Headers(options.headers);
      headers.delete("Authorization"); headers.set("X-CPM-Request", "1"); headers.set("X-CPM-Context", snapshot);
      if (options.body instanceof FormData) headers.delete("Content-Type");
      else if (options.body) headers.set("Content-Type", "application/json");
      let res: Response;
      let data;
      try {
        res = await fetch(`${BFF_BASE_URL}${path}`, { ...options, headers, credentials: "include", cache: "no-store", signal: controller.signal });
        data = binary && res.ok ? await res.blob() : await res.json();
      } catch (error) {
        throw Object.assign(new Error(error instanceof Error ? error.message : "Не удалось получить ответ сервера"), { status: 0, code: "transport_error" });
      }
      if (snapshot !== revision) throw new Error("Кабинет изменился. Обновите страницу.");
      if (!res.ok) {
        if (data.error === "context_changed") { resetRequests(); window.location.replace(window.location.pathname); }
        if (res.status === 401 && path !== "/auth/login" && path !== "/auth/me") {
          // A domain/service credential failure does not end the browser session.
          // Only Auth can confirm that this cookie is no longer usable.
          try { await bffRequest<Identity>("/auth/me"); }
          catch (error) { if ((error as { status?: number }).status === 401) window.dispatchEvent(new Event("bff-session-expired")); }
        }
        const labels: Record<string,string> = { invalid_credentials: "Неверный логин или пароль", session_expired: "Сессия завершена. Войдите снова", access_denied: "Недостаточно прав в выбранном кабинете", upstream_unavailable: "Сервис временно недоступен", section_not_connected: "Этот раздел пока недоступен" };
        throw Object.assign(new Error(labels[data.error] || data.error || "Ошибка сервера"), { status: res.status, code: data.error,
          retryAfterMs: parseRetryAfterMs(res.headers?.get("Retry-After")),
          ...(data.error === "student_import_validation" && Array.isArray(data.issues) ? {issues:data.issues} : {}),
        });
      }
      return data as T;
    } finally { clearTimeout(timer); pending.delete(controller); options.signal?.removeEventListener("abort", abort); }
  };
  const mutation = options.method && options.method !== "GET" && !path.startsWith("/auth/");
  return mutation && navigator.locks ? navigator.locks.request("cpm-bff-context", { mode: "shared" }, run) : run();
}
export function bffRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(path, options, false);
}
/** Protected downloads retain the same cookie, live context fence and abort policy. */
export function bffBlobRequest(path: string, options: RequestInit = {}): Promise<Blob> {
  return request<Blob>(path, options, true);
}
export async function domain<T>(path: string, options: RequestInit = {}): Promise<T> {
  return (await bffRequest<{status: true; data: T}>(path, options)).data;
}
