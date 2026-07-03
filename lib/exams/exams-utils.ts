import type { ExamSession } from "./exams-types";

export function formatExamDate(value?: string | null): string {
  if (!value) {
    return "Дата не указана";
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

export function getExamGradeLabel(grade: number): string {
  if (grade >= 5) return "Отлично";
  if (grade >= 4) return "Хорошо";
  if (grade >= 3) return "Удовлетворительно";
  return "Неудовлетворительно";
}

export function getExamGradeClass(grade: number): "good" | "mid" | "ok" | "low" {
  if (grade >= 5) return "good";
  if (grade >= 4) return "mid";
  if (grade >= 3) return "ok";
  return "low";
}

export function getUniqueExamNames(sessions: ExamSession[]): string[] {
  return [...new Set(sessions.map((session) => session.exam_name).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "ru"),
  );
}

export function sortExams<T extends { name: string; date: string | null }>(
  exams: T[],
  sortBy: "date" | "name",
): T[] {
  const rows = [...exams];
  if (sortBy === "name") {
    return rows.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }
  return rows.sort(
    (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime(),
  );
}

export function calculateExamSummary(sessions: ExamSession[]) {
  if (sessions.length === 0) {
    return {
      count: 0,
      averageGrade: 0,
      totalPoints: 0,
    };
  }

  const totalPoints = sessions.reduce(
    (sum, session) => sum + (Number(session.points) || 0),
    0,
  );
  const averageGrade =
    sessions.reduce((sum, session) => sum + (Number(session.grade) || 0), 0) /
    sessions.length;

  return {
    count: sessions.length,
    averageGrade,
    totalPoints,
  };
}

export function formatExamSessionsCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod100 >= 11 && mod100 <= 14) {
    return `${count} сессий`;
  }
  if (mod10 === 1) {
    return `${count} сессия`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${count} сессии`;
  }
  return `${count} сессий`;
}
