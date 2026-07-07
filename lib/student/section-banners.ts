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
  zaps: "/arts/zaps.png",
} as const;

export type StudentBannerSection = keyof typeof STUDENT_SECTION_BANNERS;
