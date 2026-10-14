"use client";

import { useEffect, useState } from "react";
import { externalError, externalResultItems, type ExternalResultItem } from "@/lib/bff/external-tests";
import { formatAdminTestDate } from "@/lib/admin/admin-tests-utils";
import { LoadingState } from "@/components/ui/loading-state";
import styles from "@/components/admin/tests/external-tests.module.css";

export function AdminExternalResults({ accountId }: { accountId: number }) {
  const [rows, setRows] = useState<ExternalResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void externalResultItems({ accountId, signal: controller.signal }).then(items => {
      if (!controller.signal.aborted) setRows(items);
    }).catch(e => { if (!controller.signal.aborted) setError(externalError(e).message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [accountId]);
  return <section className={styles.panel} aria-label="Внешние результаты ученика">
    <h2 className={styles.heading}>Внешние тесты</h2>
    {loading ? <LoadingState label="Загрузка внешних результатов…" variant="inline" /> : error ? <p className={styles.error} role="alert">{error}</p> : rows.length ?
      <div className={styles.scroll}><table className={styles.table}><thead><tr><th>Тест</th><th>Направление</th><th>Дата</th><th>Балл</th><th>Ревизия</th></tr></thead><tbody>{rows.map(({ test, result }) => <tr key={test.id}><td>{test.name}</td><td>{test.direction_name}</td><td>{formatAdminTestDate(test.date)}</td><td>{result ? result.score === null ? "Балл не указан" : result.score : "Нет результата"}</td><td>{result?.revision ?? "—"}</td></tr>)}</tbody></table></div>
      : <p className={styles.muted}>Внешних результатов в этом подразделении пока нет.</p>}
  </section>;
}
