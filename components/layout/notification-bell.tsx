"use client";

import { apiRequest } from "@/lib/api/client";
import type { UserRole } from "@/lib/auth/types";
import { getHomeworkRealtimeSocket } from "@/lib/homework-files/realtime";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Notice { id:number;kind:string;homework_id:number|null;read_at:string|null;created_at:string }

const labels:Record<string,string>={
  chat_message:"Новое сообщение",grade_changed:"Изменён балл",submission_sent:"Работа отправлена",
  review_claimed:"Работа взята на проверку",revision_requested:"Работа возвращена на доработку",
  graded:"Работа оценена",job_failed:"Ошибка обработки файла",
};

export function NotificationBell({role}:{role:UserRole}) {
  const [items,setItems]=useState<Notice[]>([]);
  const [open,setOpen]=useState(false);
  const reloadTimer=useRef<number|null>(null);
  const router=useRouter();
  const load=useCallback(()=>apiRequest<{items:Notice[]}>("/api/homework-chat/notifications")
    .then((data)=>setItems(data.items)).catch(()=>undefined),[]);

  useEffect(()=>{
    let stopped=false;let connectedOnce=false;const socket=getHomeworkRealtimeSocket();
    const reload=()=>{
      if(stopped||reloadTimer.current)return;
      reloadTimer.current=window.setTimeout(()=>{reloadTimer.current=null;void load();},100);
    };
    const connected=()=>{if(connectedOnce)reload();connectedOnce=true;};
    void load();
    if(socket){connectedOnce=socket.connected;socket.on("connect",connected);socket.on("notification.created",reload);if(!socket.connected)socket.connect();}
    return()=>{
      stopped=true;if(reloadTimer.current)window.clearTimeout(reloadTimer.current);
      socket?.off("connect",connected);socket?.off("notification.created",reload);
    };
  },[load]);

  const choose=async(item:Notice)=>{
    await apiRequest(`/api/homework-chat/notifications/${item.id}/read`,{method:"POST"});
    setItems((current)=>current.map((value)=>value.id===item.id?{...value,read_at:new Date().toISOString()}:value));
    setOpen(false);
    router.push(item.kind==="chat_message"&&role!=="student"?`/cabinet/${role}/messages`:`/cabinet/${role}/${role==="admin"?"assignments":"homework"}`);
  };
  const unread=items.filter((item)=>!item.read_at).length;
  return <div className="notification-bell">
    <button onClick={()=>setOpen((value)=>!value)} aria-label="Уведомления"><Bell size={18}/>{unread?<span>{unread>99?"99+":unread}</span>:null}</button>
    {open?<div className="notification-popover"><b>Уведомления</b>{items.length?items.slice(0,20).map((item)=><button data-unread={!item.read_at} key={item.id} onClick={()=>void choose(item)}><span>{labels[item.kind]??item.kind}</span><small>{new Date(item.created_at).toLocaleString("ru-RU")}</small></button>):<p>Новых уведомлений нет</p>}</div>:null}
  </div>;
}
