import styles from "@/components/student/tests/tests.module.css";
import { Search } from "lucide-react";

interface TestsListSearchProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  resultCount: number;
  label?: string;
}

export function TestsListSearch({
  value,
  onChange,
  disabled = false,
  resultCount,
  label = "Поиск теста",
}: TestsListSearchProps) {
  return (
    <div className={styles.listHeader}>
      <label className={styles.listSearchField}>
        <span className={styles.fieldLabel}>{label}</span>
        <span className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            type="search"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Найти тест по названию"
            className={styles.searchInput}
            disabled={disabled}
            aria-label={label}
          />
        </span>
      </label>

      <p className={styles.listHeaderMeta}>Найдено: {resultCount}</p>
    </div>
  );
}
