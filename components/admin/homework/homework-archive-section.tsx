"use client";

import { homeworkFilesApi, type ArchiveItem } from "@/lib/homework-files/api";
import styles from "@/components/homework/review-queue.module.css";
import { useCallback, useEffect, useState } from "react";

export function HomeworkArchiveSection() {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (from) params.set("date_from", from);
    if (to) params.set("date_to", to);
    return homeworkFilesApi.archive(params.toString()).then((data) => setItems(data.items));
  },[from,to]);
  useEffect(() => { void load(); }, [load]);
  const open = async (item: ArchiveItem, download=false) => { const { url }=await homeworkFilesApi.fileUrl(item.id,false,download); window.open(url,"_blank","noopener,noreferrer"); };
  const editGrade = async (item: ArchiveItem) => { const result=window.prompt("Новый балл 0–100");if(result===null)return;await homeworkFilesApi.transition(item.id,"edit-grade",{result:Number(result)}); };
  const resubmit = async (item: ArchiveItem) => { if(!window.confirm("Удалить итоговый PDF, оценку и открыть чистую пересдачу?"))return;await homeworkFilesApi.transition(item.id,"resubmit");await load(); };
  return (
    <div className={styles.page}>
      <header><div><span>Хранилище</span><h1>Архив работ</h1><p>Хранятся только итоговые оценённые PDF.</p></div><div><input type="date" value={from} onChange={(event)=>setFrom(event.target.value)}/><input type="date" value={to} onChange={(event)=>setTo(event.target.value)}/><button onClick={()=>void load()}>Найти</button></div></header>
      <div className={styles.list}>{items.map((item)=><article key={item.id}><div><h2>{item.student_name}</h2><p>{item.homework_name} · {item.group_name??"Без группы"} · {item.page_count} стр.</p><span>{new Date(item.submitted_at_utc).toLocaleString("ru-RU",{timeZone:"Europe/Moscow"})}</span></div><div className={styles.actions}><button onClick={()=>void open(item)}>Открыть</button><button onClick={()=>void open(item,true)}>Скачать</button><button onClick={()=>void editGrade(item)}>Изменить балл</button><button onClick={()=>void resubmit(item)}>Пересдача</button></div></article>)}</div>
    </div>
  );
}
