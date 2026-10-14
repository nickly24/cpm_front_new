import { BFF_DEV } from "@/lib/config";
import type { HomeworkUploadLimits, HomeworkWorkspace } from "./types";

/** Validate an accepted owner snapshot; an unknown snapshot must never become today's policy. */
export function homeworkUploadLimits(value: unknown): HomeworkUploadLimits | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  for (const field of ["max_source_bytes", "max_output_bytes", "max_pages", "dpi", "jpeg_quality"]) {
    if (typeof row[field] !== "number" || !Number.isSafeInteger(row[field]) || row[field] < 1) return null;
  }
  if ((row.jpeg_quality as number) > 100) return null;
  return { max_source_bytes: row.max_source_bytes as number, max_output_bytes: row.max_output_bytes as number, max_pages: row.max_pages as number, dpi: row.dpi as number, jpeg_quality: row.jpeg_quality as number };
}
/** Legacy fallback stays confined to the unchanged production workspace contract. */
export function homeworkWorkspaceLimits(value: HomeworkWorkspace["limits"]): HomeworkUploadLimits | null {
  if (BFF_DEV) return homeworkUploadLimits(value);
  return { max_source_bytes: value?.max_source_bytes ?? value?.max_bytes ?? 10 * 1048576, max_output_bytes: value?.max_output_bytes ?? 10 * 1048576, max_pages: value?.max_pages ?? 35, dpi: value?.dpi ?? 120, jpeg_quality: value?.jpeg_quality ?? 75 };
}
export const homeworkMiB = (bytes: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(bytes / 1048576);
