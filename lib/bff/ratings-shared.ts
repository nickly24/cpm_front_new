import { domain, getIdentity } from "./client";
import type { RatingFreshness } from "@/lib/ratings/freshness";
import type { AdminRatingRow, RatingDetails, RatingRecalcJob, RatingRecalcStatus } from "@/lib/admin/admin-ratings-types";
import type { RatingsReportColumn, RatingsReportResponse, RatingsReportValue } from "@/lib/admin/ratings-report-types";

export interface RatingsSourceFreshness {
  is_stale: boolean;
  reason: string;
  version_id?: string;
  revision?: number;
  as_of?: string;
  exams_mode?: string;
  external_tests_mode?: string;
}
export interface PublishedRating {
  profile: {
    account_id: number;
    profile_id: number;
    full_name: string;
    class: string | number | null;
    group_id: number | null;
    group_name: string | null;
    school_id: number | null;
    school_name: string | null;
    school_short_name: string | null;
    is_active: boolean;
  };
  rating: {
    job_id: string;
    revision: number;
    account_id: number;
    organization_id: number;
    division_id: number;
    algorithm_version: string;
    status: "ready";
    input_hash: string;
    homework: RatingDetails["homework"];
    exams: RatingDetails["exams"];
    tests: RatingDetails["tests"];
    final_rating: number;
  };
  place: number;
}
export type PublishedRatingSummary = Omit<PublishedRating, "rating"> & { rating: Omit<PublishedRating["rating"], "homework" | "exams" | "tests"> & {
  homework: { rating: number }; exams: { rating: number }; tests: { rating: number };
} };
export interface RatingsPublishedResponse { ratings: PublishedRating[]; total: number; freshness: RatingsSourceFreshness }
export interface RatingsOwnResponse { rating: PublishedRating | null; freshness: RatingsSourceFreshness }
export interface RatingsOwnerJob {
  id: string; revision: number; status: RatingRecalcStatus; date_from: string; date_to: string;
  as_of: string; created_by: number; total_count: number; processed_count: number;
  error_code: string; attempts: number; created_at: string; completed_at: string | null;
}
export const activeRatingStatuses: readonly RatingRecalcStatus[] = ["preparing", "waiting_sources", "queued", "running", "validating"];
export const isActiveRatingJob = (job: Pick<RatingRecalcJob, "status">) => activeRatingStatuses.includes(job.status);

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  try { return await domain<T>(path, options); }
  catch (error) {
    if (error instanceof Error && "code" in error && typeof error.code === "string") { const label = ratingErrorMessage(error.code); if (label !== error.code) error.message = label; }
    throw error;
  }
}
function query(path: string, params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") q.set(key, String(value));
  return `/ratings/${path}${q.size ? `?${q}` : ""}`;
}
export function ratingsPublished(filters: { version?: string; q?: string; limit?: number; offset?: number } = {}, signal?: AbortSignal) {
  return request<RatingsPublishedResponse>(query("ratings", filters), { signal });
}
export function ratingsOwn(version?: string, signal?: AbortSignal) {
  return request<RatingsOwnResponse>(query("me", { version }), { signal });
}
export function ratingsAccount(accountId: number, version?: string, signal?: AbortSignal) {
  if (!Number.isSafeInteger(accountId) || accountId < 1) throw new Error("Некорректный ID аккаунта");
  return request<RatingsOwnResponse>(query(`accounts/${accountId}`, { version }), { signal });
}
export function mapRatingJob(v: RatingsOwnerJob): RatingRecalcJob {
  if (!v || typeof v.id !== "string" || !/^[0-9a-f-]{36}$/i.test(v.id) ||
      ![...activeRatingStatuses, "completed", "failed", "cancelled", "superseded"].includes(v.status) ||
      !Number.isSafeInteger(v.revision) || v.revision < 1 || !Number.isSafeInteger(v.total_count) || v.total_count < 0 ||
      !Number.isSafeInteger(v.processed_count) || v.processed_count < 0 || typeof v.date_from !== "string" || typeof v.date_to !== "string")
    throw new Error("Сервис вернул некорректную задачу пересчёта рейтинга");
  return { id: v.id, revision: v.revision, status: v.status, date_from: v.date_from, date_to: v.date_to,
    as_of: v.as_of, created_by: v.created_by, created_by_name: null, created_at: v.created_at,
    started_at: null, completed_at: v.completed_at, total_students: v.total_count, processed_count: v.processed_count,
    error_code: v.error_code, message: v.error_code ? ratingErrorMessage(v.error_code) : null, errors: null,
    progress_percent: v.total_count ? Math.min(100, Math.max(0, v.processed_count / v.total_count * 100)) : 0 };
}
export async function ratingsJobs(limit = 50, offset = 0, signal?: AbortSignal): Promise<RatingRecalcJob[]> {
  const data = await request<{ jobs: RatingsOwnerJob[] }>(query("jobs", { limit, offset }), { signal });
  return data.jobs.map(mapRatingJob);
}
export async function ratingsJob(id: string | number, signal?: AbortSignal): Promise<RatingRecalcJob> {
  const data = await request<RatingsOwnerJob>(query(`jobs/${encodeURIComponent(id)}`, {}), { signal });
  return mapRatingJob(data);
}
export async function ratingsVersions(signal?: AbortSignal): Promise<RatingRecalcJob[]> {
  const data = await request<{ versions: RatingsOwnerJob[] }>("/ratings/versions", { signal });
  return data.versions.map(mapRatingJob);
}
export function mapRatingFreshness(v: RatingsSourceFreshness): RatingFreshness {
  const known = ["never_calculated", "source_snapshot_invalid", "source_unavailable", "source_changed", "calendar_transition"];
  return { scope: "ratings", isStale: v.is_stale, reason: known.includes(v.reason) ? v.reason as RatingFreshness["reason"] : null,
    activeJobId: null, versionId: v.version_id, calculatedRevision: v.revision, asOf: v.as_of,
    examsMode: v.exams_mode, externalTestsMode: v.external_tests_mode };
}
function verifyPublished(row: PublishedRatingSummary) {
  if (!Number.isSafeInteger(row.profile.account_id) || row.profile.account_id < 1 || row.rating.account_id !== row.profile.account_id ||
    row.rating.status !== "ready" || !Number.isSafeInteger(row.place) || row.place < 1 ||
    ![row.rating.final_rating, row.rating.homework.rating, row.rating.exams.rating, row.rating.tests.rating].every(Number.isFinite))
    throw new Error("Сервис вернул некорректную опубликованную версию рейтинга");
}
export function mapRatingRow(row: PublishedRatingSummary): AdminRatingRow {
  verifyPublished(row);
  const { profile: p, rating: r } = row;
  return { id: p.account_id, student_id: p.account_id, place: row.place, version_id: r.job_id,
    student_name: p.full_name, student_class: p.class == null ? null : String(p.class), group_name: p.group_name,
    homework: r.homework.rating, exams: r.exams.rating, tests: r.tests.rating, final: r.final_rating };
}
export function mapRatingDetails(row: PublishedRating, period?: { date_from: string; date_to: string }): RatingDetails {
  verifyPublished(row);
  return { rating_id: row.profile.account_id, student_id: row.profile.account_id, date_from: period?.date_from ?? "", date_to: period?.date_to ?? "",
    final_rating: row.rating.final_rating, homework: row.rating.homework, exams: row.rating.exams, tests: row.rating.tests };
}
/** Pin all pages to the first published version so a concurrent publication cannot mix versions. */
export async function ratingsAllPublished(version?: string, signal?: AbortSignal): Promise<RatingsPublishedResponse> {
  const scope = getIdentity()?.user;
  const first = await ratingsPublished({ version, limit: 200, offset: 0 }, signal);
  const pinned = version ?? first.freshness.version_id;
  if (!Number.isSafeInteger(first.total) || first.total < 0 || !Array.isArray(first.ratings))
    throw new Error("Сервис вернул некорректную опубликованную версию рейтинга");
  if (first.total > 100200) throw new Error("Рейтинг слишком велик для полного отчёта");
  const rows: PublishedRating[] = [], accounts = new Set<number>();
  const append = (page: RatingsPublishedResponse) => {
    if (!Array.isArray(page.ratings) || page.total !== first.total || page.ratings.length > 200 ||
        rows.length + page.ratings.length > first.total ||
        (pinned && page.freshness?.version_id !== pinned) || (!pinned && first.total > 0))
      throw new Error("Не удалось загрузить все строки одной опубликованной версии рейтинга");
    for (const row of page.ratings) {
      verifyPublished(row);
      if (row.rating.job_id !== pinned || accounts.has(row.profile.account_id) ||
          row.rating.organization_id !== scope?.organization_id || row.rating.division_id !== scope?.division_id)
        throw new Error("Сервис вернул строки другой версии или подразделения рейтинга");
      accounts.add(row.profile.account_id);
      rows.push(row);
    }
  };
  append(first);
  while (rows.length < first.total) {
    if (!pinned) throw new Error("Отсутствует ID опубликованной версии рейтинга");
    const page = await ratingsPublished({ version: pinned, limit: 200, offset: rows.length }, signal);
    if (!page.ratings.length || page.total !== first.total) throw new Error("Не удалось загрузить все строки опубликованного рейтинга");
    append(page);
  }
  return { ...first, ratings: rows };
}

export function mapRatingsReport(data: { period: { date_from: string; date_to: string } | null; students: PublishedRating[]; freshness: RatingsSourceFreshness }): RatingsReportResponse {
  const columns = new Map<string, RatingsReportColumn>();
  const values: RatingsReportValue[] = [];
  const add = (studentId: number, column: RatingsReportColumn, score: number, status?: string, details?: unknown) => {
    columns.set(column.key, column); values.push({ student_id: studentId, column_key: column.key, score, status, details });
  };
  const students = data.students.map(row => {
    verifyPublished(row);
    const { profile: p, rating: r } = row;
    for (const [key, label, score] of [["sum_homework", "ДЗ", r.homework.rating], ["sum_exams", "Экзамены", r.exams.rating], ["sum_tests", "Тесты", r.tests.rating], ["sum_final", "Итог", r.final_rating]] as const)
      add(p.account_id, { key, kind: "summary", label }, score);
    for (const h of r.homework.details) add(p.account_id, { key: `hw_${h.homework_id}`, kind: "homework", label: h.name, subtitle: h.deadline }, h.score, h.status, h);
    for (const e of r.exams.details) add(p.account_id, { key: `exam_${e.exam_id}`, kind: "exam", label: e.exam_name, subtitle: e.exam_date }, e.score,
      [e.status, e.exam_type === "classic" ? "Классический экзамен" : "Экзамен вне LMS", e.attempt_no === 2 ? "Пересдача" : "", e.has_appeal ? "После апелляции" : ""].filter(Boolean).join(" · "), e);
    for (const [direction, score] of Object.entries(r.tests.directions)) add(p.account_id, { key: `dir_${direction}`, kind: "test_direction", label: direction }, score);
    for (const t of r.tests.details) add(p.account_id, { key: `test_${t.source}_${t.test_id}`, kind: "test", label: t.title, group_key: `test_${t.direction}`, group_label: t.direction, subtitle: t.source === "external" ? "Внешний тест" : "Тест в системе" }, t.score, t.source, t);
    return { student_id: p.account_id, rating_id: p.account_id, place: row.place, full_name: p.full_name, class: p.class,
      group_id: p.group_id, group_name: p.group_name, school_id: p.school_id, school_name: p.school_name, school_short_name: p.school_short_name,
      homework: r.homework.rating, exams: r.exams.rating, tests: r.tests.rating, final: r.final_rating };
  });
  // Stable sections regardless of the first participant's individual detail order.
  const order = ["summary", "homework", "exam", "test_direction", "test"];
  return { status: true, period: data.period, students, columns: [...columns.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)), values,
    versionId: data.freshness.version_id, ratingFreshness: mapRatingFreshness(data.freshness) };
}
export async function ratingsReport(version?: string, signal?: AbortSignal): Promise<RatingsReportResponse> {
  const data = await request<{ period: { date_from: string; date_to: string } | null; students: PublishedRating[]; freshness: RatingsSourceFreshness }>(query("report", { version }), { signal });
  return mapRatingsReport(data);
}

export function ratingErrorMessage(code: string): string {
  const labels: Record<string, string> = {
    upstream_unavailable: "Сервис временно недоступен",
    dependency_unavailable: "Источник данных временно недоступен", ratings_storage_unavailable: "Хранилище рейтинга временно недоступно",
    job_not_retryable: "Эту задачу уже нельзя повторить", rating_staging_incomplete: "Не все результаты рассчитаны. Предыдущая публикация сохранена",
    not_found: "Данные не найдены в выбранном подразделении", cancelled_by_user: "Пересчёт отменён",
    rating_job_active: "В подразделении уже выполняется пересчёт", idempotency_conflict: "Этот запрос уже использован для другого периода",
    invalid_period: "Укажите корректный период продолжительностью не больше года", forbidden: "Недостаточно прав в выбранном кабинете",
    tests_calculation_pending: "Ожидаем завершения расчёта тестов", exams_not_connected: "Ожидаем подключения экзаменов",
    external_tests_not_connected: "Ожидаем подключения внешних тестов", rating_source_changed: "Исходные данные изменились. Подготовка повторится",
    source_changed_before_publication: "Исходные данные изменились до публикации. Запустите новый пересчёт",
    rating_already_published: "Рейтинг уже опубликован", calculation_timeout: "Истекло время ожидания расчёта",
    transport_error: "Ответ сервера не получен. Повторите тот же запрос, чтобы безопасно проверить его результат",
  };
  return labels[code] ?? code;
}

export interface RatingPendingCommand { path: string; body: { date_from: string; date_to: string } | Record<string, never>; key: string }
const memory = new Map<string, RatingPendingCommand>();
function commandScope(operation: string) {
  const u = getIdentity()?.user;
  if (!u?.account_id || !u.organization_id || !u.division_id) throw new Error("Выберите кабинет для пересчёта рейтинга");
  return `ratings-command:${u.account_id}:${u.organization_id}:${u.division_id}:${operation}`;
}
export function pendingRatingCommand(operation = "start"): RatingPendingCommand | null {
  let scope: string;
  try { scope = commandScope(operation); } catch { return null; }
  const existing = memory.get(scope); if (existing) return existing;
  if (typeof window === "undefined") return null;
  try { const text = window.sessionStorage.getItem(scope); if (!text) return null;
    const parsed = JSON.parse(text) as RatingPendingCommand;
    if (parsed.key && parsed.path === (operation === "start" ? "/ratings/jobs" : `/ratings/jobs/${operation.slice(6)}/retry`)) return parsed;
  } catch { /* The in-memory journal remains available when storage is blocked. */ }
  return null;
}
function saveCommand(operation: string, command: RatingPendingCommand | null) {
  const scope = commandScope(operation);
  if (command) memory.set(scope, command); else memory.delete(scope);
  if (typeof window !== "undefined") try {
    if (command) window.sessionStorage.setItem(scope, JSON.stringify(command)); else window.sessionStorage.removeItem(scope);
  } catch { /* Keep the same key in memory if session storage is unavailable. */ }
}
export function hasPendingRatingCommands(): boolean {
  let prefix: string;
  try { prefix = commandScope(""); } catch { return false; }
  if ([...memory.keys()].some(key => key.startsWith(prefix))) return true;
  if (typeof window === "undefined") return false;
  try { for (let i = 0; i < window.sessionStorage.length; i++) if (window.sessionStorage.key(i)?.startsWith(prefix)) return true; } catch { /* In-memory journal still applies. */ }
  return false;
}
export async function ratingsCommand(operation: string, path: string, body: RatingPendingCommand["body"]): Promise<RatingRecalcJob> {
  const old = pendingRatingCommand(operation);
  if (old && (old.path !== path || JSON.stringify(old.body) !== JSON.stringify(body))) throw new Error("Сначала повторите предыдущий запрос с тем же периодом");
  const command = old ?? { path, body, key: crypto.randomUUID() };
  saveCommand(operation, command);
  try {
    const response = await request<{ job: RatingsOwnerJob } | RatingsOwnerJob>(command.path, { method: "POST", headers: { "Idempotency-Key": command.key }, body: JSON.stringify(command.body) });
    const mapped = mapRatingJob("job" in response ? response.job : response);
    saveCommand(operation, null);
    return mapped;
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number(error.status) : undefined;
    if (status !== undefined && status > 0 && status < 500) saveCommand(operation, null);
    if (error instanceof Error && "code" in error && typeof error.code === "string") { const label = ratingErrorMessage(error.code); if (label !== error.code) error.message = label; }
    throw error;
  }
}
