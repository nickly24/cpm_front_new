import { DirectionCombobox } from "@/components/student/tests/direction-combobox";
import { HomeworkFilterSelect } from "@/components/student/homework/homework-filter-select";
import { TESTS_STATUS_FILTER_OPTIONS } from "@/components/student/tests/tests-filter-options";
import { FilterPopover } from "@/components/ui/filter-popover";
import styles from "@/components/student/tests/tests.module.css";
import type { Direction, TestStatusFilter, TestsDateFilter } from "@/lib/student/tests-types";

interface TestsToolbarProps {
  directions: Direction[];
  directionName: string;
  onDirectionChange: (name: string) => void;
  statusFilter: TestStatusFilter;
  onStatusFilterChange: (value: TestStatusFilter) => void;
  dateFilter: TestsDateFilter;
  onDateFilterChange: (value: TestsDateFilter) => void;
}

export function TestsToolbar({
  directions,
  directionName,
  onDirectionChange,
  statusFilter,
  onStatusFilterChange,
  dateFilter,
  onDateFilterChange,
}: TestsToolbarProps) {
  const activeCount =
    Number(statusFilter !== "all") +
    Number(Boolean(dateFilter.startDate || dateFilter.endDate));

  return (
    <section className={styles.toolbar}>
      <div className={styles.toolbarMain}>
        <DirectionCombobox
          directions={directions}
          value={directionName}
          onChange={onDirectionChange}
        />
      </div>

      <FilterPopover
        activeCount={activeCount}
        onReset={() => {
          onStatusFilterChange("all");
          onDateFilterChange({ startDate: "", endDate: "" });
        }}
      >
        <HomeworkFilterSelect
          label="Статус"
          value={statusFilter}
          options={TESTS_STATUS_FILTER_OPTIONS}
          onChange={onStatusFilterChange}
        />
        <div className={styles.dateRow}>
          <label className={styles.dateField}>
            <span className={styles.fieldLabel}>С даты</span>
            <input
              type="date"
              value={dateFilter.startDate}
              onChange={(event) =>
                onDateFilterChange({
                  ...dateFilter,
                  startDate: event.target.value,
                })
              }
              className={styles.dateInput}
            />
          </label>

          <label className={styles.dateField}>
            <span className={styles.fieldLabel}>По дату</span>
            <input
              type="date"
              value={dateFilter.endDate}
              onChange={(event) =>
                onDateFilterChange({
                  ...dateFilter,
                  endDate: event.target.value,
                })
              }
              className={styles.dateInput}
            />
          </label>
        </div>
      </FilterPopover>
    </section>
  );
}
