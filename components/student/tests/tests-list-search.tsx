import styles from "@/components/student/tests/tests.module.css";
import { Search } from "lucide-react";

interface TestsListSearchProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  resultCount: number;
}

export function TestsListSearch({
  value,
  onChange,
  disabled = false,
  resultCount,
}: TestsListSearchProps) {
  return (
    <div className={styles.listHeader}>
      <label className={styles.listSearchField}>
        <span className={styles.fieldLabel}>Поиск в направлении</span>
        <span className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            type="search"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Название теста..."
            className={styles.searchInput}
            disabled={disabled}
          />
        </span>
      </label>

      <p className={styles.listHeaderMeta}>Найдено: {resultCount}</p>
    </div>
  );
}
