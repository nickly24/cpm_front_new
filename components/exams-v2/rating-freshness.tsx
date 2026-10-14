import {
  ratingFreshnessMessage,
  type RatingFreshness,
} from "@/lib/ratings/freshness";
import s from "./exams.module.css";

export function RatingFreshnessNotice({
  value,
}: {
  value?: RatingFreshness | null;
}) {
  const message = ratingFreshnessMessage(value);
  const excludedSources = value?.scope === "ratings" ? [value.examsMode === "dev_empty" ? "Экзамены исключены из расчёта в настройках Dev" : "", value.externalTestsMode === "dev_internal_only" ? "Внешние тесты исключены из расчёта в настройках Dev" : ""].filter(Boolean).join(". ") : "";
  return message || excludedSources ? (
    <div className={s.warning} role="status">
      {message}
      {excludedSources ? <p>{excludedSources}.</p> : null}
      <p className={s.muted}>{value?.scope === "ratings" ? "Проверка охватывает домашние задания, тесты и экзамены." : "Проверка актуальности относится к экзаменам."}</p>
    </div>
  ) : null;
}
