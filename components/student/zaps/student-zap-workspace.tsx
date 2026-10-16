"use client";

import Image from "next/image";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CalendarDays, Check, Clock3, Paperclip, Plus, Send, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { domain } from "@/lib/bff/client";
import { attendanceError, command, ownDivisions, readAttendance, type Zap } from "@/lib/bff/attendance";
import { todayISO } from "@/lib/schedule/utils";
import { formatZapDate, formatZapDateShort } from "@/lib/zaps/zap-date-utils";
import { ActionNotice, useAction } from "@/components/attendance/shared";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { StudentNavIcon } from "@/components/student/navigation/student-nav-icon";
import styles from "./student-zap-workspace.module.css";

interface Upload { mime: string; data: string }
interface Detail { zap: Zap; image_count: number }
const labels: Record<string, string> = { pending: "На рассмотрении", approved: "Одобрено", rejected: "Отклонено", linked: "Отметка привязана", no_class_day: "День занятий ещё не создан", cancelled: "Отменено", failed: "Ошибка привязки" };
function Status({ value }: { value: string }) {
  const Icon = value === "approved" ? Check : value === "rejected" ? X : Clock3;
  return <span className={`${styles.badge} ${value === "approved" ? styles.badgeSuccess : value === "rejected" ? styles.badgeDanger : styles.badgeWarning}`}><Icon size={15} aria-hidden />{labels[value] ?? value}</span>;
}
export function StudentZapWorkspace() {
  return <Suspense fallback={<LoadingState label="Загрузка заявок…" variant="block" />}><StudentZapContent /></Suspense>;
}
function StudentZapContent() {
  const { user } = useAuth();
  const divisions = ownDivisions(user);
  const [division, setDivision] = useState(user?.division_id ?? divisions[0]?.id ?? 0);
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const creating = params.get("create") === "1";
  const request = params.get("request");
  const detailId = request && /^\d+$/.test(request) ? Number(request) : 0;
  const [zaps, setZaps] = useState<Zap[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [revision, setRevision] = useState(0);
  const [editRevision, setEditRevision] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [dates, setDates] = useState<string[]>(() => [todayISO()]);
  const [date, setDate] = useState(todayISO);
  const [images, setImages] = useState<Upload[]>([]);
  const [imageURLs, setImageURLs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const loadSequence = useRef(0);
  const reload = useCallback(async (signal?: AbortSignal) => {
    if (!division) return;
    const sequence = ++loadSequence.current;
    setLoading(true); setError("");
    try {
      const result = await readAttendance<Zap[]>(`/divisions/${division}/zaps`, signal);
      if (signal?.aborted || sequence !== loadSequence.current) return;
      setZaps(result.value); setRevision(result.revision);
      if (detailId) {
        const record = await readAttendance<Detail>(`/divisions/${division}/zaps/${detailId}`, signal);
        if (signal?.aborted || sequence !== loadSequence.current) return;
        setDetail(record.value); setRevision(record.revision);
      }
    } catch (err) { if (!signal?.aborted && sequence === loadSequence.current) setError(attendanceError(err)); }
    finally { if (sequence === loadSequence.current) setLoading(false); }
  }, [division, detailId]);
  const action = useAction(reload);
  useContextGuard(creating || detailId > 0 || uploading);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => { if (!controller.signal.aborted) return reload(controller.signal); });
    return () => controller.abort();
  }, [reload]);
  // Capture the loaded revision when entering the form, including a direct quick-action URL.
  useEffect(() => {
    if (!creating || loading || error || editRevision !== null) return;
    void Promise.resolve().then(() => setEditRevision(revision));
  }, [creating, loading, error, editRevision, revision]);
  const blocked = loading || action.busy || !!action.pending || uploading;
  function navigate(view: "list" | "create" | number, replace = false) {
    const next = new URLSearchParams(params.toString()); next.delete("create"); next.delete("request");
    if (view === "create") next.set("create", "1");
    if (typeof view === "number") next.set("request", String(view));
    setError(""); setDetail(null); setImageURLs([]); setEditRevision(null);
    if (view === "create") { setText(""); setDates([todayISO()]); setDate(todayISO()); setImages([]); }
    router[replace ? "replace" : "push"](pathname + (next.size ? `?${next}` : ""), { scroll: true });
  }
  async function files(list: FileList | null) {
    if (!list) return;
    setUploading(true); setError("");
    try {
      if (list.length + images.length > 3) throw new Error("Можно приложить до трёх изображений");
      const loaded: Upload[] = [];
      for (const file of Array.from(list)) {
        if (file.size > 512 * 1024 || !["image/jpeg", "image/png"].includes(file.type)) throw new Error("Нужны PNG или JPEG до 512 КБ каждый");
        const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = () => reject(new Error("Не удалось прочитать изображение")); reader.readAsDataURL(file); });
        loaded.push({ mime: file.type, data });
      }
      setImages(old => [...old, ...loaded]);
    } catch (err) { setError(attendanceError(err)); }
    finally { setUploading(false); }
  }
  async function attachments() {
    if (!detail) return;
    setError("");
    try {
      const urls = [];
      for (let i = 1; i <= detail.image_count; i++) {
        const record = await domain<Upload>(`/attendance/divisions/${division}/zaps/${detailId}/images/${i}`);
        urls.push(`data:${record.mime};base64,${record.data}`);
      }
      setImageURLs(urls);
    } catch (err) { setError(attendanceError(err)); }
  }
  const notice = <><ActionNotice action={action} />{error ? <div className={styles.alert} role="alert">{error}<Button variant="secondary" disabled={blocked} onClick={() => void reload()}>Повторить загрузку</Button></div> : null}</>;
  if (creating) return <section className={`${styles.page} ${styles.formPage}`} aria-label="Новая заявка на отгул">
    <header className={styles.screenHeader}><button type="button" className={styles.backButton} disabled={action.busy || !!action.pending || uploading} onClick={() => navigate("list", true)} aria-label="К моим заявкам"><ArrowLeft size={23} /></button><h1>Запросить отгул</h1></header>
    <p className={styles.formDescription}>Укажите причину и даты пропуска. Подтверждающий документ можно приложить ниже.</p>
    <form className={styles.form} onSubmit={async event => {
      event.preventDefault();
      if (blocked || editRevision === null || !dates.length || !text.trim()) return;
      await action.execute<Zap>(command(`/divisions/${division}/zaps`, "POST", editRevision, { text, dates, images }), () => navigate("list", true));
    }}>
      <label className={styles.field}>Причина отгула<textarea className={styles.textarea} required maxLength={5000} value={text} placeholder="Почему нужно пропустить занятия?" disabled={blocked} onChange={event => setText(event.target.value)} /></label>
      <div className={styles.field}><span className={styles.fieldLabel}>Даты отгула</span><div className={styles.datePickerRow}><label className={styles.field}><span className={styles.helpText}>Добавить день</span><input className={styles.input} type="date" aria-label="Дата отгула" value={date} disabled={blocked} onChange={event => setDate(event.target.value)} /></label><Button type="button" variant="secondary" disabled={blocked || !date || dates.includes(date) || dates.length >= 60} onClick={() => setDates(old => [...old, date].sort())}><Plus size={17} aria-hidden />Добавить</Button></div>
      <div className={styles.selectedDates}>{dates.map(day => <span className={styles.dateTag} key={day}>{formatZapDateShort(day)}<button type="button" className={styles.dateTagRemove} disabled={blocked} onClick={() => setDates(old => old.filter(value => value !== day))} aria-label={`Убрать дату ${day}`}><X size={16} /></button></span>)}</div><span className={styles.helpText}>Выбрано дат: {dates.length} из 60</span></div>
      <div className={styles.field}><label className={styles.attachmentPicker} htmlFor="zap-images"><Paperclip size={24} aria-hidden /><span><strong>Прикрепить документ</strong><small>До 3 фото · PNG или JPEG · до 512 КБ</small></span></label><input id="zap-images" className={styles.fileInput} type="file" multiple accept="image/png,image/jpeg" disabled={blocked || images.length >= 3} onChange={event => { void files(event.target.files); event.target.value = ""; }} /></div>
      {images.length ? <div className={styles.previewGrid}>{images.map((image, index) => <div className={styles.previewItem} key={index}><Image unoptimized width={260} height={220} className={styles.previewImage} src={`data:${image.mime};base64,${image.data}`} alt={`Документ ${index + 1}`} /><Button type="button" variant="ghost" disabled={blocked} onClick={() => setImages(old => old.filter((_, i) => i !== index))}>Удалить</Button></div>)}</div> : null}
      {notice}<div className={styles.formActions}><Button className={styles.primaryAction} type="submit" disabled={blocked || editRevision === null || !dates.length || !text.trim()}><Send size={19} aria-hidden />{action.busy ? "Отправляем…" : "Отправить заявку"}</Button></div>
    </form>
  </section>;
  if (detailId) return <section className={styles.page} aria-label="Просмотр заявки"><header className={styles.screenHeader}><button type="button" className={styles.backButton} aria-label="К моим заявкам" disabled={action.busy || !!action.pending} onClick={() => navigate("list", true)}><ArrowLeft size={23} /></button><h1>Заявка №{detailId}</h1></header>{notice}
    {loading ? <LoadingState label="Загрузка заявки…" variant="block" /> : detail ? <><Status value={detail.zap.status} /><div className={styles.panel}><div className={styles.detailSection}><p className={styles.detailLabel}>Причина</p><p className={styles.detailText}>{detail.zap.text}</p></div>{detail.zap.answer ? <div className={styles.detailSection}><p className={styles.detailLabel}>Ответ по заявке</p><p className={styles.detailText}>{detail.zap.answer}</p></div> : null}<div className={styles.detailSection}><p className={styles.detailLabel}>Даты отгула</p>{detail.zap.dates.map(day => <div className={styles.dateDetail} key={day.date}><span>{formatZapDate(day.date)}</span><small>{labels[day.status] ?? day.status}</small></div>)}</div>{detail.image_count ? <Button variant="secondary" onClick={() => void attachments()}><Paperclip size={18} aria-hidden />Показать документы · {detail.image_count}</Button> : null}<div className={styles.imagesGrid}>{imageURLs.map((url, index) => <Image unoptimized width={260} height={220} className={styles.image} key={index} src={url} alt={`Подтверждение ${index + 1}`} />)}</div></div></> : null}
  </section>;
  return <section className={styles.page} aria-label="Заявки на отгул">
    <div className={styles.headerActions}><div className={styles.listHeading}><h1>Мои заявки</h1>{!loading ? <span>{zaps.length}</span> : null}</div><Button className={styles.primaryAction} disabled={blocked || !division} onClick={() => navigate("create")}><Plus size={20} aria-hidden />Запросить отгул</Button></div>
    {divisions.length > 1 ? <label className={styles.field}><span className={styles.helpText}>Подразделение</span><select className={styles.input} value={division} disabled={blocked} onChange={event => { setZaps([]); setDivision(Number(event.target.value)); }}>{divisions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
    {notice}{loading ? <LoadingState label="Загрузка заявок…" variant="block" /> : !error && !zaps.length ? <div className={styles.emptyState}><span className={styles.emptyArtwork}><StudentNavIcon kind="zaps" /></span><h2 className={styles.emptyTitle}>Заявок пока нет</h2><p className={styles.emptyText}>Нужно пропустить занятия? Отправьте запрос на отгул. Ответ появится здесь.</p></div> : <div className={styles.zapsList}>{zaps.map(zap => <button type="button" className={styles.zapCard} key={zap.id} onClick={() => navigate(zap.id)} aria-label={`Открыть заявку №${zap.id}`}><div className={styles.zapCardHeader}><span className={styles.zapCardId}>Заявка №{zap.id}</span><Status value={zap.status} /></div><p className={styles.zapCardText}>{zap.text}</p>{zap.answer ? <p className={styles.zapCardAnswer}><strong>Ответ</strong>{zap.answer}</p> : null}<div className={styles.zapCardFooter}><span className={styles.zapCardMeta}><CalendarDays size={16} aria-hidden />{zap.dates.length === 1 ? formatZapDateShort(zap.dates[0].date) : `Дат: ${zap.dates.length}`}</span><ArrowUpRight size={20} aria-hidden /></div></button>)}</div>}
  </section>;
}
