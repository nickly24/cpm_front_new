export interface ScheduleLesson {
  _id: string;
  date: string;
  start_time: string;
  end_time: string;
  lesson_name: string;
  teacher_name: string;
  location: string;
  classroom: string;
  color: string;
  is_changed: boolean;
  is_public: boolean;
  school_id: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface ScheduleLessonFormData {
  date: string;
  start_time: string;
  end_time: string;
  lesson_name: string;
  teacher_name: string;
  location: string;
  classroom: string;
  color: string;
  is_changed: boolean;
  is_public: boolean;
  school_id: number | null;
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

export type CalendarViewMode = "day" | "week" | "month";
