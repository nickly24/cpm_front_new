import type { ZapDateStatus, ZapDatesSummaryCounts } from "@/lib/zaps/zaps-types";
import { getZapRequestStatusLabel } from "@/lib/zaps/zap-date-utils";

export function zapStatusLabel(status: string): string {
  return getZapRequestStatusLabel(status);
}

export function canRetryZapDate(
  zapStatus: string,
  dateStatus: ZapDateStatus,
): boolean {
  return (
    zapStatus === "apr" &&
    (dateStatus === "no_class_day" || dateStatus === "failed")
  );
}

export function formatZapDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatZapDateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function truncateText(text: string, max = 100): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export function formatZapDatesSummary(
  summary: ZapDatesSummaryCounts | string | null | undefined,
): string | null {
  if (!summary) return null;
  if (typeof summary === "string") {
    const trimmed = summary.trim();
    return trimmed || null;
  }

  const total = summary.total_count ?? 0;
  if (total <= 0) return null;

  const linked = summary.linked_count ?? 0;
  const pending = summary.pending_count ?? 0;
  const failed =
    (summary.no_class_day_count ?? 0) + (summary.failed_count ?? 0);

  if (pending > 0 && linked === 0) {
    return `${total} ${total === 1 ? "дата" : total < 5 ? "даты" : "дат"}, на рассмотрении`;
  }

  if (linked > 0 && failed > 0) {
    return `Учтено ${linked} из ${total}`;
  }

  if (linked > 0) {
    return `Учтено ${linked} из ${total}`;
  }

  if (failed > 0) {
    return `Не учтено ${failed} из ${total}`;
  }

  return `${total} ${total === 1 ? "дата" : total < 5 ? "даты" : "дат"}`;
}

export function zapListDatesHint(item: {
  linked_count?: number;
  total_count?: number;
  dates_summary?: ZapDatesSummaryCounts | string | null;
  dates_summary_label?: string | null;
}): string | null {
  if (item.dates_summary_label?.trim()) {
    return item.dates_summary_label.trim();
  }

  const fromSummary = formatZapDatesSummary(item.dates_summary);
  if (fromSummary) return fromSummary;

  if (
    item.linked_count != null &&
    item.total_count != null &&
    item.total_count > 0
  ) {
    return `Учтено ${item.linked_count} из ${item.total_count}`;
  }

  if (item.total_count != null && item.total_count > 0) {
    return `${item.total_count} дат`;
  }

  return null;
}

