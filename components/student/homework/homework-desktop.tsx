"use client";
import { useState } from "react";
import { BookOpen, Check, ChevronDown, Clock3, FileText, LoaderCircle, RotateCcw, Search, Upload } from "lucide-react";
import { formatHomeworkDate } from "@/lib/student/homework-api";
import type { StudentHomeworkItem, HomeworkStatusFilter } from "@/lib/student/homework-types";
import { homeworkStatuses, type HomeworkSearchValues } from "./homework-search-screen";
import styles from "./homework-desktop.module.css";

export function HomeworkDesktopToolbar({initial,types,counts,onApply}:{initial:HomeworkSearchValues;types:string[];counts?:Record<HomeworkStatusFilter,number>;onApply:(values:HomeworkSearchValues)=>void}) {
  const [search,setSearch]=useState(initial.search);
  return <form className={styles.toolbar} aria-label="Поиск и фильтры заданий" onSubmit={event=>{event.preventDefault();onApply({...initial,search:search.trim()});}}>
    <label className={styles.search}><Search size={19}/><input type="search" maxLength={200} placeholder="Найти задание" aria-label="Найти задание" value={search} onChange={event=>setSearch(event.target.value)}/><button type="submit">Найти</button></label>
    <label className={styles.filter}><span>Статус</span><select aria-label="Статус заданий" value={initial.status} onChange={event=>onApply({...initial,search:search.trim(),status:event.target.value as HomeworkStatusFilter})}>{homeworkStatuses.map(item=><option value={item.value} key={item.value}>{item.label}{counts?` · ${counts[item.value]}`:""}</option>)}</select><ChevronDown size={15}/></label>
    <label className={styles.filter}><span>Тип задания</span><select aria-label="Тип задания" value={initial.type} onChange={event=>onApply({...initial,search:search.trim(),type:event.target.value})}>{[...new Set(["all",...types,...(initial.type!=="all"?[initial.type]:[])])].map(type=><option value={type} key={type}>{type==="all"?"Все типы":type}</option>)}</select><ChevronDown size={15}/></label>
    {initial.search||initial.status!=="all"||initial.type!=="all"?<button type="button" className={styles.reset} onClick={()=>{setSearch("");onApply({search:"",status:"all",type:"all"});}}>Сбросить</button>:null}
  </form>;
}
export function HomeworkDesktopList({items,hrefFor,onOpen}:{items:StudentHomeworkItem[];hrefFor:(id:number)=>string;onOpen:(id:number)=>void}) {
  return <section className={styles.list} aria-label="Задания"><div className={styles.columns} aria-hidden><span>Задание</span><span>Срок сдачи</span><span>Статус</span><span>Баллы</span></div>{items.map(item=>{
    const state=item.submission_state&&item.submission_state!=="none"?item.submission_state:item.result!==null?"graded":"none";
    const labels:Record<string,string>={none:"К сдаче",uploading:"Загружается",processing:"Обрабатывается",draft:"Черновик",submitted:"В очереди",in_review:"На проверке",revision_requested:"Доработка",graded:"Проверено"};
    const Icon=state==="none"?Upload:state==="graded"?Check:state==="revision_requested"?RotateCcw:state==="draft"?FileText:state==="uploading"||state==="processing"?LoaderCircle:Clock3;
    return <article key={item.homework_id} className={styles.row}><a href={hrefFor(item.homework_id)} className={styles.rowLink} aria-label={`Открыть задание: ${item.homework_name}`} onClick={event=>{if(event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();onOpen(item.homework_id);}}}>
      <span className={styles.assignment}><small><BookOpen size={13}/>{item.homework_type}</small><strong>{item.homework_name}</strong>{state==="revision_requested"&&item.revision_comment?<span className={styles.comment}>{item.revision_comment}</span>:state==="draft"?<span className={styles.comment}>PDF сохранён. Можно отправить на проверку.</span>:null}</span>
      <span className={styles.deadline}>{formatHomeworkDate(item.deadline)}</span>
      <span className={styles.status} data-state={state}><span className={styles.statusIcon}><Icon size={16}/></span>{labels[state]}</span>
      <span className={styles.score}>{state==="graded"&&item.result!==null?<><strong>{item.result}</strong><small>/ 100</small></>:<span aria-label="Оценки пока нет">—</span>}</span>
    </a></article>;
  })}</section>;
}
