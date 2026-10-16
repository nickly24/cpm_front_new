"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, Minus, ShieldCheck } from "lucide-react";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useAuth } from "@/contexts/AuthContext";
import { attendanceError, ownDivisions, readAttendance, type Journal } from "@/lib/bff/attendance";
import { civil, isoDate, offsetMonth } from "@/components/student/schedule/calendar-utils";
import { attendanceColors, attendanceKind, attendanceLabels, monthRange, monthlyAttendance, type AttendanceKind } from "./monthly-attendance";
import styles from "./student-monthly-attendance.module.css";
const kinds:AttendanceKind[]=["present","excused","absent","other"];
const icons={present:Check,excused:ShieldCheck,absent:Minus,other:CircleHelp};
function Symbol({kind}:{kind:AttendanceKind|"unmarked"}){const Icon=kind==="unmarked"?Clock3:icons[kind];return <span className={styles.symbol} style={{"--status-color":kind==="unmarked"?"#a0a6b2":attendanceColors[kind]} as CSSProperties}><Icon size={15} aria-hidden/></span>;}
export function StudentMonthlyAttendance(){
  const {user}=useAuth();const divisions=ownDivisions(user);
  const desktop=useMediaQuery("(min-width: 1024px)");
  const scroller=useRef<HTMLDivElement>(null);const savedScroll=useRef(0);
  const [month,setMonth]=useState(()=>isoDate(new Date()).slice(0,7)+"-01");
  const [division,setDivision]=useState<number|null>(null);const [selectedDate,setSelectedDate]=useState<string|null>(null);
  const [data,setData]=useState<{key:string;journals:Journal[]}|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [revision,setRevision]=useState(0);
  const {from,to}=monthRange(month);const account=user?.account_id,organization=user?.organization_id;
  const key=`${organization}:${account}:${month}`;
  useEffect(()=>{if(!account||!organization)return;const controller=new AbortController();void Promise.resolve().then(async()=>{
    if(controller.signal.aborted)return;setLoading(true);setError("");
    try{const response=await readAttendance<Journal[]>(`/me/attendance?date_from=${from}&date_to=${to}`,controller.signal);if(!controller.signal.aborted)setData({key,journals:response.value});}
    catch(err){if(!controller.signal.aborted)setError(attendanceError(err));}finally{if(!controller.signal.aborted)setLoading(false);}
  });return()=>controller.abort();},[from,to,account,organization,key,revision]);
  const ready=data?.key===key&&!loading&&!error;
  const model=monthlyAttendance(ready?data.journals:[],account??0,from,to,division);
  const active=model.days.find(day=>day.date===selectedDate);
  const name=(id:number)=>divisions.find(item=>item.id===id)?.name??`Подразделение ${id}`;
  useEffect(()=>{const frame=requestAnimationFrame(()=>{if(desktop)window.scrollTo({top:selectedDate?0:savedScroll.current,behavior:"instant"});else if(scroller.current)scroller.current.scrollTop=selectedDate?0:savedScroll.current;});return()=>cancelAnimationFrame(frame);},[selectedDate,desktop]);
  const changeMonth=(delta:number)=>{savedScroll.current=0;if(scroller.current)scroller.current.scrollTop=0;setMonth(current=>offsetMonth(current,delta));setSelectedDate(null);};
  const title=civil(month).toLocaleDateString("ru-RU",{month:"long",year:"numeric"}).replace(" г.","");
  const busy=loading||(!error&&!ready);
  const circumference=2*Math.PI*52;
  const empty=<div className={styles.empty}><CalendarDays size={28}/><p>За этот месяц записей пока нет</p><span>Когда появятся отметки, здесь будет сводка посещаемости.</span></div>;
  const status=<>{busy?<div className={styles.loading} role="status" aria-label="Загрузка посещаемости"><span/></div>:null}{error?<div className={styles.error} role="alert"><p>{error}</p><button onClick={()=>setRevision(n=>n+1)}>Повторить</button></div>:null}</>;
  if(selectedDate)return <section className={styles.page} aria-label="Посещаемость за день"><header className={styles.detailHeader}><button className={styles.iconButton} type="button" aria-label="К посещаемости за месяц" onClick={()=>setSelectedDate(null)}><ArrowLeft size={23}/></button><h1>{civil(selectedDate).toLocaleDateString("ru-RU",{day:"numeric",month:"long"})}<small>{civil(selectedDate).toLocaleDateString("ru-RU",{weekday:"long"})}</small></h1></header><div className={styles.scroller} ref={scroller}>{status}{active?.rows.map(row=><section className={styles.dayDetail} key={`${row.division}:${row.day.id}`}><p className={styles.divisionName}>{name(row.division)}</p><div className={styles.detailStatus}><Symbol kind={row.entry?attendanceKind(row.entry.type):"unmarked"}/><h2>{row.entry?.type.name??"Не отмечено"}</h2></div>{row.day.comment?<p className={styles.comment}>{row.day.comment}</p>:null}{!row.entry?<p className={styles.comment}>Отметка за этот день ещё не выставлена. Это не считается пропуском.</p>:null}{row.entry?.zap_id?<Link className={styles.zapLink} href={`/cabinet/student/zaps?request=${row.entry.zap_id}`}>Заявка на отгул<ChevronRight size={17}/></Link>:null}</section>)}{!busy&&!error&&!active?empty:null}</div></section>;
  return <section className={styles.page} aria-label="Посещаемость за месяц">
    <div className={styles.toolbar}><div className={styles.monthBar}><button type="button" className={styles.iconButton} aria-label="Предыдущий месяц" onClick={()=>changeMonth(-1)}><ChevronLeft size={23}/></button><h1>{title}</h1><button type="button" className={styles.iconButton} aria-label="Следующий месяц" onClick={()=>changeMonth(1)}><ChevronRight size={23}/></button></div>
    {desktop&&divisions.length>1?<label className={styles.divisionSelect}><span>Подразделение</span><select value={division??"all"} onChange={event=>setDivision(event.target.value==="all"?null:Number(event.target.value))}><option value="all">Общее</option>{divisions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>:null}</div>
    {!desktop&&divisions.length>1?<div className={styles.filters} role="group" aria-label="Подразделения"><button type="button" aria-pressed={division===null} onClick={()=>setDivision(null)}>Общее</button>{divisions.map(item=><button type="button" key={item.id} aria-pressed={division===item.id} onClick={()=>setDivision(item.id)}>{item.name}</button>)}</div>:null}
    <div className={styles.scroller} ref={scroller}>{status}{ready?<div className={styles.monthlyLayout}>
      <div className={styles.summaryPanel}><h2 className={styles.summaryHeading}>За месяц</h2><div className={styles.overview}>
        <div className={styles.ring} role="img" aria-label={model.total?`Присутствие: ${model.presentPercent}%. Всего отметок: ${model.total}. ${kinds.map(kind=>`${attendanceLabels[kind]}: ${model.counts[kind]}`).join(". ")}`:"Нет отметок для расчёта"}>
          <svg viewBox="0 0 128 128" aria-hidden><circle cx="64" cy="64" r="52" className={styles.ringTrack}/>{kinds.map((kind,index)=>{const length=model.total?model.counts[kind]/model.total*circumference:0;const start=model.total?kinds.slice(0,index).reduce((sum,previous)=>sum+model.counts[previous]/model.total*circumference,0):0;return length?<circle key={kind} cx="64" cy="64" r="52" fill="none" stroke={attendanceColors[kind]} strokeWidth="10" strokeDasharray={`${Math.max(0,length-3)} ${circumference-Math.max(0,length-3)}`} strokeDashoffset={-start} transform="rotate(-90 64 64)"/>:null;})}</svg>
          <div className={styles.ringCenter}><strong>{model.presentPercent===null?"—":`${model.presentPercent}%`}</strong><span>присутствие</span></div>
        </div>
        <div className={styles.legend}>{kinds.filter(kind=>kind!=="other"||model.counts.other>0).map(kind=><div key={kind}><i style={{background:attendanceColors[kind]}}/><span>{attendanceLabels[kind]}</span><strong>{model.counts[kind]}</strong></div>)}</div>
      </div>
      <p className={styles.summaryNote}>{model.total?`По выставленным отметкам: ${model.total}`:"Пока нет отметок для расчёта"}{model.unmarked>0?<span>Не отмечено: {model.unmarked} · в расчёт не входят</span>:null}</p>
      <div className={styles.absence}><div className={styles.absenceHeading}><span>Без уважительной причины</span><strong>{model.absentPercent===null?"—":`${model.absentPercent}%`}</strong></div><div className={styles.progress} role="progressbar" aria-label="Доля пропусков без уважительной причины" aria-valuemin={0} aria-valuemax={100} aria-valuenow={model.absentPercent??0} aria-valuetext={model.total?`${model.counts.absent} из ${model.total} отметок`:"Нет отметок для расчёта"}><span style={{width:`${model.absentPercent??0}%`}}/></div><div className={styles.progressCaption}><span>{model.total?`${model.counts.absent} из ${model.total} отметок`:"Отметки ещё не выставлены"}</span>{model.total?<span>Остальные — {model.total-model.counts.absent}</span>:null}</div></div>
      </div><div className={styles.daysPanel}><div className={styles.daysHeading}><h2>По дням</h2><span>{model.days.length}</span></div>
      {model.days.length?<div className={styles.dayList}>{model.days.map(day=>{const entries=day.rows.flatMap(row=>row.entry?[row.entry]:[]);return <button type="button" key={day.date} className={styles.dayRow} aria-label={`Посмотреть ${civil(day.date).toLocaleDateString("ru-RU",{day:"numeric",month:"long"})}`} onClick={()=>{savedScroll.current=desktop?window.scrollY:scroller.current?.scrollTop??0;setSelectedDate(day.date);}}><span className={styles.dateNumber}>{civil(day.date).getDate()}<small>{civil(day.date).toLocaleDateString("ru-RU",{weekday:"short"})}</small></span><span className={styles.rowCopy}><strong>{desktop&&entries.length>0?kinds.flatMap(kind=>{const count=entries.filter(entry=>attendanceKind(entry.type)===kind).length;return count?[`${attendanceLabels[kind]}: ${count}`]:[];}).join(" · "):day.rows.length===1?(entries[0]?.type.name??"Не отмечено"):`Отметок: ${entries.length} из ${day.rows.length}`}</strong><small>{day.rows.length===1?name(day.rows[0].division):`Подразделений: ${day.rows.length}`}</small></span><span className={styles.rowSymbols} aria-hidden>{day.rows.slice(0,3).map(row=><Symbol key={row.division} kind={row.entry?attendanceKind(row.entry.type):"unmarked"}/>)}{day.rows.length>3?<small>+{day.rows.length-3}</small>:null}</span><ChevronRight size={17} aria-hidden/></button>;})}</div>:empty}
    </div></div>:null}</div>
  </section>;
}
