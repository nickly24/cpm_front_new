import { apiRequest } from "@/lib/api/client";
import {
  deleteClassDayAttendance,
  setClassDayAttendance,
} from "@/lib/attendance/attendance-api";
import type { AttendanceReportResponse } from "@/lib/attendance/attendance-report-types";
import type { ZapDateItem } from "@/lib/zaps/zaps-types";

export { deleteClassDayAttendance, setClassDayAttendance };

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function fetchAttendanceReport(
  dateFrom: string,
  dateTo: string,
): Promise<AttendanceReportResponse> {
  return apiRequest<AttendanceReportResponse>(
    `/api/attendance-report${buildQuery({
      date_from: dateFrom,
      date_to: dateTo,
    })}`,
  );
}

export interface UnlinkZapDateResponse {
  status: boolean;
  error?: string;
  message?: string;
  zap_date?: ZapDateItem;
}

export async function unlinkZapDate(
  zapDateId: number,
): Promise<UnlinkZapDateResponse> {
  return apiRequest<UnlinkZapDateResponse>(
    `/api/zap-dates/${zapDateId}/unlink`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}
