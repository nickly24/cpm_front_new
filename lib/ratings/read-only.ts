import type { RatingFreshness } from "./freshness";

/** Absence of one participant is different from absence of a published version. */
export function ratingPublicationState(
  hasRating: boolean,
  freshness?: RatingFreshness | null,
): "published" | "never_calculated" | "not_in_publication" {
  if (hasRating) return "published";
  return freshness?.reason === "never_calculated"
    ? "never_calculated"
    : "not_in_publication";
}

export function formatPublishedScore(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("ru-RU", { maximumFractionDigits: 6 });
}

export function ratingSnapshotDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ru-RU");
}
