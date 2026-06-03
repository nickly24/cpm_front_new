import { apiRequest } from "@/lib/api/client";
import type {
  HomeworkDeadlineState,
  HomeworkStatusFilter,
  HomeworkSummary,
  HomeworkTypeFilter,
  StudentHomeworkItem,
  StudentHomeworkResponse,
} from "./homework-types";

interface FetchStudentHomeworkParams {
  page?: number;
  limit?: number;
  type?: HomeworkTypeFilter;
}

export async function fetchStudentHomework(
  params: FetchStudentHomeworkParams = {},
): Promise<StudentHomeworkResponse> {
  const searchParams = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 100),
  });

  if (params.type && params.type !== "all") {
    searchParams.set("type", params.type);
  }

  return apiRequest<StudentHomeworkResponse>(
    `/api/homeworks/student-with-sessions?${searchParams.toString()}`,
  );
}

export function isHomeworkSubmitted(item: StudentHomeworkItem): boolean {
  return item.status.includes("сдано");
}

export function filterHomeworkByStatus(
  items: StudentHomeworkItem[],
  statusFilter: HomeworkStatusFilter,
): StudentHomeworkItem[] {
  if (statusFilter === "all") {
    return items;
  }

  return items.filter((item) => {
    const submitted = isHomeworkSubmitted(item);
    return statusFilter === "done" ? submitted : !submitted;
  });
}

export function buildHomeworkSummary(
  items: StudentHomeworkItem[],
): HomeworkSummary {
  const submitted = items.filter(isHomeworkSubmitted).length;

  return {
    total: items.length,
    submitted,
    pending: items.length - submitted,
  };
}

export function getHomeworkDeadlineState(
  item: StudentHomeworkItem,
): HomeworkDeadlineState {
  if (isHomeworkSubmitted(item)) {
    return "submitted";
  }

  if (!item.deadline) {
    return "unknown";
  }

  const deadline = new Date(item.deadline);
  if (Number.isNaN(deadline.getTime())) {
    return "unknown";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays > 0) {
    return "pending";
  }

  if (diffDays >= -5) {
    return "warning";
  }

  if (diffDays >= -20) {
    return "danger";
  }

  return "critical";
}

export function formatHomeworkDate(value: string | null): string {
  if (!value) {
    return "Без дедлайна";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatHomeworkScore(value: number | null): string | null {
  if (value == null || Number.isNaN(Number(value))) {
    return null;
  }

  return String(Math.round(Number(value)));
}

export function getDeadlineHint(state: HomeworkDeadlineState): string {
  switch (state) {
    case "submitted":
      return "Задание сдано";
    case "pending":
      return "Дедлайн ещё не наступил";
    case "warning":
      return "Небольшая просрочка";
    case "danger":
      return "Просрочено";
    case "critical":
      return "Сильная просрочка";
    default:
      return "Дедлайн не указан";
  }
}

export function paginateHomework<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    totalPages,
    currentPage: safePage,
    totalItems: items.length,
  };
}
