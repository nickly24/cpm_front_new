import { apiRequest } from "@/lib/api/client";
import { BFF_DEV } from "@/lib/config";
import { domain, getIdentity } from "@/lib/bff/client";
import { ratingsAllPublished, ratingsAccount, ratingsJob, ratingsJobs, ratingsVersions, ratingsCommand, isActiveRatingJob, mapRatingRow, mapRatingDetails, mapRatingFreshness, pendingRatingCommand } from "@/lib/bff/ratings-shared";
import type { RatingFreshness } from "@/lib/ratings/freshness";
import type { AdminRatingRow, RatingDetails, RatingRecalcJob } from "./admin-ratings-types";
export { pendingRatingCommand, isActiveRatingJob };

export async function fetchAdminRatings(version?: string, signal?: AbortSignal): Promise<{
  status: boolean; ratings: AdminRatingRow[]; total: number; ratingFreshness?: RatingFreshness;
}> {
  if (BFF_DEV) {
    const data = await ratingsAllPublished(version, signal);
    return { status: true, ratings: data.ratings.map(mapRatingRow), total: data.total, ratingFreshness: mapRatingFreshness(data.freshness) };
  }
  return apiRequest("/get-all-ratings");
}
export async function fetchRatingDetails(ratingId: number, version?: string, signal?: AbortSignal): Promise<{ status: boolean; details: RatingDetails; ratingFreshness?: RatingFreshness }> {
  if (BFF_DEV) {
    const data = await ratingsAccount(ratingId, version, signal);
    if (!data.rating) throw new Error("Рейтинг ещё не опубликован");
    const job = await ratingsJob(data.rating.rating.job_id, signal);
    return { status: true, details: mapRatingDetails(data.rating, job), ratingFreshness: mapRatingFreshness(data.freshness) };
  }
  return apiRequest("/get-rating-details", { method: "POST", body: JSON.stringify({ rating_id: ratingId }) });
}
export async function startRatingRecalc(payload: { date_from: string; date_to: string }): Promise<{ status: boolean; message?: string; job: RatingRecalcJob }> {
  if (BFF_DEV) return { status: true, job: await ratingsCommand("start", "/ratings/jobs", payload) };
  return apiRequest("/calculate-all-ratings", { method: "POST", body: JSON.stringify(payload) });
}
export async function fetchRatingRecalcJobs(limit = 50, offset = 0, signal?: AbortSignal): Promise<{
  status: boolean; jobs: RatingRecalcJob[]; active_job_id: number | string | null; total: number;
}> {
  if (BFF_DEV) {
    const jobs = await ratingsJobs(limit, offset, signal);
    return { status: true, jobs, active_job_id: jobs.find(isActiveRatingJob)?.id ?? null, total: jobs.length };
  }
  return apiRequest(`/rating-recalc-jobs?limit=${limit}`);
}
export async function fetchRatingRecalcJob(jobId: number | string): Promise<{ status: boolean; job: RatingRecalcJob }> {
  if (BFF_DEV) return { status: true, job: await ratingsJob(jobId) };
  return apiRequest(`/rating-recalc-jobs/${jobId}`);
}
export async function fetchRatingVersions(signal?: AbortSignal) { return BFF_DEV ? ratingsVersions(signal) : []; }
export async function cancelRatingRecalcJob(jobId: string | number) {
  if (!BFF_DEV) throw new Error("Отмена пересчёта недоступна");
  await domain(`/ratings/jobs/${encodeURIComponent(jobId)}/cancel`, { method: "POST", body: "{}" });
}
export async function retryRatingRecalcJob(jobId: string | number): Promise<RatingRecalcJob> {
  if (!BFF_DEV) throw new Error("Повтор пересчёта недоступен");
  return ratingsCommand(`retry:${jobId}`, `/ratings/jobs/${encodeURIComponent(jobId)}/retry`, {});
}

export interface RatingPublication { version_id: string; revision: number; as_of: string; date_from: string; date_to: string }
export interface AdminRatingPage { ratings: AdminRatingRow[]; total: number; publication: RatingPublication | null }
export async function fetchAdminRatingPage(filters: { version?: string; q?: string; limit: number; offset: number }, signal: AbortSignal): Promise<AdminRatingPage> {
  if (!BFF_DEV) {
    const result = await fetchAdminRatings(undefined, signal);
    const q = filters.q?.trim().toLowerCase() ?? "";
    const rows = result.ratings.filter(row => !q || [row.student_name, row.group_name, row.student_class, String(row.student_id)].some(v => v?.toLowerCase().includes(q)));
    return { ratings: rows, total: rows.length, publication: null };
  }
  const scope = getIdentity()?.user;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") query.set(key, String(value));
  const data = await domain<{ ratings: import("@/lib/bff/ratings-shared").PublishedRatingSummary[]; total: number; publication: RatingPublication | null }>(`/ratings/table?${query}`, { signal });
  if (!Number.isSafeInteger(data.total) || data.total < 0 || !Array.isArray(data.ratings) || data.ratings.length > filters.limit || (data.ratings.length > 0 && filters.offset + data.ratings.length > data.total) ||
      (data.publication !== null && (!data.publication || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(data.publication.version_id) || !Number.isSafeInteger(data.publication.revision) || data.publication.revision < 1)) ||
      (data.total > 0 && !data.publication) || (filters.version && data.publication?.version_id !== filters.version)) throw new Error("Сервис вернул некорректную страницу рейтинга");
  const seen = new Set<number>();
  for (const row of data.ratings) {
    if (row.rating.job_id !== data.publication?.version_id || row.rating.organization_id !== scope?.organization_id || row.rating.division_id !== scope?.division_id || seen.has(row.profile.account_id))
      throw new Error("Сервис вернул строки другой версии или подразделения рейтинга");
    seen.add(row.profile.account_id);
  }
  return { ...data, ratings: data.ratings.map(mapRatingRow) };
}
export async function fetchAdminRatingFreshness(version: string | undefined, signal: AbortSignal): Promise<RatingFreshness | null> {
  if (!BFF_DEV) return null;
  const query = version ? `?version=${encodeURIComponent(version)}` : "";
  const data = await domain<{ freshness: import("@/lib/bff/ratings-shared").RatingsSourceFreshness }>(`/ratings/freshness${query}`, { signal });
  if (version && data.freshness.version_id !== version) throw new Error("Изменилась версия рейтинга");
  return mapRatingFreshness(data.freshness);
}
