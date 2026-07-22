"use client";

import { useAuth } from "@/contexts/AuthContext";
import { homeworkFilesApi } from "@/lib/homework-files/api";
import type { ReviewQueueItem } from "@/lib/homework-files/types";
import { useCallback, useEffect, useState } from "react";
import styles from "./review-queue.module.css";

const labels:Record<string,string>={submitted:"Отправлено",in_review:"На проверке",revision_requested:"На доработке",graded:"Оценено"};

export function ReviewQueueSection(){
  const { user }=useAuth();
  const [items,setItems]=useState<ReviewQueueItem[]>([]);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState<number|null>(null);
  const load=useCallback(async()=>{try{setItems((await homeworkFilesApi.queue()).items);setError(null)}catch(reason){setError(reason instanceof Error?reason.message:"Ошибка загрузки")}},[]);
  useEffect(()=>{void load()},[load]);
  const action=async(item:ReviewQueueItem,name:string,payload:object={})=>{setBusy(item.id);try{await homeworkFilesApi.transition(item.id,name,payload);await load()}catch(reason){setError(reason instanceof Error?reason.message:"Ошибка операции")}finally{setBusy(null)}};
  const open=async(item:ReviewQueueItem)=>{try{const{url}=await homeworkFilesApi.fileUrl(item.id);window.open(url,"_blank","noopener,noreferrer")}catch(reason){setError(reason instanceof Error?reason.message:"Файл недоступен")}};
  const grade=(item:ReviewQueueItem)=>{const raw=window.prompt("Балл 0–100 (пусто — авто)");if(raw!==null)void action(item,"grade",raw.trim()?{result:Number(raw)}:{})};
  return <div className={styles.page}><header><div><span>Проверка</span><h1>Очередь домашних работ</h1><p>Все активные работы вашей текущей группы. Оценённые находятся в архиве администратора.</p></div><div><button onClick={()=>void load()}>Обновить</button></div></header>{error?<div className={styles.error}>{error}</div>:null}<div className={styles.list}>{items.map(item=><article key={item.id}><div><h2>{item.student_name}</h2><p>{item.homework_name} · {item.group_name??"Без группы"}</p><span>{labels[item.state]??item.state}</span>{item.revision_comment?<p>{item.revision_comment}</p>:null}</div><div className={styles.actions}><button onClick={()=>void open(item)}>PDF</button>{item.state==="submitted"?<button className={styles.primary} disabled={busy===item.id} onClick={()=>void action(item,"claim")}>Взять</button>:null}{item.state==="in_review"?<>{user?.role==="admin"&&item.reviewer_id!==user.id?<button onClick={()=>void action(item,"takeover")}>Перехватить</button>:null}<button onClick={()=>void action(item,"release")}>Освободить</button><button onClick={()=>{const message=window.prompt("Что нужно исправить?");if(message)void action(item,"request-revision",{message})}}>На доработку</button><button className={styles.primary} onClick={()=>grade(item)}>Оценить</button></>:null}</div></article>)}{!items.length?<p className={styles.empty}>Работ пока нет.</p>:null}</div></div>;
}
