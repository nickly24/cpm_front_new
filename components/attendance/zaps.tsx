"use client";
import Image from "next/image";
import { useCallback, useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { domain } from "@/lib/bff/client";
import { attendanceError, command, ownDivisions, permitted, readAttendance, type Student, type Zap } from "@/lib/bff/attendance";
import { todayISO } from "@/lib/schedule/utils";
import { ActionNotice, styles, useAction } from "./shared";
const names: Record<string, string> = { pending: "На рассмотрении", approved: "Одобрено", rejected: "Отклонено", linked: "Отметка привязана", no_class_day: "День занятий ещё не создан", cancelled: "Отменено", failed: "Ошибка привязки" };
interface Detail {
    zap: Zap;
    image_count: number;
}
interface Upload {
    mime: string;
    data: string;
}
export function AttendanceZapDecision({ status, answer, disabled, onAnswer, onDecision }: {
    status: Zap["status"];
    answer: string;
    disabled: boolean;
    onAnswer: (answer: string) => void;
    onDecision: (decision: "approved" | "rejected") => void;
}) {
    return <><label>Ответ ученику · необязательно<textarea maxLength={5000} value={answer} onChange={e => onAnswer(e.target.value)}/></label>
    {status !== "pending" && <p className={styles.muted}>Решение можно изменить. При отклонении снимаются отметки, связанные с этой заявкой.</p>}
    <div className={styles.actions}><button className={styles.primary} disabled={disabled} onClick={() => onDecision("approved")}>Одобрить отгул</button><button disabled={disabled} onClick={() => onDecision("rejected")}>Отклонить отгул</button></div></>;
}
export function AttendanceZaps() {
    const { user } = useAuth();
    const loadSequence = useRef(0);
    const divisions = ownDivisions(user);
    const [division, setDivision] = useState(user?.division_id ?? divisions[0]?.id ?? 0);
    const [zaps, setZaps] = useState<Zap[]>([]);
    const [revision, setRevision] = useState(0);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("all");
    const [search, setSearch] = useState("");
    const [creating, setCreating] = useState(false);
    const [text, setText] = useState("");
    const [dates, setDates] = useState<string[]>([]);
    const [date, setDate] = useState(todayISO);
    const [images, setImages] = useState<Upload[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [account, setAccount] = useState(0);
    const [detailId, setDetailId] = useState(0);
    const [detail, setDetail] = useState<Detail | null>(null);
    const [imageURLs, setImageURLs] = useState<string[]>([]);
    const [answer, setAnswer] = useState("");
    const [editRevision, setEditRevision] = useState(0);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const edit = permitted(user, division, "zaps", true);
    const create = edit || user?.role === "student";
    const reload = useCallback(async (signal?: AbortSignal) => { if (!division)
        return; const sequence = ++loadSequence.current; setLoading(true); setError(""); try {
        const res = await readAttendance<Zap[]>(`/divisions/${division}/zaps`, signal);
        if (signal?.aborted || sequence !== loadSequence.current)
            return;
        setZaps(res.value);
        setRevision(res.revision);
        if (detailId) {
            const d = await readAttendance<Detail>(`/divisions/${division}/zaps/${detailId}`, signal);
            if (signal?.aborted || sequence !== loadSequence.current)
                return;
            setDetail(d.value);
            setRevision(d.revision);
        }
    }
    catch (e) {
        if (!signal?.aborted && sequence === loadSequence.current)
            setError(attendanceError(e));
    }
    finally {
        if (sequence === loadSequence.current)
            setLoading(false);
    } }, [division, detailId]);
    const action = useAction(reload);
    useContextGuard(creating || detailId > 0 || uploading);
    useEffect(() => { const controller = new AbortController(); void Promise.resolve().then(() => { if (!controller.signal.aborted)
        return reload(controller.signal); }); return () => controller.abort(); }, [reload]);
    async function openCreate() { setCreating(true); setText(""); setDates([todayISO()]); setImages([]); setEditRevision(revision); if (edit) {
        try {
            const r = await readAttendance<Student[]>(`/divisions/${division}/students`);
            setStudents(r.value);
            setAccount(r.value[0]?.account_id ?? 0);
        }
        catch (e) {
            setError(attendanceError(e));
        }
    } }
    async function files(files: FileList | null) { if (!files)
        return; setUploading(true); try {
        if (files.length + images.length > 3)
            throw new Error("Можно приложить до трёх изображений");
        const loaded: Upload[] = [];
        for (const file of Array.from(files)) {
            if (file.size > 512 * 1024 || !["image/jpeg", "image/png"].includes(file.type))
                throw new Error("Нужны PNG или JPEG до 512 КБ каждый");
            const data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(",")[1]); r.onerror = () => reject(new Error("Не удалось прочитать изображение")); r.readAsDataURL(file); });
            loaded.push({ mime: file.type, data });
        }
        setImages(old => [...old, ...loaded]);
    }
    catch (e) {
        setError(attendanceError(e));
    }
    finally {
        setUploading(false);
    } }
    async function attachments() { if (!detail)
        return; setError(""); try {
        const urls = [];
        for (let i = 1; i <= detail.image_count; i++) {
            const r = await domain<Upload>(`/attendance/divisions/${division}/zaps/${detailId}/images/${i}`);
            urls.push(`data:${r.mime};base64,${r.data}`);
        }
        ;
        setImageURLs(urls);
    }
    catch (e) {
        setError(attendanceError(e));
    } }
    async function process(decision: "approved" | "rejected") { await action.execute<Zap>(command(`/divisions/${division}/zaps/${detailId}/process`, "POST", revision, { status: decision, answer }), result => setAnswer(result.value.answer)); }
    const visible = zaps.filter(z => (status === "all" || z.status === status) && (!search || `${z.text} ${z.answer}`.toLowerCase().includes(search.toLowerCase())));
    return <section className={styles.workspace}>
 <header><h1>Отгулы</h1><p className={styles.muted}>Заявки, решения и даты относятся к выбранному подразделению.</p></header>
 <div className={styles.toolbar}>
 <label>Подразделение отгулов<select value={division} disabled={creating || detailId > 0 || !!action.pending} onChange={e => { if (Number(e.target.value) === division) return; setLoading(true); setZaps([]); setDivision(Number(e.target.value)); setImageURLs([]); }}>{divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
 <label>Статус<select value={status} onChange={e => setStatus(e.target.value)}><option value="all">Все заявки</option>{["pending", "approved", "rejected"].map(s => <option key={s} value={s}>{names[s]}</option>)}</select></label>
 <label>Поиск<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Текст заявки или ответа"/></label>
 <button disabled={loading} onClick={() => void reload()}>Обновить</button>{create && <button className={styles.primary} disabled={loading || action.busy || !!action.pending} onClick={() => void openCreate()}>Подать заявку</button>}
 </div>
 {error && <p className={styles.error} role="alert">{error}</p>}<ActionNotice action={action}/>{loading && <p>Загрузка заявок…</p>}
 <div className={styles.cards}>{visible.map(z => <article className={styles.panel} key={z.id}><div className={styles.eventHeader}><strong>{z.dates.map(d => d.date).join(", ")}</strong><span className={styles.badge}>{names[z.status]}</span></div><p>{z.text}</p>{z.answer && <p>Ответ: {z.answer}</p>}<button onClick={() => { setDetailId(z.id); setDetail(null); setImageURLs([]); setAnswer(z.answer); }}>Открыть заявку</button></article>)}{!loading && !visible.length && <p>Заявок пока нет.</p>}</div>
 {creating && <div className={styles.modal}><form className={styles.dialog} role="dialog" aria-modal="true" aria-label="Заявка на отгул" onSubmit={async (e) => { e.preventDefault(); await action.execute<Zap>(command(`/divisions/${division}/zaps`, "POST", editRevision, { text, dates, images, ...(edit ? { account_id: account } : {}) }), () => setCreating(false)); }}>
 <h2>Новая заявка на отгул</h2>{edit && <label>Ученик<select required value={account || ""} onChange={e => setAccount(Number(e.target.value))}><option value="">Выберите ученика</option>{students.map(s => <option key={s.account_id} value={s.account_id}>{s.full_name}</option>)}</select></label>}
 <label>Причина<textarea required maxLength={5000} value={text} onChange={e => setText(e.target.value)}/></label>
 <div className={styles.toolbar}><label>Дата отгула<input type="date" value={date} onChange={e => setDate(e.target.value)}/></label><button type="button" disabled={!date || dates.includes(date) || dates.length >= 60} onClick={() => setDates(old => [...old, date].sort())}>Добавить дату</button><span className={styles.muted}>Дат: {dates.length} из 60</span></div>
 <div className={styles.checks}>{dates.map(d => <button type="button" key={d} onClick={() => setDates(old => old.filter(v => v !== d))} aria-label={`Убрать дату ${d}`}>{d} ×</button>)}</div>
 <label>Подтверждающие изображения<input type="file" multiple accept="image/png,image/jpeg" disabled={uploading || images.length >= 3} onChange={e => void files(e.target.files)}/></label>
 <p className={styles.muted}>До трёх PNG/JPEG, каждый до 512 КБ. Приложения доступны владельцу заявки и сотруднику с правом просмотра отгулов.</p>
 <div className={styles.cards}>{images.map((i, n) => <div key={n}><Image unoptimized width={260} height={220} className={styles.image} src={`data:${i.mime};base64,${i.data}`} alt={`Приложение ${n + 1}`}/><button type="button" onClick={() => setImages(old => old.filter((_, index) => index !== n))}>Убрать изображение</button></div>)}</div>
 <ActionNotice action={action}/><div className={styles.actions}><button className={styles.primary} disabled={!dates.length || action.busy || !!action.pending || uploading}>Отправить заявку</button><button type="button" disabled={action.busy || !!action.pending || uploading} onClick={() => setCreating(false)}>Закрыть</button></div>
 </form></div>}
 {detailId > 0 && <div className={styles.modal}><div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Заявка на отгул"><h2>Заявка на отгул</h2>
 {detail ? <><span className={styles.badge}>{names[detail.zap.status]}</span><p>{detail.zap.text}</p>{detail.zap.answer && <p>Ответ: {detail.zap.answer}</p>}
 <div className={styles.cards}>{detail.zap.dates.map(d => <article key={d.date} className={styles.event}><strong>{d.date}</strong><span>{names[d.status] ?? d.status}</span>{edit && detail.zap.status === "approved" && <div className={styles.actions}>{d.status !== "linked" ? <button disabled={loading || action.busy || !!action.pending} onClick={() => void action.execute(command(`/divisions/${division}/zaps/${detailId}/dates/${d.date}/retry`, "POST", revision, {}))}>Повторить привязку даты</button> : <button disabled={loading || action.busy || !!action.pending} onClick={() => void action.execute(command(`/divisions/${division}/zaps/${detailId}/dates/${d.date}`, "DELETE", revision, {}))}>Отвязать дату</button>}</div>}</article>)}</div>
 {detail.image_count > 0 && <button onClick={() => void attachments()}>Показать приложения · {detail.image_count}</button>}{imageURLs.map((url, n) => <Image unoptimized width={260} height={220} className={styles.image} key={n} src={url} alt={`Подтверждение ${n + 1}`}/>)}
 {edit && <AttendanceZapDecision status={detail.zap.status} answer={answer} disabled={loading || action.busy || !!action.pending} onAnswer={setAnswer} onDecision={decision => void process(decision)}/>}</> : <p>Загрузка заявки…</p>}
 <ActionNotice action={action}/><button disabled={loading || action.busy || !!action.pending} onClick={() => { setDetailId(0); setDetail(null); setImageURLs([]); }}>Закрыть заявку</button>
 </div></div>}
 </section>;
}
