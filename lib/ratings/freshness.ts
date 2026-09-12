export interface RatingFreshness {
  scope: "exams";
  isStale: boolean;
  reason:
    | "never_calculated"
    | "exam_data_changed"
    | "exam_started"
    | "recalculation_failed"
    | null;
  activeJobId: number | null;
  sourceRevision?: number;
  calculatedRevision?: number | null;
  calculatedAt?: string | null;
  asOf?: string | null;
}

export function ratingFreshnessMessage(
  value?: RatingFreshness | null,
): string | null {
  if (!value || value.scope !== "exams") return null;
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
