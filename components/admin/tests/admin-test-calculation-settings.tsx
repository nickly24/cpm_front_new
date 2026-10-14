"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { domain } from "@/lib/bff/client";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";

type TestSettings = {revision:number;recalculate_on_test_change:boolean};
export function AdminTestCalculationSettings() {
  const {user}=useAuth();
  const [settings,setSettings]=useState<TestSettings|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  useContextGuard(busy);
  const fullAdmin=user?.organization_admin===true;
  const load=async()=>{try{setSettings(await domain<TestSettings>("/core/organization/test-settings"));setError(null);}catch(err){setError(err instanceof Error?err.message:"Не удалось загрузить настройку");}};
  useEffect(()=>{if(fullAdmin)void domain<TestSettings>("/core/organization/test-settings").then(setSettings).catch(err=>setError(err.message));},[fullAdmin]);
  if(!fullAdmin)return null;
  const change=async(enabled:boolean)=>{
    if(!settings)return;
    setBusy(true);setError(null);
    try {setSettings(await domain<TestSettings>("/core/organization/test-settings",{method:"PUT",body:JSON.stringify({expected_revision:settings.revision,recalculate_on_test_change:enabled})}));}
    catch(err){setError(err instanceof Error?err.message:"Настройка не сохранена");}
    finally{setBusy(false);}
  };
  return <details className={styles.panel}><summary>Пересчёт сдач при изменении теста</summary>
    {settings ? <Toggle label="Пересчитывать ранее принятые сдачи" variant="success" checked={settings.recalculate_on_test_change} disabled={busy} onChange={enabled=>void change(enabled)} /> : <p className={styles.panelHint}>Загрузка настройки…</p>}
    <p className={styles.panelHint}>Настройка действует для всей организации. При изменении ключей, весов или состава вопросов новые баллы рассчитываются в очереди. Включение настройки само по себе не меняет прошлые баллы.</p>
    {error?<p role="alert" className={styles.errorText}>{error}</p>:null}
    <Button size="sm" variant="ghost" disabled={busy} onClick={()=>void load()}>Обновить настройку</Button>
  </details>;
}
