export interface RatingFreshness {
  scope: "exams" | "ratings";
  isStale: boolean;
  reason:
    | "never_calculated"
    | "exam_data_changed"
    | "exam_started"
    | "recalculation_failed"
    | "source_snapshot_invalid"
    | "source_unavailable"
    | "source_changed"
    | "calendar_transition"
    | null;
  activeJobId: number | string | null;
  versionId?: string;
  examsMode?: string;
  externalTestsMode?: string;
  sourceRevision?: number;
  calculatedRevision?: number | null;
  calculatedAt?: string | null;
  asOf?: string | null;
}

export function ratingFreshnessMessage(
  value?: RatingFreshness | null,
): string | null {
  if (!value) return null;
  if (value.scope === "ratings") {
    if (value.activeJobId) return "Идёт пересчёт рейтинга. Пока показана предыдущая полностью опубликованная версия.";
    if (!value.isStale) return null;
    if (value.reason === "never_calculated") return "Рейтинг в выбранном подразделении ещё не рассчитан.";
    if (value.reason === "source_unavailable") return "Не удалось проверить актуальность источников. Показана сохранённая версия рейтинга.";
    if (value.reason === "source_snapshot_invalid") return "Не удалось проверить сохранённые исходные данные. Требуется новый пересчёт рейтинга.";
    if (value.reason === "calendar_transition") return "Наступил срок учёта новых работ. Показана сохранённая версия; требуется пересчёт.";
    return "Исходные данные изменились. Показана сохранённая версия рейтинга; требуется пересчёт.";
  }
  if (value.activeJobId)
    return "Идёт пересчёт рейтинга. Пока показан последний полностью сохранённый результат.";
  if (!value.isStale) return null;
  if (value.reason === "recalculation_failed")
    return "Пересчёт завершился с ошибкой. Сохранён предыдущий рейтинг; изменения экзаменов ещё не учтены.";
  if (value.reason === "never_calculated")
    return "Рейтинг с актуальными экзаменами ещё не рассчитан.";
  if (value.reason === "exam_started")
    return "Начался новый экзамен. Рейтинг нужно пересчитать: отсутствие результата учитывается как 0.";
  return "Экзамены или их результаты изменились. Показан ранее рассчитанный рейтинг; требуется пересчёт.";
}
