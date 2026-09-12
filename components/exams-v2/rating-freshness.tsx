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
  return message ? (
    <div className={s.warning} role="status">
      {message}
      <p className={s.muted}>Проверка актуальности относится к экзаменам.</p>
    </div>
  ) : null;
}
