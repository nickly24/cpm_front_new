"use client";
import { DismissibleOverlay } from "@/components/ui/dismissible-overlay";
import { MonthPicker } from "@/components/attendance/month-picker";
import styles from "@/components/attendance/attendance-admin.module.css";
import { getMonthRange, todayIsoDate } from "@/lib/attendance/attendance-utils";
import { Calendar, CalendarRange, CalendarDays, ArrowRight, FileSpreadsheet, X } from "lucide-react";
import { useState } from "react";
export type PeriodMode="current_month"|"year_month"|"date_range";
export interface ReportPeriodSelection {dateFrom:string;dateTo:string}
interface PeriodModalProps {title?:string;onClose:()=>void;onCreate:(period:ReportPeriodSelection)=>void}
const modes=[{id:"current_month",label:"Этот месяц",icon:Calendar},{id:"year_month",label:"Другой месяц",icon:CalendarDays},{id:"date_range",label:"Свой период",icon:CalendarRange}] as const;
export function PeriodModal({title="Журнал посещаемости",onClose,onCreate}:PeriodModalProps) {
 const now=new Date();const [mode,setMode]=useState<PeriodMode>("current_month"),[year,setYear]=useState(now.getFullYear()),[month,setMonth]=useState(now.getMonth()+1),[dateFrom,setDateFrom]=useState(todayIsoDate()),[dateTo,setDateTo]=useState(todayIsoDate()),[error,setError]=useState("");
 const range=mode==="date_range"?{dateFrom,dateTo}:getMonthRange(mode==="current_month"?now.getFullYear():year,mode==="current_month"?now.getMonth()+1:month);
 return <DismissibleOverlay className={styles.overlay} onDismiss={onClose}><form role="dialog" aria-modal="true" aria-label={title} className={styles.modal} onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();onClose();}}} onSubmit={e=>{e.preventDefault();if(!range.dateFrom||!range.dateTo){setError("Укажите обе даты");return;}if(range.dateFrom>range.dateTo){setError("Дата «с» не может быть позже даты «по»");return;}onCreate({dateFrom:range.dateFrom,dateTo:range.dateTo});}}>
 <button type="button" className={styles.close} aria-label="Закрыть выбор периода" onClick={onClose}><X size={18}/></button><div className={styles.heroIcon}><FileSpreadsheet size={26}/></div><h3>{title}</h3><p className={styles.subtitle}>Выберите период. Журнал откроется в виде таблицы с днями занятий и отметками учеников.</p><div className={styles.modes}>{modes.map(({id,label,icon:Icon})=><button key={id} type="button" className={styles.mode} aria-pressed={mode===id} onClick={()=>{setMode(id);setError("");}}><Icon size={22}/>{label}</button>)}</div>
 {mode==="year_month"&&<MonthPicker inline value={`${year}-${String(month).padStart(2,"0")}`} onChange={v=>{setYear(Number(v.slice(0,4)));setMonth(Number(v.slice(5,7)));}}/>}
 {mode==="date_range"&&<div className={styles.dateFields}><label>С<input aria-label="С" type="date" required value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></label><label>По<input aria-label="По" type="date" required value={dateTo} onChange={e=>setDateTo(e.target.value)}/></label></div>}
 <div className={styles.periodSummary}><CalendarDays size={17}/>{range.dateFrom&&range.dateTo?`${new Date(range.dateFrom+"T12:00:00").toLocaleDateString("ru-RU")} — ${new Date(range.dateTo+"T12:00:00").toLocaleDateString("ru-RU")}`:"Выберите даты"}</div>{error&&<p className={styles.error} role="alert">{error}</p>}<div className={styles.modalActions}><button type="button" className={styles.secondary} onClick={onClose}>Отмена</button><button type="submit" className={styles.primary}>Открыть отчёт<ArrowRight size={16}/></button></div></form></DismissibleOverlay>;
}
