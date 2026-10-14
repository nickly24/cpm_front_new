"use client";

import { EditOnly } from "@/components/admin/admin-section-access";
import { useAuth } from "@/contexts/AuthContext";
import { BFF_DEV } from "@/lib/config";
import { homeworkSettingsAccess } from "@/lib/bff/homework-settings-audit";
import { HomeworkSettingsAudit } from "./homework-settings-audit";
import { HomeworkInfrastructure } from "./homework-infrastructure";
import { homeworkFilesApi, homeworkErrorMessage, type MonitoringData } from "@/lib/homework-files/api";
import { staffError } from "@/components/homework/staff-homework-utils";
import { Spinner } from "@/components/ui/spinner";
import { RefreshCw, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "@/components/homework/review-queue.module.css";

const statuses: Record<string, string> = { uploading: "Загружаются", queued: "Ожидают обработки", running: "Обрабатываются", retry: "Повторяются", failed: "С ошибкой", ready: "Готовы", cancelled: "Отменены" };
const warnings: Record<string, string> = { queue_unavailable: "Передача файлов в обработку временно недоступна. Задачи сохраняются в очереди.", queue_unknown: "Нет данных о соединении Homework с брокером.", runner_unavailable: "Обработчик PDF сообщает об ошибке.", runner_unknown: "Сигнал обработчика PDF пока не получен. Готовность не подтверждена.", runner_stale: "Сигнал обработчика PDF устарел. Готовность не подтверждена.", storage_unavailable: "Проверка хранилища PDF завершилась ошибкой.", storage_unknown: "Нет подтверждённой проверки хранилища PDF.", storage_stale: "Проверка хранилища PDF устарела. Готовность не подтверждена." };

export function HomeworkMonitoringSection() {
  const { user } = useAuth();
  const access = homeworkSettingsAccess(user);
  const [panel, setPanel] = useState<"settings" | "audit" | null>(null);
  const [data, setData] = useState<MonitoringData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const sequence = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const version = ++sequence.current;
    try { const next = await homeworkFilesApi.monitoring(signal); if (!signal?.aborted && version === sequence.current) { setData(next); setError(null); } }
    catch (reason) { if (!signal?.aborted && version === sequence.current) setError(staffError(reason, "Не удалось загрузить мониторинг.")); }
    finally { if (!signal?.aborted && version === sequence.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    const polling = BFF_DEV ? window.setInterval(() => { if (document.visibilityState === "visible") void load(controller.signal); }, 10000) : null;
    return () => { controller.abort(); window.clearTimeout(timer); if (polling !== null) window.clearInterval(polling); };
  }, [load]);
  const retry = async (id: string) => {
    if (busy) return;
    setBusy(id); setError(null);
    try { await homeworkFilesApi.retry(id); await load(); }
    catch (reason) { setError(staffError(reason)); }
    finally { setBusy(null); }
  };
  const failed = data?.recent_jobs.filter((job) => job.status === "failed") ?? [];
  if (BFF_DEV && panel) return <HomeworkSettingsAudit panel={panel} onBack={() => setPanel(null)} backLabel="К мониторингу" />;
  return <div className={styles.page}>
    <header className={styles.pageHeader}><div><span className={styles.eyebrow}>Домашние работы</span><h1>Состояние загрузок</h1><p>Обработка PDF, доступность хранилища и загрузки, которым нужна помощь.</p></div><div className={styles.headerActions}>{BFF_DEV && access.readSettings ? <button onClick={() => setPanel("settings")}>Настройки</button> : null}{BFF_DEV && access.readAudit ? <button onClick={() => setPanel("audit")}>Аудит</button> : null}<button disabled={loading || Boolean(busy)} onClick={() => void load()}><RefreshCw size={17} />Обновить</button></div></header>
    {error ? <div className={styles.error} role="alert">{error}</div> : null}
    {data?.warnings.map((value) => <div className={styles.error} key={value}>{warnings[value] ?? "Сервис сообщает о проблеме обработки. Проверьте состояние и последние загрузки."}</div>)}
    {loading ? <div className={styles.loading}><Spinner /><span>Проверяем состояние…</span></div> : data ? <>
      {BFF_DEV ? <HomeworkInfrastructure data={data} stale={!!error} /> : <div className={styles.metrics}><div className={styles.metric}><span>Обработка PDF</span><strong>{data.runner?.started ? "Работает" : "Не запущена"}</strong><p>Последний сигнал: {data.runner?.heartbeat_age_seconds ?? "—"} сек. назад</p></div><div className={styles.metric}><span>Хранилище</span><strong>{data.storage?.file_count ?? "—"} файлов</strong><p>{data.storage?.total_bytes != null ? `${(data.storage?.total_bytes / 1048576).toFixed(1)} МБ занято` : "Нет данных о размере"}</p></div><div className={styles.metric}><span>Ошибки за последний час</span><strong>{data.failed_last_hour}</strong><p>Неудачные попытки обработки</p></div></div>}
      <div className={styles.list}>{data.jobs.map((item) => <article key={item.status}><h2>{statuses[item.status] ?? item.status}</h2><span>{item.count} файлов</span></article>)}</div>
      <h2>Загрузки с ошибками</h2>
      {failed.length ? <div className={styles.list}>{failed.map((job) => <article key={job.id}><div><h2>{homeworkErrorMessage(job.error_code ?? "processing_failed", job.limits)}</h2><p>Загрузка {job.id}</p><p>Попыток обработки: {job.attempts} · ручных повторов: {job.manual_attempts} из 3</p></div>{job.manual_attempts < 3 ? <EditOnly><button disabled={Boolean(busy)} onClick={() => void retry(job.id)}>{busy === job.id ? <Spinner size="sm" /> : <RotateCcw size={17} />}Повторить обработку</button></EditOnly> : <span className={styles.hint}>Лимит повторов исчерпан</span>}</article>)}</div> : <div className={styles.empty}><h3>Загрузок с ошибками в последнем списке нет</h3><p>Завершение каждого PDF подтверждается состоянием его загрузки.</p></div>}
    </> : null}
  </div>;
}
