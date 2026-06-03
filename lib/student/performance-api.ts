import { apiRequest } from "@/lib/api/client";
import type { MyRatingResponse, RatingMetric } from "./performance-types";

export async function fetchMyRating(): Promise<MyRatingResponse> {
  return apiRequest<MyRatingResponse>("/my-rating");
}

export function formatRatingValue(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) {
    return "—";
  }

  const numeric = Number(value);
  return numeric % 1 === 0 ? String(numeric) : numeric.toFixed(1);
}

export function ratingToPercent(
  value: number | null | undefined,
  max = 5,
): number {
  if (value == null || Number.isNaN(Number(value))) {
    return 0;
  }

  return Math.min(100, Math.max(0, (Number(value) / max) * 100));
}

export function formatRatingPeriod(
  dateFrom?: string,
  dateTo?: string,
): string | null {
  if (!dateFrom && !dateTo) {
    return null;
  }

  const format = (value?: string) => {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const from = format(dateFrom);
  const to = format(dateTo);

  if (from && to) {
    return `${from} — ${to}`;
  }

  return from ?? to;
}

export function buildRatingMetrics(
  data: MyRatingResponse["data"],
): RatingMetric[] {
  return [
    {
      id: "homework",
      label: "Домашние задания",
      description: "Средний балл по домашке",
      value: data?.homework?.rating ?? null,
      accent: "#22c55e",
      accentSoft: "rgba(34, 197, 94, 0.14)",
    },
    {
      id: "exams",
      label: "Экзамены",
      description: "Средний балл по экзаменам",
      value: data?.exams?.rating ?? null,
      accent: "#8b5cf6",
      accentSoft: "rgba(139, 92, 246, 0.14)",
    },
    {
      id: "tests",
      label: "Тесты",
      description: "Средний балл по тестам",
      value: data?.tests?.rating ?? null,
      accent: "var(--ds-accent)",
      accentSoft: "var(--ds-accent-soft)",
    },
  ];
}

export function calculateAverageRating(
  data: MyRatingResponse["data"],
): number | null {
  if (!data) {
    return null;
  }

  const values = [data.homework?.rating, data.exams?.rating, data.tests?.rating]
    .map((value) => (value == null ? null : Number(value)))
    .filter((value): value is number => value != null && !Number.isNaN(value));

  if (values.length === 0) {
    return null;
  }

  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}
