"use client";

import { useEffect, useState } from "react";
import { externalError, externalResultItems, type ExternalResultItem } from "@/lib/bff/external-tests";
import { formatTestDate } from "@/lib/student/tests-api";
import { LoadingState } from "@/components/ui/loading-state";
import styles from "@/components/admin/tests/external-tests.module.css";

export function StudentExternalResults() {
  const [rows, setRows] = useState<ExternalResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void externalResultItems({ signal: controller.signal }).then(setRows).catch(e => {
      if (!controller.signal.aborted) setError(externalError(e).message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  return <section className={styles.panel} aria-label="Результаты внешних тестов">
    <h2 className={styles.heading}>Внешние тесты</h2>
    <p className={styles.muted}>Результаты в выбранном подразделении.</p>
    {loading ? <LoadingState label="Загрузка внешних результатов…" variant="inline" /> : error ? <p className={styles.error} role="alert">{error}</p> : rows.length ?
      <div className={styles.scroll}><table className={styles.table}><thead><tr><th>Тест</th><th>Направление</th><th>Дата</th><th>Балл</th></tr></thead><tbody>{rows.map(({ test, result }) => <tr key={test.id}><td>{test.name}</td><td>{test.direction_name}</td><td>{formatTestDate(test.date)}</td><td>{result ? result.score === null ? "Балл не указан" : <strong>{result.score}</strong> : "Нет результата"}</td></tr>)}</tbody></table></div>
      : <p className={styles.muted}>Внешних результатов пока нет.</p>}
  </section>;
}
