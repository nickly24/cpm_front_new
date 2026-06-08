import { apiRequest } from "@/lib/api/client";
import type {
  AttendanceType,
  ClassDay,
  ClassDayAttendanceItem,
  StudentBrief,
  StudentClassDayAttendanceItem,
} from "./attendance-types";

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function fetchAttendanceTypes(): Promise<AttendanceType[]> {
  const data = await apiRequest<{ status: boolean; types?: AttendanceType[] }>(
    "/api/attendance-types",
  );
  return data.status && data.types ? data.types : [];
}

export type AttendanceSetAction = "created" | "updated" | "unchanged";

export interface AttendanceSetResult {
  status: boolean;
  error?: string;
  action?: AttendanceSetAction;
}

export async function fetchClassDays(
  dateFrom?: string,
  dateTo?: string,
): Promise<ClassDay[]> {
  const data = await apiRequest<{ status: boolean; class_days?: ClassDay[] }>(
    `/api/class-days${buildQuery({ date_from: dateFrom, date_to: dateTo })}`,
  );
  return data.status && data.class_days ? data.class_days : [];
}

export async function fetchClassDay(classDayId: number): Promise<ClassDay | null> {
  const data = await apiRequest<{ status: boolean; class_day?: ClassDay }>(
    `/api/class-days/${classDayId}`,
  );
  return data.status && data.class_day ? data.class_day : null;
}

export async function createClassDay(payload: {
  date: string;
  comment?: string;
}): Promise<{ status: boolean; id?: number; error?: string; already_existed?: boolean }> {
  return apiRequest("/api/class-days", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateClassDay(
  classDayId: number,
  payload: { date: string; comment?: string },
): Promise<{ status: boolean; id?: number; error?: string }> {
  return apiRequest(`/api/class-days/${classDayId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteClassDay(
  classDayId: number,
): Promise<{ status: boolean; error?: string }> {
  return apiRequest(`/api/class-days/${classDayId}`, { method: "DELETE" });
}

export async function fetchClassDayAttendance(
  classDayId: number,
): Promise<ClassDayAttendanceItem[]> {
  const data = await apiRequest<{
    status: boolean;
    attendance?: ClassDayAttendanceItem[];
  }>(`/api/class-days/${classDayId}/attendance`);
  return data.status && data.attendance ? data.attendance : [];
}

export async function setClassDayAttendance(
  classDayId: number,
  payload: {
    student_id: number;
    attendance_type_id: number;
    zap_id?: number | null;
  },
): Promise<AttendanceSetResult> {
  return apiRequest(`/api/class-days/${classDayId}/attendance`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteClassDayAttendance(
  classDayId: number,
  attendanceId: number,
): Promise<{ status: boolean; error?: string }> {
  return apiRequest(
    `/api/class-days/${classDayId}/attendance/${attendanceId}`,
    { method: "DELETE" },
  );
}

export async function fetchStudentClassDayAttendance(
  studentId: number,
  dateFrom?: string,
  dateTo?: string,
): Promise<StudentClassDayAttendanceItem[]> {
  const data = await apiRequest<{
    status: boolean;
    attendance?: StudentClassDayAttendanceItem[];
  }>(
    `/api/students/${studentId}/class-day-attendance${buildQuery({
      date_from: dateFrom,
      date_to: dateTo,
    })}`,
  );
  return data.status && data.attendance ? data.attendance : [];
}

export async function fetchStudentBrief(
  studentId: string | number,
): Promise<StudentBrief | null> {
  const data = await apiRequest<{
    status: boolean;
    data?: StudentBrief;
  }>("/api/get-class-name-by-studID", {
    method: "POST",
    body: JSON.stringify({ student_id: String(studentId) }),
  });
  return data.status && data.data ? data.data : null;
}

export async function markInPersonAttendance(
  classDayId: number,
  studentId: string | number,
): Promise<AttendanceSetResult> {
  return setClassDayAttendance(classDayId, {
    student_id: Number(studentId),
    attendance_type_id: 1,
  });
}

export async function fetchZapById(zapId: number): Promise<{
  status: boolean;
  zap?: {
    id: number;
    student_id: number;
    text: string;
    status: string;
    answer?: string | null;
  };
  images?: Array<{ img_base64?: string; file_type?: string }>;
  error?: string;
}> {
  return apiRequest(`/api/get-zap/${zapId}`);
}
