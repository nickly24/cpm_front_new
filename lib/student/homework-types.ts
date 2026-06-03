export type HomeworkTypeFilter = "all" | "ОВ" | "ДЗНВ";
export type HomeworkStatusFilter = "all" | "done" | "undone";

export type HomeworkDeadlineState =
  | "submitted"
  | "pending"
  | "warning"
  | "danger"
  | "critical"
  | "unknown";

export interface StudentHomeworkItem {
  homework_id: number;
  homework_name: string;
  homework_type: string;
  deadline: string | null;
  status: string;
  result: number | null;
}

export interface HomeworkPagination {
  current_page: number;
  total_pages: number;
  total_items: number;
  items_per_page: number;
}

export interface StudentHomeworkResponse {
  status: boolean;
  res: StudentHomeworkItem[];
  pagination: HomeworkPagination | null;
}

export interface HomeworkSummary {
  total: number;
  submitted: number;
  pending: number;
}

export const HOMEWORK_TYPE_OPTIONS: Array<{
  value: HomeworkTypeFilter;
  label: string;
}> = [
  { value: "all", label: "Все типы" },
  { value: "ОВ", label: "ОВ" },
  { value: "ДЗНВ", label: "ДЗНВ" },
];

export const HOMEWORK_STATUS_OPTIONS: Array<{
  value: HomeworkStatusFilter;
  label: string;
}> = [
  { value: "all", label: "Все статусы" },
  { value: "done", label: "Сдано" },
  { value: "undone", label: "Не сдано" },
];

export const HOMEWORK_PAGE_SIZE = 12;
export const HOMEWORK_FETCH_LIMIT = 100;
