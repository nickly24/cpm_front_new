export const SUPERVISOR_READY_SECTIONS = new Set([
  "dashboard",
  "ratings",
  "attendance",
  "homework",
  "tests",
  "exams",
]);

export const SUPERVISOR_SECTION_DESCRIPTIONS: Record<string, string> = {
  dashboard: "Отчёты и выгрузка данных",
  ratings: "Общий рейтинг учеников за период",
  attendance: "Журнал посещаемости по дням занятий",
  homework: "Таблица сдачи домашних заданий ОВ и ДЗНВ",
  tests: "Результаты тестов по ученикам",
  exams: "Результаты экзаменов по ученикам",
};
