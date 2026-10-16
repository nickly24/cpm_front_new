"use client";
import { useId, useRef, useState } from "react";
import { Building2, Check, ChevronDown, LoaderCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS, getCabinetPath } from "@/lib/auth/roles";
import { bffRequest, exclusiveContext, resetRequests, announceSession, type Identity } from "@/lib/bff/client";
import styles from "./cabinet-context.module.css";
export function CabinetContext({ variant = "header", initiallyExpanded = false }: { variant?: "header" | "menu"; initiallyExpanded?: boolean }) {
 const { user } = useAuth(); const [busy,setBusy] = useState(false); const [error,setError] = useState("");
 const [expanded,setExpanded] = useState(initiallyExpanded); const listId = useId(); const switching = useRef(false);
 if (!user) return null;
 const value = `${user.organization_id}:${user.division_id ?? ""}`;
 const switchTo = async (target: string) => {
  if (switching.current) return;
  if (target===value) { setExpanded(false); return; }
  switching.current = true; setError(""); setBusy(true);
  try { await exclusiveContext(async () => {
   resetRequests(); const [org,division] = target.split(":");
   const next = await bffRequest<Identity>("/auth/context",{method:"POST",body:JSON.stringify({organization_id:Number(org),division_id:division?Number(division):null})});
   announceSession(); window.location.replace(getCabinetPath(next.user.role, next.user));
  }); } catch(e) { setError(e instanceof Error ? e.message : "Не удалось переключить кабинет"); } finally { switching.current = false; setBusy(false); }
 };
 const organization = user.organizations?.find(o=>o.id===user.organization_id);
 const division = organization?.divisions.find(d=>d.id===user.division_id);
 if (variant === "menu") return <section className={styles.menuContext} aria-label="Выбор кабинета">
  <button type="button" className={styles.contextButton} aria-label="Переключить кабинет и подразделение" aria-expanded={expanded} aria-controls={listId} disabled={busy} onClick={()=>setExpanded(current=>!current)}>
   <span className={styles.contextIcon}>{busy ? <LoaderCircle size={20} className={styles.spinner}/> : <Building2 size={20}/>}</span>
   <span className={styles.contextText}><small>Кабинет</small><strong>{division?.name || organization?.name || "Выбрать кабинет"}</strong></span>
   <ChevronDown size={18} className={expanded ? styles.chevronOpen : styles.chevron}/>
  </button>
  {expanded ? <div id={listId} className={styles.contextChoices} role="group" aria-label="Доступные кабинеты">
   {user.organizations?.flatMap(org=>org.divisions.length ? org.divisions.map(d=>({target:`${org.id}:${d.id}`,name:d.name})) : [{target:`${org.id}:`,name:org.name}]).map(option=><button type="button" key={option.target} className={styles.contextChoice} aria-pressed={option.target===value} disabled={busy} onClick={()=>void switchTo(option.target)}><span>{option.name}</span>{option.target===value ? <Check size={17} aria-hidden/> : null}</button>)}
  </div> : null}
  {error ? <p className={styles.contextError} role="alert">{error}</p> : null}
 </section>;
 return <div className={styles.context}>
  <label><span>{organization?.name}</span><select aria-label="Переключить кабинет и подразделение" value={value} disabled={busy} onChange={e=>void switchTo(e.target.value)}>
   {user.organizations?.map(o=><optgroup key={o.id} label={o.name}>{o.divisions.length?o.divisions.map(d=><option key={d.id} value={`${o.id}:${d.id}`}>Кабинет {ROLE_LABELS[user.role]} · {d.name}</option>):<option value={`${o.id}:`}>Кабинет {ROLE_LABELS[user.role]} · {o.name}</option>}</optgroup>)}
  </select></label>{error?<p role="alert">{error}</p>:null}
 </div>;
}
