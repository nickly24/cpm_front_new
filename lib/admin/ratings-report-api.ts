import { apiRequest } from "@/lib/api/client";
import { BFF_DEV } from "@/lib/config";
import { ratingsReport } from "@/lib/bff/ratings-shared";
import type { RatingsReportResponse } from "@/lib/admin/ratings-report-types";
export async function fetchRatingsReport(version?: string, signal?: AbortSignal): Promise<RatingsReportResponse> {
  if (BFF_DEV) return ratingsReport(version, signal);
  return apiRequest<RatingsReportResponse>("/ratings-report");
}
