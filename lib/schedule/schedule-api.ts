import { apiRequest } from "@/lib/api/client";
import type {
  ScheduleLessonFormData,
  ScheduleListResponse,
  ScheduleMutationResponse,
} from "./types";

export async function fetchSchedule(): Promise<ScheduleListResponse> {
  return apiRequest<ScheduleListResponse>("/api/schedule");
}

export async function createScheduleLesson(
  payload: ScheduleLessonFormData,
): Promise<ScheduleMutationResponse> {
  return apiRequest<ScheduleMutationResponse>("/api/schedule", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateScheduleLesson(
  lessonId: string,
  payload: ScheduleLessonFormData,
): Promise<ScheduleMutationResponse> {
  return apiRequest<ScheduleMutationResponse>(`/api/schedule/${lessonId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteScheduleLesson(
  lessonId: string,
): Promise<ScheduleMutationResponse> {
  return apiRequest<ScheduleMutationResponse>(`/api/schedule/${lessonId}`, {
    method: "DELETE",
  });
}
