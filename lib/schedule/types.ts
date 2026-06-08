import type { ScheduleDay } from "./constants";

export interface ScheduleLesson {
  _id: string;
  day_of_week: ScheduleDay | string;
  start_time: string;
  end_time: string;
  lesson_name: string;
  teacher_name: string;
  location: string;
  created_at?: string;
  updated_at?: string;
}

export interface ScheduleLessonFormData {
  day_of_week: ScheduleDay;
  start_time: string;
  end_time: string;
  lesson_name: string;
  teacher_name: string;
  location: string;
}

export interface ScheduleListResponse {
  status: boolean;
  message?: string;
  error?: string;
  schedule?: ScheduleLesson[];
}

export interface ScheduleMutationResponse {
  status: boolean;
  message?: string;
  error?: string;
  lesson_id?: string;
}
