"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@/lib/auth/types";
import { useAuth } from "@/contexts/AuthContext";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { attendanceError, command, ownDivisions, permitted, readAttendance, type AttendanceType, type Day, type Entry } from "@/lib/bff/attendance";
import { MonthPicker } from "./month-picker";
import { monthRange } from "@/components/student/attendance/monthly-attendance";
import { todayISO } from "@/lib/schedule/utils";
import { AttendanceCamera } from "./camera";
import { ActionNotice, useAction } from "./shared";
import styles from "./scanner.module.css";

export function scanDivisions(user: User | null) {
  return ownDivisions(user).filter(d => permitted(user, d.id, "attendance", true) || permitted(user, d.id, "scan", true) || user?.role === "proctor" && d.group_id != null);
}
export function AttendanceScanner() {
  const { user } = useAuth();
  const divisions = scanDivisions(user);
  const [division, setDivision] = useState(() => divisions.find(d => d.id === user?.division_id)?.id ?? divisions[0]?.id ?? 0);
  const [month, setMonth] = useState(() => todayISO().slice(0,7));
  const [day, setDay] = useState(0), [days, setDays] = useState<Day[]>([]);
  const [scanType, setScanType] = useState<AttendanceType | null>(null);
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  const [camera, setCamera] = useState(false), [input, setInput] = useState("");
  const [last, setLast] = useState<{ok:boolean;text:string}|null>(null);
  const [recent, setRecent] = useState<Entry[]>([]);
  const revision = useRef(0), sequence = useRef(0), running = useRef(false), ready = useRef(false), alive = useRef(true);
  const {from,to} = monthRange(month+"-01");
  const reload = useCallback(async(signal?:AbortSignal) => {
    if (!division) { setLoading(false); return; }
    const id = ++sequence.current;ready.current=false;setLoading(true);setLoadError("");
    try {
      const [dates,types] = await Promise.all([readAttendance<Day[]>(`/divisions/${division}/class-days?date_from=${from}&date_to=${to}`,signal),readAttendance<AttendanceType[]>(`/divisions/${division}/attendance-types`,signal)]);
      if (!alive.current || signal?.aborted || sequence.current!==id) return;
      if(dates.revision!==types.revision)throw Error("Журнал изменился во время загрузки. Обновите данные.");
      revision.current=dates.revision;setDays(dates.value);setDay(current=>dates.value.some(d=>d.id===current)?current:0);
      setScanType(types.value.find(t=>t.is_active&&t.scan_default)??null);ready.current=true;
    }catch(e){if(alive.current&&!signal?.aborted&&sequence.current===id)setLoadError(attendanceError(e));}
    finally{if(alive.current&&!signal?.aborted&&sequence.current===id)setLoading(false);}
  },[division,from,to]);
  const action=useAction(reload);
  useContextGuard(camera);
  useEffect(()=>{alive.current=true;const controller=new AbortController();void Promise.resolve().then(()=>{if(!controller.signal.aborted)return reload(controller.signal);});return()=>{alive.current=false;ready.current=false;controller.abort();};},[reload]);
  const allowed=divisions.some(d=>d.id===division);
  const busy=loading||action.busy||!!action.pending||action.recovery==="committed";
  const canScan=allowed&&!!day&&!!scanType&&!busy&&!loadError;
  async function scan(raw:string){
    if(!canScan||!ready.current||running.current)return;
    const value=raw.trim();if(!value)return;
    if(!/^[1-9][0-9]{0,18}$/.test(value)&&!value.startsWith("attendance-qr-v1.")){setLast({ok:false,text:"QR должен содержать ID ученика."});return;}
    running.current=true;setLast(null);action.setError("");
    try {
      const result=await action.execute<Entry>(command(`/divisions/${division}/class-days/${day}/scan`,"POST",revision.current,{qr:value}));
      if(!alive.current)return;
      setInput("");
      if(result){setLast({ok:true,text:`Отмечен: ${result.value.full_name}`});setRecent(current=>[result.value,...current.filter(e=>e.account_id!==result.value.account_id)].slice(0,8));}
      else{setLast({ok:false,text:`ID ${value.startsWith("attendance-")?"ученика":value}: отметка не добавлена`});await reload();}
    }finally{running.current=false;}
  }
  const feedback=<><ActionNotice action={action}/>{last&&<p role="status" className={last.ok?styles.success:styles.warning}>{last.text}</p>}</>;
  if(!divisions.length)return <section className={styles.page}><h1>Сканирование посещаемости</h1><p>Нет подразделений, в которых вам разрешено отмечать посещаемость.</p></section>;
  return <section className={styles.page}>
    <header><h1>Сканирование посещаемости</h1><p>Выберите подразделение и день. Сканируйте QR с ID профиля ученика — отметка сохранится автоматически.</p></header>
    <div className={styles.panel}><div className={styles.fields}>
      <label>Подразделение<select aria-label="Подразделение сканирования" value={division} disabled={busy||camera} onChange={e=>{ready.current=false;setLoading(true);setDivision(Number(e.target.value));setDay(0);setInput("");setLast(null);setRecent([]);}}>{divisions.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <div><span className={styles.label}>Месяц занятий</span><fieldset disabled={busy||camera}><MonthPicker value={month} onChange={value=>{ready.current=false;setLoading(true);setMonth(value);setDay(0);setLast(null);setRecent([]);}}/></fieldset></div>
      <label>День занятий<select aria-label="День сканирования" value={day} disabled={busy||camera} onChange={e=>{setDay(Number(e.target.value));setInput("");setLast(null);setRecent([]);}}><option value={0}>Выберите день</option>{days.map(d=><option key={d.id} value={d.id}>{d.date}{d.comment?` · ${d.comment}`:""}</option>)}</select></label>
    </div>{loading?<p role="status">Загрузка дней занятий…</p>:null}{loadError&&<p role="alert">{loadError}</p>}{!loading&&!days.length?<p>В этом месяце нет дней занятий.</p>:null}{!loading&&!scanType?<p role="alert">Для подразделения не настроен активный тип «Для сканирования».</p>:null}{scanType?<p className={styles.note}>При сканировании: <strong>{scanType.name}</strong>. Повторная отметка не перезаписывается.</p>:null}
    <button type="button" disabled={busy||camera} onClick={()=>void reload()}>Обновить дни</button></div>
    <div className={styles.panel}><h2>Отметить ученика</h2><form className={styles.inputRow} onSubmit={e=>{e.preventDefault();void scan(input);}}><label>ID профиля ученика или данные QR<input aria-label="ID профиля ученика" autoComplete="off" maxLength={2048} inputMode="numeric" value={input} disabled={!canScan||camera} onChange={e=>setInput(e.target.value)}/></label><button className={styles.primary} disabled={!canScan||!input.trim()||camera}>Отметить</button><button type="button" disabled={!canScan} onClick={()=>setCamera(true)}>Сканировать камерой</button></form>{!camera&&feedback}</div>
    {recent.length>0&&<div className={styles.panel}><h2>Отмечены в этом сеансе</h2><ul className={styles.recent}>{recent.map(entry=><li key={entry.account_id}><strong>{entry.full_name}</strong><span>{entry.type.name}</span></li>)}</ul></div>}
    {camera&&<AttendanceCamera continuous disabled={!canScan} onRead={code=>void scan(code)} onClose={()=>setCamera(false)}>{feedback}</AttendanceCamera>}
  </section>;
}
