import styles from "./homework.module.css";

interface HomeworkPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function buildPages(current: number, total: number): Array<number | "..."> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const items: Array<number | "..."> = [1];

  if (current <= 4) {
    items.push(2, 3, 4, 5, "...", total);
    return items;
  }

  if (current >= total - 3) {
    items.push("...", total - 4, total - 3, total - 2, total - 1, total);
    return items;
  }

  items.push("...", current - 1, current, current + 1, "...", total);
  return items;
}

export function HomeworkPagination({
  currentPage,
  totalPages,
  onPageChange,
}: HomeworkPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = buildPages(currentPage, totalPages);

  return (
    <div className={styles.pagination}>
      <button
        type="button"
        className={styles.pageBtn}
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        ← Назад
      </button>

      {pages.map((page, index) =>
        page === "..." ? (
          <span key={`ellipsis-${index}`} className={styles.ellipsis}>
            …
          </span>
        ) : (
          <button
            key={page}
            type="button"
            className={`${styles.pageNumber} ${
              currentPage === page ? styles.pageNumberActive : ""
            }`.trim()}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        ),
      )}

      <button
        type="button"
        className={styles.pageBtn}
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Вперёд →
      </button>
    </div>
  );
}
