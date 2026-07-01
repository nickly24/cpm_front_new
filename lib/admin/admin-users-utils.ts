import type { AdminListPagination } from "@/lib/admin/admin-tests-monitoring-types";

export function toClientPagination(
  page: number,
  limit: number,
  total: number,
): AdminListPagination {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export function matchesStudentSearch(
  fullName: string,
  id: number,
  query: string,
  login?: string | null,
): boolean {
  const q = normalizeSearch(query);
  if (!q) {
    return true;
  }
  return (
    fullName.toLowerCase().includes(q) ||
    String(id).includes(q) ||
    (login?.toLowerCase().includes(q) ?? false)
  );
}

export function groupLabel(
  groupId: number | null | undefined,
  groups: Map<number, string>,
): string {
  if (groupId == null) {
    return "Без группы";
  }
  return groups.get(groupId) ?? `Группа #${groupId}`;
}

export function schoolLabel(
  schoolName?: string | null,
  schoolShortName?: string | null,
): string {
  return schoolShortName?.trim() || schoolName?.trim() || "—";
}
