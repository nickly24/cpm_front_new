import type { ScanHistoryItem } from "./attendance-types";

const SCAN_HISTORY_KEY = "cpm-scan-history";
const SCAN_DAY_KEY = "cpm-scan-class-day-id";
const MAX_ITEMS = 12;

function historyKey(entry: Pick<ScanHistoryItem, "studentId" | "classDayId">): string {
  return `${entry.classDayId ?? 0}:${entry.studentId}`;
}

function normalizeScanHistory(items: ScanHistoryItem[]): ScanHistoryItem[] {
  const seen = new Set<string>();
  const normalized: ScanHistoryItem[] = [];

  for (const item of items) {
    const key = historyKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(item);
  }

  return normalized.slice(0, MAX_ITEMS);
}

export function loadScanHistory(): ScanHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SCAN_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScanHistoryItem[];
    if (!Array.isArray(parsed)) return [];
    const normalized = normalizeScanHistory(parsed);
    if (normalized.length !== parsed.length) {
      saveScanHistory(normalized);
    }
    return normalized;
  } catch {
    return [];
  }
}

export function saveScanHistory(items: ScanHistoryItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    SCAN_HISTORY_KEY,
    JSON.stringify(normalizeScanHistory(items).slice(0, MAX_ITEMS)),
  );
}

export function upsertScanHistory(item: ScanHistoryItem): ScanHistoryItem[] {
  const key = historyKey(item);
  const previous = loadScanHistory().filter((entry) => historyKey(entry) !== key);
  const next = normalizeScanHistory([item, ...previous]);
  saveScanHistory(next);
  return next;
}

/** @deprecated use upsertScanHistory */
export function appendScanHistory(item: ScanHistoryItem): ScanHistoryItem[] {
  return upsertScanHistory(item);
}

export function clearScanHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SCAN_HISTORY_KEY);
}

export function loadSelectedScanDayId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(SCAN_DAY_KEY);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function saveSelectedScanDayId(classDayId: number | null): void {
  if (typeof window === "undefined") return;
  if (classDayId == null) {
    sessionStorage.removeItem(SCAN_DAY_KEY);
    return;
  }
  sessionStorage.setItem(SCAN_DAY_KEY, String(classDayId));
}

export function syncScanDaySelection(classDayId: number): void {
  saveSelectedScanDayId(classDayId);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("cpm-scan-day-changed", {
      detail: { classDayId },
    }),
  );
}

export function parseClassDayPeriod(date: string): { year: number; month: number } | null {
  const [yearRaw, monthRaw] = date.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }
  return { year, month };
}

export function getScanHistoryItemKey(item: ScanHistoryItem): string {
  return `${historyKey(item)}:${item.date}`;
}
