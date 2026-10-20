"use client";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, FileSpreadsheet, RotateCcw, X } from "lucide-react";
import { prepareJournal, journalLoadError, type PreparedJournal } from "@/lib/attendance/journal-workspace";
import type { ReportPeriodSelection } from "@/components/admin/attendance/report/period-modal";
import { AttendanceActivity } from "./activity";
import styles from "./attendance-admin.module.css";
export function ReportPreparation({division,divisionName,period,onReady,onCancel}: {division:number;divisionName:string;period:ReportPeriodSelection;onReady:(data:PreparedJournal)=>void;onCancel:()=>void}) {
 const [attempt,setAttempt]=useState(0),[error,setError]=useState("");
 const ready=useRef(onReady);useEffect(()=>{ready.current=onReady;},[onReady]);
 useEffect(()=>{const controller=new AbortController();let active=true;
  void Promise.resolve().then(()=>{if(!controller.signal.aborted)return prepareJournal(division,period.dateFrom,period.dateTo,controller.signal);}).then(data=>{if(active&&data)ready.current(data);}).catch(e=>{if(active&&!controller.signal.aborted)setError(journalLoadError(e));});
  return()=>{active=false;controller.abort();};
 },[division,period.dateFrom,period.dateTo,attempt]);
 return <div className={styles.overlay}><section className={styles.preparation} role="dialog" aria-modal="true" aria-label="Подготовка отчёта"><button type="button" className={styles.close} aria-label="Отменить подготовку" onClick={onCancel}><X size={18}/></button><div className={styles.heroIcon}><FileSpreadsheet size={26}/></div><h2>{error?"Не удалось открыть отчёт":"Готовим журнал"}</h2><p className={styles.subtitle}>{divisionName}</p><div className={styles.periodSummary}><CalendarDays size={17}/>{new Date(period.dateFrom+"T12:00:00").toLocaleDateString("ru-RU")} — {new Date(period.dateTo+"T12:00:00").toLocaleDateString("ru-RU")}</div>{error?<p className={styles.error} role="alert">{error}</p>:<><div className={styles.progressTrack} role="progressbar" aria-label="Подготовка журнала"><span/></div><ol className={styles.steps}><li><Check size={17}/>Период выбран</li><li aria-current="step"><AttendanceActivity label="Получение дней, учеников и отметок"/>Дни, ученики и отметки</li><li className={styles.stepWaiting}><FileSpreadsheet size={17}/>Таблица журнала</li></ol></>}<div className={styles.modalActions}><button type="button" className={styles.secondary} onClick={onCancel}>Отмена</button>{error&&<button type="button" className={styles.primary} onClick={()=>{setError("");setAttempt(n=>n+1);}}><RotateCcw size={16}/>Повторить</button>}</div></section></div>;
}
