"use client";

import { homeworkFilesApi, type MonitoringData } from "@/lib/homework-files/api";
import { useEffect, useState } from "react";
import styles from "@/components/homework/review-queue.module.css";

export function HomeworkMonitoringSection() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    try { setData(await homeworkFilesApi.monitoring()); setError(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось загрузить мониторинг"); }
  };
  useEffect(() => { void load(); }, []);
  const retry = async (id: string) => { await homeworkFilesApi.retry(id); await load(); };
  return <div className={styles.page}>
    <header><div><span>Инфраструктура</span><h1>Мониторинг файлов</h1><p>Runner, ошибки обработки и объём S3.</p></div><button onClick={() => void load()}>Обновить</button></header>
    {error ? <div className={styles.error}>{error}</div> : null}
    {data?.warnings.map((value) => <div className={styles.error} key={value}>{value === "runner_unavailable" ? "PDF runner недоступен" : value === "storage_unavailable" ? "S3 недоступен" : "Растёт число failed jobs"}</div>)}
    <div className={styles.list}>
      <article><div><h2>PDF runner</h2><p>{data?.runner.started ? `Работает · heartbeat ${data.runner.heartbeat_age_seconds ?? "—"} сек. назад` : "Не запущен"}</p></div></article>
      <article><div><h2>S3</h2><p>{data?.storage.file_count ?? "—"} файлов · {data?.storage.total_bytes != null ? `${(data.storage.total_bytes / 1048576).toFixed(1)} МБ` : "нет подключения"}</p></div></article>
      {data?.jobs.map((item) => <article key={item.status}><div><h2>{item.status}</h2><p>{item.count} jobs</p></div></article>)}
      {data?.recent_jobs.filter((job) => job.status === "failed").map((job) => <article key={job.id}><div><h2>{job.error_code ?? "Ошибка"}</h2><p>{job.id} · попыток {job.attempts}</p></div>{job.manual_attempts < 3 ? <button onClick={() => void retry(job.id)}>Повторить</button> : null}</article>)}
    </div>
  </div>;
}
