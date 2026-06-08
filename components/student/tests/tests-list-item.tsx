import styles from "@/components/student/tests/tests.module.css";
import {
  formatTestDateCompact,
  formatTestPeriod,
  getTestDirectionLabel,
  getTestId,
  getTestTitle,
  isExternalTest,
} from "@/lib/student/tests-api";
import type { StudentTestItem } from "@/lib/student/tests-types";
import { TESTS_STATUS_LABELS } from "@/lib/student/tests-types";
import { CalendarRange, Clock3 } from "lucide-react";

interface TestsListItemProps {
  test: StudentTestItem;
  selected: boolean;
  onSelect: (testId: string) => void;
  showDirection?: boolean;
}

export function TestsListItem({
  test,
  selected,
  onSelect,
  showDirection = false,
}: TestsListItemProps) {
  const external = isExternalTest(test);
  const testId = getTestId(test);
  const directionLabel = showDirection ? getTestDirectionLabel(test) : null;
  const statusLabel = external ? "Вне системы" : TESTS_STATUS_LABELS[test.status];
  const timeLimit =
    !external && test.timeLimitMinutes != null && test.timeLimitMinutes > 0
      ? test.timeLimitMinutes
      : null;
  const dateLine = external
    ? formatTestDateCompact(test.date)
    : formatTestPeriod(test.startDate, test.endDate);

  return (
    <button
      type="button"
      className={`${styles.listItem} ${selected ? styles.listItemSelected : ""}`.trim()}
      onClick={() => onSelect(testId)}
    >
      <span className={styles.listItemTitle}>{getTestTitle(test)}</span>

      {directionLabel ? (
        <span className={styles.listItemDirection}>{directionLabel}</span>
      ) : null}

      <span
        className={`${styles.statusText} ${
          styles[`statusText_${test.status}`] ?? ""
        }`.trim()}
      >
        {statusLabel}
      </span>

      <div className={styles.listItemMetaRows}>
        {timeLimit != null ? (
          <span className={styles.listItemMetaLine}>
            <Clock3 size={13} className={styles.listItemMetaIcon} />
            {timeLimit} мин
          </span>
        ) : null}

        <span className={styles.listItemMetaLine}>
          <CalendarRange size={13} className={styles.listItemMetaIcon} />
          {dateLine}
        </span>
      </div>

      {external ? (
        <span className={styles.listItemMeta}>Результат вне платформы CPM</span>
      ) : test.canResume ? (
        <span className={styles.listItemMetaAccent}>
          Есть незавершённая попытка
        </span>
      ) : null}
    </button>
  );
}
