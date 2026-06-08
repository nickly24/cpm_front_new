import { apiRequest } from "@/lib/api/client";
import type { RatingsReportResponse } from "@/lib/admin/ratings-report-types";

export async function fetchRatingsReport(): Promise<RatingsReportResponse> {
  return apiRequest<RatingsReportResponse>("/ratings-report");
}
