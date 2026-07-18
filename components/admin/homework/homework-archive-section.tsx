"use client";

import { apiRequest } from "@/lib/api/client";
import { homeworkFilesApi } from "@/lib/homework-files/api";
import styles from "@/components/homework/review-queue.module.css";
import { useCallback, useEffect, useState } from "react";

interface Item { id:number; student_name:string; homework_name:string; group_name:string|null; submitted_at_utc:string; size_bytes:number; page_count:number }

export function HomeworkArchiveSection() {
  const [items, setItems] = useState<Item[]>([]);
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const load = useCallback(() => apiRequest<{ items: Item[] }>(`/api/homework-files/archive?date_from=${from}&date_to=${to}`).then((data) => setItems(data.items)),[from,to]);
  useEffect(() => { void load(); }, [load]);
  const open = async (item: Item, download=false) => { const { url }=await homeworkFilesApi.fileUrl(item.id,false,download); window.open(url,"_blank","noopener,noreferrer"); };
  const editGrade = async (item: Item) => { const result=window.prompt("Новый балл 0–100");if(result===null)return;await homeworkFilesApi.transition(item.id,"edit-grade",{result:Number(result)}); };
  const resubmit = async (item: Item) => { if(!window.confirm("Удалить итоговый PDF, оценку и открыть чистую пересдачу?"))return;await homeworkFilesApi.transition(item.id,"resubmit");await load(); };
  return (
    <div className={styles.page}>
      <header><div><span>Хранилище</span><h1>Архив работ</h1><p>Хранятся только итоговые оценённые PDF.</p></div><div><input type="date" value={from} onChange={(event)=>setFrom(event.target.value)}/><input type="date" value={to} onChange={(event)=>setTo(event.target.value)}/><button onClick={()=>void load()}>Найти</button></div></header>
      <div className={styles.list}>{items.map((item)=><article key={item.id}><div><h2>{item.student_name}</h2><p>{item.homework_name} · {item.group_name??"Без группы"} · {item.page_count} стр.</p><span>{new Date(item.submitted_at_utc).toLocaleString("ru-RU",{timeZone:"Europe/Moscow"})}</span></div><div className={styles.actions}><button onClick={()=>void open(item)}>Открыть</button><button onClick={()=>void open(item,true)}>Скачать</button><button onClick={()=>void editGrade(item)}>Изменить балл</button><button onClick={()=>void resubmit(item)}>Пересдача</button></div></article>)}</div>
    </div>
  );
}
