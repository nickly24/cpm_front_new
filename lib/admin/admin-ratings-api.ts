import { apiRequest } from "@/lib/api/client";
import { BFF_DEV } from "@/lib/config";
import { domain } from "@/lib/bff/client";
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
