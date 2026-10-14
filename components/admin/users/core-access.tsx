"use client";
import { EditOnly, ReadOnlyControl } from "@/components/admin/admin-section-access";
import { useAuth } from "@/contexts/AuthContext";
import { BFF_DEV } from "@/lib/config";
import { coreCan, coreFullAdmin, pendingCoreCreate, recoverCoreCreate, dismissCoreCreate, pendingCoreCatalog, recoverCoreCatalog, dismissCoreCatalog } from "@/lib/bff/core-admin";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { cloneElement, useState, type ReactElement, type ReactNode } from "react";
export function CoreEditOnly({children,section="users",fullAdmin=false}:{children:ReactNode;section?:string;fullAdmin?:boolean}) {
  const {user}=useAuth();
  if(!BFF_DEV) return <EditOnly>{children}</EditOnly>;
  return (fullAdmin?coreFullAdmin(user):coreCan(section,true,user))?children:null;
}
export function CoreReadOnlyControl({children,section="users"}:{children:ReactElement<{disabled?:boolean}>;section?:string}) {
  const {user}=useAuth(); if(!BFF_DEV)return <ReadOnlyControl>{children}</ReadOnlyControl>;
  return coreCan(section,true,user)?children:cloneElement(children,{disabled:true});
}
export function CoreCreateRecovery({onRecovered}:{onRecovered:()=>void|Promise<void>}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[dismissed,setDismissed]=useState(false);
  const pending=BFF_DEV?pendingCoreCreate():null;
  const catalog=BFF_DEV?pendingCoreCatalog():null;
  useContextGuard(!!(pending||catalog)&&!dismissed);
  if(!(pending||catalog)||dismissed) return null;
  return <div className="admin-view-notice"><p>Проверьте создание {pending?`учётной записи «${pending.login}»`:`${catalog!.kind==="group"?"группы":"школы"} «${catalog!.name}»`}: ответ предыдущего запроса не получен.</p>{error?<p role="alert">{error}</p>:null}<button type="button" className="ds-btn ds-btn--sm" disabled={busy} onClick={async()=>{setBusy(true);setError(null);try{if(pending)await recoverCoreCreate();else await recoverCoreCatalog();setDismissed(true);await onRecovered();}catch(e){setError(e instanceof Error?e.message:"Ошибка проверки");}finally{setBusy(false);}}}>{busy?"Проверка…":"Проверить создание"}</button>{error?<button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" onClick={()=>{if(pending)dismissCoreCreate();else dismissCoreCatalog();setDismissed(true);}}>Продолжить после проверки списка</button>:null}</div>;
}
