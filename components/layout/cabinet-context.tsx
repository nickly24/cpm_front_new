"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS, getCabinetPath } from "@/lib/auth/roles";
import { bffRequest, exclusiveContext, resetRequests, announceSession, type Identity } from "@/lib/bff/client";
import styles from "./cabinet-context.module.css";
export function CabinetContext() {
 const { user } = useAuth(); const [busy,setBusy] = useState(false); const [error,setError] = useState("");
 if (!user) return null;
 const value = `${user.organization_id}:${user.division_id ?? ""}`;
 const switchTo = async (target: string) => {
  if (target===value) return; setError(""); setBusy(true);
  try { await exclusiveContext(async () => {
   resetRequests(); const [org,division] = target.split(":");
   const next = await bffRequest<Identity>("/auth/context",{method:"POST",body:JSON.stringify({organization_id:Number(org),division_id:division?Number(division):null})});
   announceSession(); window.location.replace(getCabinetPath(next.user.role, next.user));
  }); } catch(e) { setError(e instanceof Error ? e.message : "Не удалось переключить кабинет"); } finally { setBusy(false); }
 };
 const organization = user.organizations?.find(o=>o.id===user.organization_id);
 return <div className={styles.context}>
  <label><span>{organization?.name}</span><select aria-label="Переключить кабинет и подразделение" value={value} disabled={busy} onChange={e=>void switchTo(e.target.value)}>
   {user.organizations?.map(o=><optgroup key={o.id} label={o.name}>{o.divisions.length?o.divisions.map(d=><option key={d.id} value={`${o.id}:${d.id}`}>Кабинет {ROLE_LABELS[user.role]} · {d.name}</option>):<option value={`${o.id}:`}>Кабинет {ROLE_LABELS[user.role]} · {o.name}</option>}</optgroup>)}
  </select></label>{error?<p role="alert">{error}</p>:null}
 </div>;
}
