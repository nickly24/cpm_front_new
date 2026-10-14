"use client";
import { useEffect, useState } from "react";
import { BFF_DEV } from "@/lib/config";
import { homeworkTypes } from "./homework";
export function useHomeworkTypes() {
 const [names,setNames]=useState<string[]>(BFF_DEV?[]:["ОВ","ДЗНВ"]);
 const [error,setError]=useState("");
 useEffect(()=>{if(!BFF_DEV)return;let live=true;const load=()=>{void homeworkTypes().then(rows=>{if(live)setNames(rows.map(t=>t.name));}).catch(e=>{if(live)setError(e.message);});};load();window.addEventListener("bff-types-updated",load);return()=>{live=false;window.removeEventListener("bff-types-updated",load);};},[]);
 return {names,error};
}
