"use client";
import { coreDashboard, coreError, type CoreDashboard } from "@/lib/bff/core-admin";
import { useEffect, useState } from "react";
import styles from "@/components/admin/users/admin-users.module.css";
const LABELS={students:"Ученики",staff:"Персонал",groups:"Группы",schools:"Школы организации"};
export function CoreDashboardSummary(){
  const [data,setData]=useState<CoreDashboard|null>(null),[error,setError]=useState<string|null>(null),[reload,setReload]=useState(0);
  useEffect(()=>{const controller=new AbortController();void coreDashboard(controller.signal).then(value=>{if(!controller.signal.aborted){setData(value);setError(null);}}).catch(e=>{if(!controller.signal.aborted)setError(coreError(e).message);});return ()=>controller.abort();},[reload]);
  return <section aria-label="Данные выбранного подразделения"><p className={styles.hint}>{data?`Подразделение: ${data.division_name}`:"Загрузка данных подразделения…"}</p>{data?<div className={styles.statsRow}>{(Object.keys(LABELS) as (keyof typeof LABELS)[]).filter(k=>data.totals[k]!==null).map(key=><span key={key} className={styles.statPill}>{LABELS[key]}: <strong>{data.totals[key]}</strong></span>)}</div>:null}{error?<p role="alert">{error}</p>:null}<button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" onClick={()=>setReload(v=>v+1)}>Обновить данные</button></section>;
}
