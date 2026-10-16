"use client";
import { useCallback, useEffect, useState } from "react";
import { BFF_DEV } from "@/lib/config";
import { homeworkTypes } from "./homework";
export function useHomeworkTypes() {
 const [names,setNames]=useState<string[]>(BFF_DEV?[]:["ОВ","ДЗНВ"]);
 const [error,setError]=useState("");
 const [revision,setRevision]=useState(0);
 const reload=useCallback(()=>setRevision(value=>value+1),[]);
 useEffect(()=>{
  if(!BFF_DEV)return;
  let live=true,sequence=0;
  const load=()=>{
   const current=++sequence;
   void homeworkTypes().then(rows=>{if(live&&current===sequence){setNames(rows.map(t=>t.name));setError("");}}).catch(()=>{if(live&&current===sequence)setError("Не удалось загрузить типы заданий.");});
  };
  load();window.addEventListener("bff-types-updated",load);
  return()=>{live=false;window.removeEventListener("bff-types-updated",load);};
 },[revision]);
 return {names,error,reload};
}
