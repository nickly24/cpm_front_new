"use client";

import { EditOnly } from "@/components/admin/admin-section-access";
import { homeworkFilesApi, homeworkErrorMessage, type MonitoringData } from "@/lib/homework-files/api";
import { staffError } from "@/components/homework/staff-homework-utils";
import { Spinner } from "@/components/ui/spinner";
import { RefreshCw, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import styles from "@/components/homework/review-queue.module.css";

const statuses: Record<string, string> = { uploading: "Загружаются", queued: "Ожидают обработки", running: "Обрабатываются", retry: "Повторяются", failed: "С ошибкой", ready: "Готовы", cancelled: "Отменены" };

export function HomeworkMonitoringSection() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try { setData(await homeworkFilesApi.monitoring()); }
    catch (reason) { setError(staffError(reason, "Не удалось загрузить мониторинг.")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const retry = async (id: string) => {
    if (busy) return;
    setBusy(id); setError(null);
    try { await homeworkFilesApi.retry(id); await load(); }
    catch (reason) { setError(staffError(reason)); }
    finally { setBusy(null); }
  };
  const failed = data?.recent_jobs.filter((job) => job.status === "failed") ?? [];
  return <div className={styles.page}>
    <header className={styles.pageHeader}><div><span className={styles.eyebrow}>Домашние работы</span><h1>Состояние загрузок</h1><p>Обработка PDF, доступность хранилища и загрузки, которым нужна помощь.</p></div><button disabled={loading || Boolean(busy)} onClick={() => void load()}><RefreshCw size={17} />Обновить</button></header>
    {error ? <div className={styles.error} role="alert">{error}</div> : null}
    {data?.warnings.map((value) => <div className={styles.error} key={value}>{value === "runner_unavailable" ? "Сервис обработки PDF не отвечает. Новые файлы ожидают в очереди." : value === "storage_unavailable" ? "Хранилище файлов недоступно." : "За последний час выросло число ошибок загрузки."}</div>)}
    {loading ? <div className={styles.loading}><Spinner /><span>Проверяем состояние…</span></div> : data ? <>
      <div className={styles.metrics}><div className={styles.metric}><span>Обработка PDF</span><strong>{data.runner.started ? "Работает" : "Не запущена"}</strong><p>Последний сигнал: {data.runner.heartbeat_age_seconds ?? "—"} сек. назад</p></div><div className={styles.metric}><span>Хранилище</span><strong>{data.storage.file_count ?? "—"} файлов</strong><p>{data.storage.total_bytes != null ? `${(data.storage.total_bytes / 1048576).toFixed(1)} МБ занято` : "Нет данных о размере"}</p></div><div className={styles.metric}><span>Ошибки за последний час</span><strong>{data.failed_last_hour}</strong><p>Неудачные попытки обработки</p></div></div>
      <div className={styles.list}>{data.jobs.map((item) => <article key={item.status}><h2>{statuses[item.status] ?? item.status}</h2><span>{item.count} файлов</span></article>)}</div>
      <h2>Загрузки с ошибками</h2>
      {failed.length ? <div className={styles.list}>{failed.map((job) => <article key={job.id}><div><h2>{homeworkErrorMessage(job.error_code ?? "processing_failed")}</h2><p>Загрузка {job.id}</p><p>Попыток обработки: {job.attempts} · ручных повторов: {job.manual_attempts} из 3</p></div>{job.manual_attempts < 3 ? <EditOnly><button disabled={Boolean(busy)} onClick={() => void retry(job.id)}>{busy === job.id ? <Spinner size="sm" /> : <RotateCcw size={17} />}Повторить обработку</button></EditOnly> : <span className={styles.hint}>Лимит повторов исчерпан</span>}</article>)}</div> : <div className={styles.empty}><h3>Ошибок не обнаружено</h3><p>Последние загрузки обрабатываются без ошибок.</p></div>}
    </> : null}
  </div>;
}
