import type {
  AdminTestDetail,
  AdminTestFormData,
  AdminTestListItem,
  AdminTestStatus,
  AdminTestStatusFilter,
  TestsDateFilter,
} from "@/lib/admin/admin-tests-types";
import {
  getAdminTestTitle,
  isAdminExternalTest,
} from "@/lib/admin/admin-tests-api";

export function getAdminTestStatus(test: AdminTestListItem): AdminTestStatus {
  if (isAdminExternalTest(test)) {
    return "external";
  }

  const now = new Date();
  const startDate = test.startDate ? new Date(test.startDate) : null;
  const endDate = test.endDate ? new Date(test.endDate) : null;

  if (startDate && now < startDate) {
    return "upcoming";
  }

  if (endDate && now > endDate) {
    return "ended";
  }

  return "active";
}

export function getAdminTestStatusLabel(status: AdminTestStatus): string {
  switch (status) {
    case "upcoming":
      return "Скоро начнётся";
    case "ended":
      return "Завершён";
    case "external":
      return "Вне CPM-LMS";
    default:
      return "Активен";
  }
}

export function formatAdminTestDate(value?: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatResultsCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod100 >= 11 && mod100 <= 14) {
    return `${count} результатов`;
  }
  if (mod10 === 1) {
    return `${count} результат`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${count} результата`;
  }
  return `${count} результатов`;
}

export function toDatetimeLocalValue(value?: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function filterAdminTestsBySearch(
  tests: AdminTestListItem[],
  searchTerm: string,
): AdminTestListItem[] {
  const query = searchTerm.trim().toLowerCase();
  if (!query) {
    return tests;
  }

  return tests.filter((test) =>
    getAdminTestTitle(test).toLowerCase().includes(query),
  );
}

export function filterAdminTestsByStatus(
  tests: AdminTestListItem[],
  statusFilter: AdminTestStatusFilter,
): AdminTestListItem[] {
  if (statusFilter === "all") {
    return tests;
  }

  return tests.filter((test) => getAdminTestStatus(test) === statusFilter);
}

export function filterAdminTestsByDate(
  tests: AdminTestListItem[],
  dateFilter: TestsDateFilter,
): AdminTestListItem[] {
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
    if (isAdminExternalTest(test)) {
      if (!test.date) {
        return false;
      }

      const testDate = new Date(test.date);
      if (filterStart && testDate < filterStart) {
        return false;
      }
      if (filterEnd && testDate > filterEnd) {
        return false;
      }
      return true;
    }

    const testStart = test.startDate ? new Date(test.startDate) : null;
    const testEnd = test.endDate ? new Date(test.endDate) : null;

    if (filterStart && testStart && testStart < filterStart) {
      return false;
    }
    if (filterEnd && testEnd && testEnd > filterEnd) {
      return false;
    }

    return true;
  });
}

export function testDetailToFormData(test: AdminTestDetail): AdminTestFormData {
  const processedQuestions = (test.questions || []).map((question) => ({
    ...question,
    answers: question.answers
      ? question.answers.map(({ pointValue: _pv, ...answer }) => answer)
      : [],
    correctAnswers: question.correctAnswers || [],
  }));

  return {
    title: test.title || "",
    direction: test.direction || "",
    startDate: toDatetimeLocalValue(test.startDate),
    endDate: toDatetimeLocalValue(test.endDate),
    timeLimitMinutes: test.timeLimitMinutes || 30,
    questions: processedQuestions,
    visible: test.visible ?? false,
    published: test.published ?? true,
  };
}

export const emptyAdminTestForm = (): AdminTestFormData => ({
  title: "",
  direction: "",
  startDate: "",
  endDate: "",
  timeLimitMinutes: 30,
  questions: [],
  visible: false,
  published: true,
});
