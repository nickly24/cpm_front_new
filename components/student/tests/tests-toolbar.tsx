import { TESTS_STATUS_FILTER_OPTIONS } from "@/components/student/tests/tests-filter-options";
import styles from "@/components/student/tests/tests.module.css";
import type { Direction, TestStatusFilter } from "@/lib/student/tests-types";

interface TestsToolbarProps {
  directions: Direction[];
  directionName: string;
  onDirectionChange: (name: string) => void;
  statusFilter: TestStatusFilter;
  onStatusFilterChange: (value: TestStatusFilter) => void;
}

export function TestsToolbar({ directions, directionName, onDirectionChange, statusFilter, onStatusFilterChange }: TestsToolbarProps) {
  return <section className={styles.tagFilters} aria-label="Фильтры тестов">
    <div role="group" aria-label="Направление" className={styles.tagGroup}>
      <span className={styles.tagLabel}>Направление</span>
      <div className={styles.tags}>{directions.map(direction => <button key={direction.id} type="button" className={styles.filterTag} aria-pressed={direction.name === directionName} onClick={() => onDirectionChange(direction.name)}>{direction.name}</button>)}</div>
    </div>
    <div role="group" aria-label="Статус" className={styles.tagGroup}>
      <span className={styles.tagLabel}>Статус</span>
      <div className={styles.tags}>{TESTS_STATUS_FILTER_OPTIONS.map(option => <button key={option.value} type="button" className={styles.filterTag} aria-pressed={option.value === statusFilter} onClick={() => onStatusFilterChange(option.value === statusFilter ? "all" : option.value)}>{option.value === "all" ? "Все статусы" : option.label}</button>)}</div>
    </div>
  </section>;
}
