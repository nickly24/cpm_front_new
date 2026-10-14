"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { useAuth } from "@/contexts/AuthContext";
import { browserAttendanceCommands } from "@/lib/bff/attendance-commands";
import styles from "./workspace.module.css";
export { styles };
export function useAction(refresh: () => Promise<void>) {
    const { user } = useAuth();
    const account=user?.account_id, organization=user?.organization_id, division=user?.division_id??null;
    const runner=useMemo(()=>browserAttendanceCommands(account&&organization?{account_id:account,organization_id:organization,selected_division_id:division}:null,async()=>{}),[account,organization,division]);
    useEffect(()=>{runner.setRefresh(refresh);},[runner,refresh]);
    useEffect(()=>runner.connect(),[runner]);
    const state=useSyncExternalStore(runner.subscribe,runner.getSnapshot,runner.getServerSnapshot);
    useContextGuard(Boolean(state.pending)||state.busy);
    return {...state,pending:state.pending??(state.blocked?{blocked:true}:null),canRecover:!!state.pending,setError:runner.setError,execute:runner.execute.bind(runner),retry:runner.retry,recover:runner.recover,acknowledgeRecovery:runner.acknowledgeRecovery};
}
export function ActionNotice({ action }: {
    action: ReturnType<typeof useAction>;
}) { return <>{action.error && <p className={styles.error} role="alert">{action.error}</p>}{action.notice && <p className={styles.muted} role="status">{action.notice}</p>}{action.pending && action.canRecover && !action.busy && <div className={styles.actions}><button type="button" onClick={()=>void action.recover()}>Проверить исход команды</button>{action.canRetry && <button type="button" onClick={() => void action.retry()}>Повторить ту же команду</button>}</div>}{action.recovery==="committed" && !action.busy && <button type="button" onClick={action.acknowledgeRecovery}>Понятно / начать новое действие</button>}</>; }
export function Range({ from, to, setFrom, setTo }: {
    from: string;
    to: string;
    setFrom: (v: string) => void;
    setTo: (v: string) => void;
}) { return <><label>С даты<input aria-label="С даты" type="date" value={from} onChange={e => setFrom(e.target.value)}/></label><label>По дату<input aria-label="По дату" type="date" value={to} onChange={e => setTo(e.target.value)}/></label></>; }
