/** Разделы админки с готовым UI (остальные — заглушки). */
export const ADMIN_READY_SECTIONS = new Set([
  "users",
  "schools",
  "upload",
  "schedule",
  "telegram-bot",
  "assignments",
  "tests",
  "test-results",
  "exams",
  "attendance",
  "scan",
  "ratings",
  "zaps",
  "train",
]);

export const ADMIN_SECTION_DESCRIPTIONS: Record<string, string> = {
  users: "Ученики, группы и персонал",
  schools: "Справочник школ и привязка учеников",
  upload: "Массовый импорт данных из Excel",
  schedule: "Расписание занятий и пары",
  "telegram-bot": "Выдача логинов и паролей через Telegram",
  assignments: "Создание и публикация домашних заданий",
  tests: "Тесты по направлениям, вопросы и результаты",
  "test-results": "Сводка результатов тестирования",
  exams: "Экзамены и зачёты",
  attendance: "Учёт посещаемости",
  scan: "Сканирование QR и пропусков",
  zaps: "Запросы учеников на отгул",
  train: "Направления, разделы и карточки для студентов",
  ratings: "Рейтинг и успеваемость",
};
