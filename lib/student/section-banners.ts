/** Фоновые баннеры разделов ученика (`public/arts/`). */
export const STUDENT_SECTION_BANNERS = {
  performance: "/arts/main.png",
  homework: "/arts/homework.png",
  tests: "/arts/test.png",
  exams: "/arts/exam.png",
  attendance: "/arts/poseshaemost.png",
  train: "/arts/train.png",
  /** Новый баннер тренировок (карточки) — подключить при редизайне */
  trainFlashcards: "/arts/train-flashcards.png",
  trainFlashcardsDark: "/arts/train-flashcards-dark.png",
  zaps: "/arts/zaps.png",
} as const;

export type StudentBannerSection = keyof typeof STUDENT_SECTION_BANNERS;

/** Full-width desktop panoramas; mobile retains its compact section header. */
export const STUDENT_DESKTOP_BANNERS = {
  homework: "/arts/desktop/homework-panorama-v2.webp",
  tests: "/arts/desktop/tests-panorama-v2.webp",
  exams: "/arts/desktop/exams-panorama-v2.webp",
  attendance: "/arts/desktop/attendance-panorama-v2.webp",
  train: "/arts/desktop/train-panorama-v2.webp",
} as const;
