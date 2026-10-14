"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { useRatingResource } from "@/lib/ratings/use-rating-resource";
import { getHomeworkAudit, getHomeworkSettings, homeworkAuditAction, homeworkSettingsAccess, homeworkSettingsError, pendingHomeworkSettings, reconcileHomeworkSettings, sameHomeworkSettings, saveHomeworkSettings, validateHomeworkSettings, type HomeworkSettings } from "@/lib/bff/homework-settings-audit";
import styles from "./homework-settings-audit.module.css";

const fields: { key: keyof HomeworkSettings; label: string; min: number; max: number; help: string }[] = [
  { key: "max_source_bytes", label: "Размер исходного файла, байт", min: 1, max: 104857600, help: "До 100 МиБ. 1 МиБ = 1 048 576 байт." },
  { key: "max_output_bytes", label: "Размер обработанного файла, байт", min: 1, max: 104857600, help: "До 100 МиБ." },
  { key: "max_pages", label: "Количество страниц", min: 1, max: 200, help: "От 1 до 200 страниц." },
  { key: "dpi", label: "Разрешение обработки, DPI", min: 72, max: 300, help: "От 72 до 300 DPI." },
  { key: "jpeg_quality", label: "Качество JPEG", min: 35, max: 95, help: "От 35 до 95." },
  { key: "presign_ttl_seconds", label: "Срок ссылки для загрузки, секунды", min: 60, max: 900, help: "От 60 до 900 секунд." },
  { key: "upload_stale_seconds", label: "Время ожидания загрузки, секунды", min: 120, max: 86400, help: "Не меньше двух сроков ссылки, до 86 400 секунд." },
];
type SettingsDraft = Record<keyof HomeworkSettings, string>;
const draftFrom = (value: HomeworkSettings): SettingsDraft => Object.fromEntries(fields.map(field => [field.key, String(value[field.key])])) as SettingsDraft;
const draftSettings = (value: SettingsDraft) => validateHomeworkSettings(Object.fromEntries(fields.map(field => [field.key, value[field.key].trim() ? Number(value[field.key]) : NaN])));
function pending() { try { return Boolean(pendingHomeworkSettings()); } catch { return false; } }

export function HomeworkSettingsAudit({ panel, onBack, backLabel = "К заданиям" }: { panel: "settings" | "audit"; onBack: () => void; backLabel?: string }) {
  const { user } = useAuth();
  const access = homeworkSettingsAccess(user);
  const key = `${user?.account_id}:${user?.organization_id}:${user?.division_id}:${user?.context_revision}`;
  const division = user?.organizations?.find(org => org.id === user.organization_id)?.divisions.find(item => item.id === user.division_id)?.name;
  if (!user?.division_id || !(panel === "settings" ? access.readSettings : access.readAudit)) return <section className={styles.page}><h1>Раздел недоступен</h1><p>Недостаточно прав в выбранном кабинете.</p><Button variant="secondary" onClick={onBack}>{backLabel}</Button></section>;
  return <section className={styles.page} key={key}>
    <header><h1>{panel === "settings" ? "Настройки домашних работ" : "Аудит домашних работ"}</h1><p>Подразделение: {division ?? `№ ${user.division_id}`}</p></header>
    {panel === "settings" ? <SettingsPanel scopeKey={key} editable={access.writeSettings} onBack={onBack} backLabel={backLabel} /> : <AuditPanel scopeKey={key} onBack={onBack} backLabel={backLabel} />}
  </section>;
}

function SettingsPanel({ scopeKey, editable, onBack, backLabel }: { scopeKey: string; editable: boolean; onBack: () => void; backLabel: string }) {
  const load = useCallback(async (signal: AbortSignal) => pendingHomeworkSettings() ? reconcileHomeworkSettings(signal) : { current: await getHomeworkSettings(signal), applied: null }, []);
  const resource = useRatingResource(scopeKey, load);
  const unresolved = pending();
  useContextGuard(unresolved);
  if (!resource.data) return <>
    <div className={styles.actions}><Button variant="secondary" onClick={onBack} disabled={unresolved}>{backLabel}</Button><Button variant="secondary" onClick={resource.reload} disabled={resource.loading}>Повторить загрузку</Button></div>
    {resource.loading ? <p role="status">Загрузка настроек…</p> : null}
    {resource.error ? <p role="alert">{homeworkSettingsError(resource.error)}</p> : null}
  </>;
  return <SettingsEditor key={scopeKey} initial={resource.data.current} applied={resource.data.applied} editable={editable} onBack={onBack} backLabel={backLabel} />;
}

function SettingsEditor({ initial, applied, editable, onBack, backLabel }: { initial: HomeworkSettings; applied: boolean | null; editable: boolean; onBack: () => void; backLabel: string }) {
  const [baseline, setBaseline] = useState(initial);
  const [draft, setDraft] = useState(() => draftFrom(initial));
  const [busy, setBusy] = useState(false);
  const [unknown, setUnknown] = useState(pending);
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState(applied === true ? "Предыдущее сохранение подтверждено. Настройки прочитаны с сервера." : applied === false ? "Настройки на сервере отличаются от предыдущего сохранения. Показаны текущие значения; повторное сохранение не отправлялось." : "");
  const dirty = fields.some(field => draft[field.key] !== String(baseline[field.key]));
  useContextGuard(dirty || busy || unknown);
  const back = () => { if (!dirty || window.confirm("Отменить несохранённые изменения настроек?")) onBack(); };
  const refresh = async () => {
    if (dirty && !unknown && !window.confirm("Загрузить настройки с сервера и отменить несохранённые изменения?")) return;
    setBusy(true); setFailure(""); setNotice("");
    try {
      const result = await reconcileHomeworkSettings();
      setBaseline(result.current); setDraft(draftFrom(result.current)); setUnknown(false);
      setNotice(result.applied === true ? "Сохранение подтверждено. Настройки на сервере совпадают с отправленными." : result.applied === false ? "Настройки на сервере отличаются от отправленных. Показаны текущие значения; повторное сохранение не отправлялось." : "Настройки обновлены с сервера.");
    } catch (error) { setFailure(homeworkSettingsError(error)); }
    finally { setBusy(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || unknown || !editable) return;
    setBusy(true); setFailure(""); setNotice("");
    try {
      const desired = draftSettings(draft);
      if (sameHomeworkSettings(desired, baseline)) { setDraft(draftFrom(baseline)); return; }
      const saved = await saveHomeworkSettings(desired);
      setBaseline(saved); setDraft(draftFrom(saved)); setNotice("Настройки сохранены.");
    } catch (error) { setFailure(homeworkSettingsError(error)); setUnknown(pending()); }
    finally { setBusy(false); }
  };
  return <>
    <div className={styles.actions}><Button variant="secondary" onClick={back} disabled={busy || unknown}>{backLabel}</Button><Button variant="secondary" onClick={() => void refresh()} disabled={busy}>{unknown ? "Проверить сохранение на сервере" : "Обновить с сервера"}</Button></div>
    {!editable ? <p className={styles.note}>Режим просмотра. Настройки изменяет администратор организации.</p> : null}
    <p className={styles.note}>Лимиты применяются к новым загрузкам в этом подразделении.</p>
    {unknown ? <p role="alert">Исход сохранения неизвестен. Новое сохранение доступно после проверки текущих настроек на сервере.</p> : null}
    {failure ? <p role="alert">{failure}</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    <form onSubmit={event => void submit(event)}>
      <div className={styles.fields}>{fields.map(field => <label className={styles.field} key={field.key}>
        <span>{field.label}</span><input aria-label={field.label} aria-describedby={`hw-setting-help-${field.key}`} type="number" min={field.key === "upload_stale_seconds" ? Math.max(120, 2 * (Number(draft.presign_ttl_seconds) || 60)) : field.min} max={field.max} step={1} required value={draft[field.key]} disabled={!editable || busy || unknown} onChange={event => setDraft(previous => ({ ...previous, [field.key]: event.target.value }))} />
        <small id={`hw-setting-help-${field.key}`}>{field.help}</small>
      </label>)}</div>
      {editable ? <div className={styles.actions}><Button type="submit" disabled={busy || unknown || !dirty}>{busy ? "Сохранение…" : "Сохранить настройки"}</Button><Button type="button" variant="ghost" disabled={busy || unknown || !dirty} onClick={() => { setDraft(draftFrom(baseline)); setFailure(""); }}>Отменить изменения</Button></div> : null}
    </form>
  </>;
}

function AuditPanel({ scopeKey, onBack, backLabel }: { scopeKey: string; onBack: () => void; backLabel: string }) {
  const [cursors, setCursors] = useState([0]);
  const after = cursors.at(-1) ?? 0;
  const load = useCallback((signal: AbortSignal) => getHomeworkAudit(after, 50, signal), [after]);
  const resource = useRatingResource(`${scopeKey}:${after}`, load);
  return <>
    <div className={styles.actions}><Button variant="secondary" onClick={onBack}>{backLabel}</Button><Button variant="secondary" onClick={resource.reload} disabled={resource.loading}>Обновить журнал</Button></div>
    <p className={styles.note}>Действия показаны от старых к новым. Пользователи указаны по ID учётной записи; автоматические действия помечены как «Сервис».</p>
    {resource.loading ? <p role="status">Загрузка журнала…</p> : null}
    {resource.error ? <p role="alert">{homeworkSettingsError(resource.error)}{resource.data ? " Показанная страница не обновлена." : ""}</p> : null}
    {resource.data?.items.length ? <div className={styles.tableWrap}><table><thead><tr><th>ID</th><th>Дата и время (МСК)</th><th>Кто</th><th>Действие</th><th>ID объекта</th></tr></thead><tbody>{resource.data.items.map(entry => <tr key={entry.id}><td>{entry.id}</td><td>{new Date(entry.created_at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}</td><td>{entry.actor_id === null ? "Сервис" : `Учётная запись № ${entry.actor_id}`}</td><td>{homeworkAuditAction(entry.action)}</td><td>{entry.entity_id}</td></tr>)}</tbody></table></div> : !resource.loading && !resource.error ? <p>В журнале нет действий.</p> : null}
    <div className={styles.actions}><Button variant="secondary" disabled={resource.loading || cursors.length === 1} onClick={() => setCursors(previous => previous.slice(0, -1))}>Предыдущая страница</Button><span>Страница {cursors.length}</span><Button variant="secondary" disabled={resource.loading || !!resource.error || !resource.data?.hasMore} onClick={() => { if (resource.data?.hasMore) setCursors(previous => [...previous, resource.data!.nextCursor]); }}>Следующая страница</Button></div>
  </>;
}
