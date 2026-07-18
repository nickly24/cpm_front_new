"use client";

import { homeworkFilesApi } from "@/lib/homework-files/api";
import { uploadHomeworkFile } from "@/lib/homework-files/api";
import type { UploadJob } from "@/lib/homework-files/types";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface QueuedUpload extends UploadJob { file?: File; clientId?: string }
interface UploadContextValue { jobs: QueuedUpload[]; enqueue: (homeworkId: number, file: File) => void; cancel: (id: string) => void; retry: (id: string) => void }
const Context=createContext<UploadContextValue | null>(null);

export function HomeworkUploadProvider({children}:{children:ReactNode}) {
  const [jobs,setJobs]=useState<QueuedUpload[]>([]); const running=useRef(false);
  const uploadControllers=useRef(new Map<string,AbortController>());
  const refresh=useCallback(async (id:string) => {
    for (;;) {
      const job=await homeworkFilesApi.job(id); setJobs(items=>items.map(item=>item.id===id?{...item,...job}:item));
      if (["ready","failed","cancelled"].includes(job.status)) break;
      await new Promise(resolve=>window.setTimeout(resolve,1000));
    }
  },[]);
  const pump=useCallback(async()=>{
    if(running.current)return;
    const next=jobs.find(item=>item.status==="local" && item.file && item.clientId); if(!next)return;
    running.current=true;
    try {
      setJobs(items=>items.map(item=>item.id===next.id?{...item,status:"uploading",stage:"upload",progress:1}:item));
      try { const controller=new AbortController();uploadControllers.current.set(next.id,controller);const server=await uploadHomeworkFile(next.homework_id!,next.file!,next.clientId!,progress=>setJobs(items=>items.map(item=>item.id===next.id?{...item,progress}:item)),controller.signal);uploadControllers.current.delete(next.id);setJobs(items=>items.map(item=>item.id===next.id?{...item,...server,file:undefined}:item)); await refresh(server.id); }
      catch(error) { uploadControllers.current.delete(next.id);setJobs(items=>items.map(item=>item.id===next.id?{...item,status:"failed",stage:"error",error_code:error instanceof Error?error.message:"upload_failed"}:item)); }
    } finally {running.current=false;setJobs(items=>[...items]);}
  },[jobs,refresh]);
  useEffect(()=>{void pump()},[jobs,pump]);
  useEffect(()=>{ homeworkFilesApi.jobs().then(({items})=>{setJobs(items); items.filter(j=>!["ready","failed","cancelled"].includes(j.status)).forEach(j=>void refresh(j.id));}).catch(()=>{}); },[refresh]);
  const enqueue=useCallback((homeworkId:number,file:File)=>{const id=crypto.randomUUID(); setJobs(items=>[...items,{id:`local-${id}`,clientId:id,homework_id:homeworkId,file,status:"local",stage:"queue",progress:0}]);},[]);
  const cancel=useCallback((id:string)=>{if(id.startsWith("local-")){uploadControllers.current.get(id)?.abort();uploadControllers.current.delete(id);setJobs(items=>items.filter(j=>j.id!==id));return;} void homeworkFilesApi.cancel(id).then(()=>setJobs(items=>items.map(j=>j.id===id?{...j,status:"cancelled"}:j)));},[]);
  const retry=useCallback((id:string)=>{void homeworkFilesApi.retry(id).then(()=>refresh(id));},[refresh]);
  return <Context.Provider value={{jobs,enqueue,cancel,retry}}>{children}<UploadCenter jobs={jobs} cancel={cancel} retry={retry}/></Context.Provider>;
}

function UploadCenter({jobs,cancel,retry}:{jobs:QueuedUpload[];cancel:(id:string)=>void;retry:(id:string)=>void}) {
  const visible=jobs.filter(j=>j.status!=="cancelled").slice(-5); if(!visible.length)return null;
  const labels:Record<string,string>={queue:"В очереди",upload:"Загрузка",checking:"Проверка",optimization:"Оптимизация",s3:"S3",ready:"Готово",error:"Ошибка"};
  return <aside className="homework-upload-center" aria-label="Загрузки домашних работ"><strong>Загрузки</strong>{visible.map(job=><div className="homework-upload-item" key={job.id}><span>{labels[job.stage]??job.stage} · {job.progress}%</span><progress max={100} value={job.progress}/><div>{job.status==="failed"?<button onClick={()=>retry(job.id)}>Повторить</button>:!["ready","cancelled"].includes(job.status)?<button onClick={()=>cancel(job.id)}>Отменить</button>:null}</div></div>)}</aside>;
}

export function useHomeworkUploads(){const value=useContext(Context);if(!value)throw new Error("HomeworkUploadProvider is missing");return value;}
