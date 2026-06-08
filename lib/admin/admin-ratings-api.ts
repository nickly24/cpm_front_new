import { apiRequest } from "@/lib/api/client";
import type {
  AdminRatingRow,
  RatingDetails,
  RatingRecalcJob,
} from "./admin-ratings-types";

export async function fetchAdminRatings(): Promise<{
  status: boolean;
  ratings: AdminRatingRow[];
  total: number;
}> {
  return apiRequest("/get-all-ratings");
}

export async function fetchRatingDetails(
  ratingId: number,
): Promise<{ status: boolean; details: RatingDetails }> {
  return apiRequest("/get-rating-details", {
    method: "POST",
    body: JSON.stringify({ rating_id: ratingId }),
  });
}

export async function startRatingRecalc(payload: {
  date_from: string;
  date_to: string;
}): Promise<{ status: boolean; message?: string; job: RatingRecalcJob }> {
  return apiRequest("/calculate-all-ratings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchRatingRecalcJobs(limit = 50): Promise<{
  status: boolean;
  jobs: RatingRecalcJob[];
  active_job_id: number | null;
  total: number;
}> {
  return apiRequest(`/rating-recalc-jobs?limit=${limit}`);
}

export async function fetchRatingRecalcJob(
  jobId: number,
): Promise<{ status: boolean; job: RatingRecalcJob }> {
  return apiRequest(`/rating-recalc-jobs/${jobId}`);
}
