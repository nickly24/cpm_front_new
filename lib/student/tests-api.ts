import { apiRequest } from "@/lib/api/client";
import type {
  Direction,
  StudentTestItem,
  TestSession,
  TestsDateFilter,
  TestsWithSessionsResponse,
  TestStatusFilter,
} from "./tests-types";

export async function fetchDirections(): Promise<Direction[]> {
  return apiRequest<Direction[]>("/directions");
}

export async function fetchTestsWithSessions(
  directionName: string,
): Promise<TestsWithSessionsResponse> {
  return apiRequest<TestsWithSessionsResponse>(
    `/tests/${encodeURIComponent(directionName)}/with-sessions`,
  );
}

export function getTestId(test: StudentTestItem): string {
  return String(test.id ?? "");
}

export function getTestTitle(test: StudentTestItem): string {
  return test.title || test.name || "Без названия";
}

export function isExternalTest(test: StudentTestItem): boolean {
  return Boolean(test.isExternal || test.externalTest);
}

export function filterTestsBySearch(
  tests: StudentTestItem[],
  searchTerm: string,
): StudentTestItem[] {
  const query = searchTerm.trim().toLowerCase();
  if (!query) {
    return tests;
  }

  return tests.filter((test) =>
    getTestTitle(test).toLowerCase().includes(query),
  );
}

export function filterTestsByStatus(
  tests: StudentTestItem[],
  statusFilter: TestStatusFilter,
): StudentTestItem[] {
  if (statusFilter === "all") {
    return tests;
  }

  return tests.filter((test) => test.status === statusFilter);
}

export function filterTestsByDate(
  tests: StudentTestItem[],
  dateFilter: TestsDateFilter,
): StudentTestItem[] {
  if (!dateFilter.startDate && !dateFilter.endDate) {
    return tests;
  }

  const filterStart = dateFilter.startDate
    ? new Date(`${dateFilter.startDate}T00:00:00`)
    : null;
  const filterEnd = dateFilter.endDate
    ? new Date(`${dateFilter.endDate}T23:59:59`)
    : null;

  return tests.filter((test) => {
    if (isExternalTest(test)) {
      if (!test.date) {
        return false;
      }

      const testDate = new Date(test.date);
      if (Number.isNaN(testDate.getTime())) {
        return false;
      }

      if (filterStart && testDate < filterStart) {
        return false;
      }

      if (filterEnd && testDate > filterEnd) {
        return false;
      }

      return true;
    }

    const startDate = test.startDate ? new Date(test.startDate) : null;
    const endDate = test.endDate ? new Date(test.endDate) : null;

    if (filterStart && startDate && startDate < filterStart) {
      return false;
    }

    if (filterEnd && endDate && endDate > filterEnd) {
      return false;
    }

    return true;
  });
}

export function buildSessionMap(
  sessions: TestSession[],
): Map<string, TestSession> {
  const map = new Map<string, TestSession>();

  for (const session of sessions) {
    if (session.testId != null) {
      map.set(String(session.testId), session);
    }
  }

  return map;
}

export function getSessionForTest(
  test: StudentTestItem,
  sessionMap: Map<string, TestSession>,
): TestSession | null {
  return sessionMap.get(getTestId(test)) ?? null;
}

export function formatTestDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatTestDateCompact(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTestPeriod(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string {
  const start = formatTestDateCompact(startDate);
  const end = formatTestDateCompact(endDate);

  if (start === "—" && end === "—") {
    return "—";
  }

  if (start === end) {
    return start;
  }

  return `${start} — ${end}`;
}

export function formatTestScore(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) {
    return "—";
  }

  return String(Math.round(Number(value)));
}

export function getExternalScore(test: StudentTestItem): number | null {
  if (!test.hasResult || test.rate == null || Number.isNaN(Number(test.rate))) {
    return null;
  }

  return Math.round(Number(test.rate));
}
