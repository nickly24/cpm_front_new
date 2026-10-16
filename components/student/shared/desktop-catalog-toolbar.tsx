"use client";
import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import styles from "./desktop-catalog.module.css";
export interface DesktopCatalogField { key:string; label:string; value:string; options:{value:string;label:string}[] }
export function DesktopCatalogToolbar({search,searchLabel,fields,onApply,onReset}:{search:string;searchLabel:string;fields:DesktopCatalogField[];onApply:(values:Record<string,string>)=>void;onReset:()=>void}) {
  const [draft,setDraft]=useState(search);
  const values=Object.fromEntries(fields.map(field=>[field.key,field.value]));
  return <form className={styles.toolbar} aria-label="Поиск и фильтры" onSubmit={event=>{event.preventDefault();onApply({...values,search:draft.trim()});}}>
    <label className={styles.search}><Search size={19}/><input type="search" maxLength={200} aria-label={searchLabel} placeholder={searchLabel} value={draft} onChange={event=>setDraft(event.target.value)}/><button type="submit">Найти</button></label>
    {fields.map(field=><label className={styles.filter} key={field.key}><span>{field.label}</span><select aria-label={field.label} value={field.value} onChange={event=>onApply({...values,search:draft.trim(),[field.key]:event.target.value})}>{field.options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={15}/></label>)}
    <button className={styles.reset} type="button" onClick={()=>{setDraft("");onReset();}}>Сбросить</button>
  </form>;
}
