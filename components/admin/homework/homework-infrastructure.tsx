import type { MonitoringData } from "@/lib/homework-files/api";
import styles from "@/components/homework/review-queue.module.css";

export function homeworkInfrastructureLabel(state?: string): string {
  return state === "ok" ? "Работает" : state === "error" ? "Недоступно" : state === "stale" ? "Сигнал устарел" : "Нет данных";
}
const time = (value?: string | null) => value ? new Date(value).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }) : "Не получен";
export function HomeworkInfrastructure({ data, stale = false }: { data: MonitoringData; stale?: boolean }) {
  return <>
    <p className={styles.hint}>Организация #{data.organization_id ?? "—"} · подразделение #{data.division_id ?? "—"}. Готовность инфраструктуры не подтверждает завершение конкретного PDF.</p>
    {stale ? <p role="status" className={styles.hint}>Показан последний полученный ответ. Текущее состояние не подтверждено; обновите мониторинг.</p> : null}
    <div className={styles.metrics}>
      <div className={styles.metric}><span>Готовность обработки PDF</span><strong>{stale ? "Не подтверждена" : data.processing_ready === true ? "Готова" : "Не подтверждена"}</strong><p>Нужны брокер, свежий сигнал обработчика и проверка хранилища.</p></div>
      <div className={styles.metric}><span>Брокер Homework</span><strong>{data.delivery?.connected === true ? "Подключён" : data.delivery?.connected === false ? "Недоступен" : "Нет данных"}</strong><p>Ожидают отправки: {data.delivery?.pending ?? "—"}</p></div>
      <div className={styles.metric}><span>Обработчик PDF</span><strong>{homeworkInfrastructureLabel(data.worker?.state)}</strong><p>Последний сигнал: {time(data.worker?.received_at)}</p><p>Свежих экземпляров: {data.worker?.fresh_instances ?? "—"}</p></div>
      <div className={styles.metric}><span>Хранилище PDF</span><strong>{homeworkInfrastructureLabel(data.storage?.state)}</strong><p>Последняя проверка: {time(data.storage?.checked_at)}</p></div>
    </div>
  </>;
}
