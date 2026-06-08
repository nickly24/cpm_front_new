import { MONTH_NAMES_GENITIVE, WEEKDAY_FULL } from "@/lib/attendance/attendance-utils";
import type { ZapDateStatus } from "./zaps-types";

export const ZAP_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

export const ZAP_ATTACHMENT_ACCEPT =
  "image/jpeg,image/jpg,image/heic,application/pdf,.heic";

const ZAP_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/heic",
  "application/pdf",
]);

export function parseIsoDateLocal(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toIsoDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function expandDateRange(
  fromIso: string,
  toIso: string,
  options?: { excludeSundays?: boolean },
): string[] {
  const excludeSundays = options?.excludeSundays ?? true;
  const from = parseIsoDateLocal(fromIso);
  const to = parseIsoDateLocal(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return [];
  }

  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    if (!excludeSundays || cursor.getDay() !== 0) {
      dates.push(toIsoDateLocal(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function mergeUniqueDates(...groups: string[][]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const group of groups) {
    for (const iso of group) {
      if (!iso || seen.has(iso)) continue;
      seen.add(iso);
      result.push(iso);
    }
  }
  return result.sort();
}

export function formatZapDate(iso: string): string {
  const date = parseIsoDateLocal(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.getDate();
  const month = MONTH_NAMES_GENITIVE[date.getMonth()];
  const weekday = WEEKDAY_FULL[date.getDay()];
  return `${day} ${month}, ${weekday}`;
}

export function formatZapDateShort(iso: string): string {
  const date = parseIsoDateLocal(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

export function getZapDateStatusLabel(
  status: ZapDateStatus,
  statusLabel?: string,
): string {
  if (statusLabel?.trim()) return statusLabel.trim();
  switch (status) {
    case "linked":
      return "Учтено";
    case "no_class_day":
    case "failed":
      return "Не учтено";
    case "pending":
      return "На рассмотрении";
    case "cancelled":
      return "Отклонено";
    default:
      return status;
  }
}

export type ZapDateBadgeTone = "success" | "muted" | "warning" | "danger";

export function getZapDateBadgeTone(status: ZapDateStatus): ZapDateBadgeTone {
  switch (status) {
    case "linked":
      return "success";
    case "pending":
      return "warning";
    case "cancelled":
      return "danger";
    case "no_class_day":
    case "failed":
    default:
      return "muted";
  }
}

export function getZapRequestStatusLabel(status: string): string {
  switch (status) {
    case "set":
    case "pending":
      return "На рассмотрении";
    case "apr":
    case "approved":
      return "Одобрено";
    case "dec":
    case "declined":
    case "cancelled":
      return "Отклонено";
    default:
      return status;
  }
}

export function getZapRequestStatusTone(status: string): ZapDateBadgeTone {
  switch (status) {
    case "apr":
    case "approved":
      return "success";
    case "dec":
    case "declined":
    case "cancelled":
      return "danger";
    case "set":
    case "pending":
    default:
      return "warning";
  }
}

export function validateZapAttachment(file: File): string | null {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  const isHeic =
    mime === "image/heic" || name.endsWith(".heic") || name.endsWith(".heif");
  const isJpeg = mime === "image/jpeg" || mime === "image/jpg";
  const isPdf = mime === "application/pdf" || name.endsWith(".pdf");

  if (!isHeic && !isJpeg && !isPdf && !ZAP_ATTACHMENT_MIME_TYPES.has(mime)) {
    return "Поддерживаются только форматы JPG, HEIC и PDF";
  }

  if (file.size > ZAP_ATTACHMENT_MAX_BYTES) {
    return "Размер файла не должен превышать 5 МБ";
  }

  return null;
}

export function isPdfAttachment(
  fileType?: string,
  dataUrl?: string,
): boolean {
  const type = (fileType ?? "").toLowerCase();
  const url = (dataUrl ?? "").toLowerCase();
  return type.includes("pdf") || url.includes("application/pdf");
}
