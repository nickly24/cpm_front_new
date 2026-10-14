"use client";
import { useState } from "react";
import { domain } from "@/lib/bff/client";
import { useHomeworkTypes } from "@/lib/bff/use-homework-types";
import { homeworkTypes } from "@/lib/bff/homework";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { Button } from "@/components/ui/button";
export function HomeworkTypes() {
 const {names,error:loadError}=useHomeworkTypes();const [name,setName]=useState("");const [selected,setSelected]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 useContextGuard(Boolean(name)||busy);
 const save=async(action:"create"|"rename"|"archive")=>{setError("");setBusy(true);try{
  const types=await homeworkTypes();const id=types.find(t=>t.name===selected)?.id;
  if(action!=="create"&&!id)throw new Error("Выберите тип");
  if(action==="archive"&&!window.confirm("Архивировать тип? У существующих домашних работ он сохранится."))return;
  await domain(`/homework/types${action==="create"?"":`/${id}`}`,{method:action==="create"?"POST":action==="rename"?"PUT":"DELETE",...(action==="archive"?{}:{body:JSON.stringify({name})})});
  setName("");setSelected("");window.dispatchEvent(new Event("bff-types-updated"));
 }catch(e){setError(e instanceof Error?e.message:"Не удалось сохранить тип");}finally{setBusy(false);}};
 return <details style={{marginBottom:16}} onToggle={e=>{if(!e.currentTarget.open){setName("");setSelected("");}}}><summary style={{cursor:"pointer"}}>Типы домашних работ этого подразделения</summary><div style={{display:"flex",flexWrap:"wrap",gap:10,padding:"12px 0"}}>
  <select aria-label="Тип для изменения" value={selected} onChange={e=>{setSelected(e.target.value);setName(e.target.value);}} disabled={busy}><option value="">Новый тип</option>{names.map(n=><option key={n}>{n}</option>)}</select>
  <input aria-label="Название типа" placeholder="Название типа" value={name} maxLength={100} onChange={e=>setName(e.target.value)} disabled={busy}/>
  <Button size="sm" disabled={busy||!name.trim()} onClick={()=>void save(selected?"rename":"create")}>{selected?"Переименовать":"Добавить тип"}</Button>
  {selected?<Button size="sm" variant="ghost" disabled={busy} onClick={()=>void save("archive")}>Архивировать</Button>:null}
 </div>{loadError||error?<p role="alert">{loadError||error}</p>:null}</details>;
}
