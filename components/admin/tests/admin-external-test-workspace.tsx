"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminFullscreenBack } from "@/components/admin/admin-fullscreen-back";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { canAccessSection } from "@/lib/auth/admin-access";
import { useAuth } from "@/contexts/AuthContext";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { correctExternalResult, externalError, externalHistory, externalResults, externalTest, removeExternalResult, updateExternalTest, type ExternalHistory, type ExternalResult, type ExternalTest } from "@/lib/bff/external-tests";
import { testsDirections } from "@/lib/bff/tests-admin";
import type { AdminExternalTestFormData, Direction } from "@/lib/admin/admin-tests-types";
import { formatAdminTestDate } from "@/lib/admin/admin-tests-utils";
import styles from "./admin-tests.module.css";
import externalStyles from "./external-tests.module.css";

const actions: Record<string, string> = { created: "Тест создан", updated: "Данные теста изменены", result_updated: "Результат сохранён", result_deleted: "Результат удалён", imported: "Результаты импортированы", deleted: "Тест удалён" };
export function AdminExternalTestWorkspace({ testId, onBack }: { testId: string; onBack: () => void }) {
  const { user } = useAuth();
  const [test, setTest] = useState<ExternalTest | null>(null);
  const [results, setResults] = useState<ExternalResult[]>([]);
  const [history, setHistory] = useState<ExternalHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState("");
  const [score, setScore] = useState("");
  const [edited, setEdited] = useState<ExternalResult | null>(null);
  const [directions, setDirections] = useState<Direction[]>([]);
  const [metadata, setMetadata] = useState<AdminExternalTestFormData>({ name: "", direction_id: 0, date: "" });
  const canEditResults = canAccessSection(user, "test-results", "edit");
  const metadataChanged = Boolean(test && (test.name !== metadata.name || test.direction_id !== metadata.direction_id || test.date !== metadata.date));
  useContextGuard(busy || Boolean(edited) || Boolean(account) || metadataChanged);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const detail = await externalTest(testId, signal);
      const [rows, changes, choices] = await Promise.all([
        detail.actions.can_view_results ? externalResults(testId, signal) : Promise.resolve([]),
        detail.actions.can_view_results ? externalHistory(testId, signal) : Promise.resolve([]),
        detail.actions.can_edit ? testsDirections() : Promise.resolve([]),
      ]);
      if (signal?.aborted) return;
      setTest(detail); setResults(rows); setHistory(changes);
      setDirections(choices); setMetadata({ name: detail.name, direction_id: detail.direction_id, date: detail.date });
    } catch (e) { if (!signal?.aborted) setError(externalError(e).message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [testId]);
  useEffect(() => { const controller = new AbortController(); queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); }); return () => controller.abort(); }, [load]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!test) return;
    setBusy(true); setError("");
    try {
      await correctExternalResult(test, edited?.account_id ?? Number(account), edited?.revision ?? 0, score.trim() ? Number(score) : null);
      setEdited(null); setAccount(""); setScore(""); setLoading(true); await load();
    } catch (e) { setError(externalError(e).message); }
    finally { setBusy(false); }
  };
  const remove = async (result: ExternalResult) => {
    if (!test || !window.confirm(`Удалить результат ученика «${result.full_name ?? `Аккаунт ${result.account_id}`}»? Он перестанет учитываться в рейтинге.`)) return;
    setBusy(true); setError("");
    try { await removeExternalResult(test, result); setLoading(true); await load(); }
    catch (e) { setError(externalError(e).message); }
    finally { setBusy(false); }
  };
  const saveMetadata = async (event: React.FormEvent) => {
    event.preventDefault(); if (!test) return;
    setBusy(true); setError("");
    try { await updateExternalTest(test, metadata); setLoading(true); await load(); }
    catch (e) { setError(externalError(e).message); }
    finally { setBusy(false); }
  };
  return <div className={styles.fullscreenShell}>
    <header className={styles.fullscreenHeader}><div className={styles.fullscreenHeaderContent}><AdminFullscreenBack onBack={onBack} /><h1 className={styles.fullscreenTitle}>{test?.name ?? "Внешний тест"}</h1></div></header>
    <div className={styles.fullscreenBody}>
      {error ? <p className={externalStyles.error} role="alert">{error}</p> : null}
      {loading ? <LoadingState label="Загрузка внешнего теста…" variant="panel" /> : test ? <>
        <section className={externalStyles.panel}><h2 className={externalStyles.heading}>Тест вне системы</h2><p className={externalStyles.muted}>{test.direction_name} · {formatAdminTestDate(test.date)} · ревизия {test.revision}</p><p className={externalStyles.muted}>Запись и результаты относятся к выбранному подразделению. Вопросов и попыток прохождения здесь нет.</p>
          {test.actions.can_edit ? <form className={externalStyles.form} onSubmit={saveMetadata}>
            <label className={externalStyles.field}><span>Название</span><input value={metadata.name} disabled={busy} required onChange={e => setMetadata(m => ({ ...m, name: e.target.value }))} /></label>
            <label className={externalStyles.field}><span>Направление</span><select className={styles.input} value={metadata.direction_id} disabled={busy} required onChange={e => setMetadata(m => ({ ...m, direction_id: Number(e.target.value) }))}>{directions.map(d => <option value={d.id} key={d.id}>{d.name}</option>)}</select></label>
            <label className={externalStyles.field}><span>Дата</span><input type="date" value={metadata.date} disabled={busy} required onChange={e => setMetadata(m => ({ ...m, date: e.target.value }))} /></label>
            <Button type="submit" disabled={busy || !metadataChanged}>Сохранить данные теста</Button>
          </form> : null}
        </section>
        {test.actions.can_view_results ? <section className={externalStyles.panel}>
          <div className={externalStyles.toolbar}><h2 className={externalStyles.heading}>Результаты учеников</h2><Button variant="ghost" size="sm" disabled={busy} onClick={() => { setLoading(true); setError(""); void load(); }}>Обновить</Button></div>
          {results.length ? <div className={externalStyles.scroll}><table className={externalStyles.table}><thead><tr><th>Ученик</th><th>Балл</th><th>Ревизия</th>{canEditResults ? <th>Действия</th> : null}</tr></thead><tbody>{results.map(result => <tr key={result.id}><td>{result.full_name ?? `Аккаунт ${result.account_id}`}<p className={externalStyles.muted}>Аккаунт {result.account_id} · профиль ученика {result.student_id}</p></td><td>{result.score === null ? "Балл не указан" : result.score}</td><td>{result.revision}</td>{canEditResults ? <td><div className={externalStyles.actions}><Button variant="ghost" size="sm" disabled={busy} onClick={() => { setEdited(result); setAccount(String(result.account_id)); setScore(result.score === null ? "" : String(result.score)); }}>Изменить балл</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => void remove(result)}>Удалить результат</Button></div></td> : null}</tr>)}</tbody></table></div> : <p className={externalStyles.muted}>Результатов пока нет.</p>}
          {canEditResults ? <form className={externalStyles.form} onSubmit={save}>
            <label className={externalStyles.field}><span>ID учётной записи ученика</span><input aria-label="ID учётной записи ученика" type="number" min="1" step="1" value={account} disabled={busy || Boolean(edited)} onChange={e => setAccount(e.target.value)} required /></label>
            <label className={externalStyles.field}><span>Балл от 0 до 100</span><input aria-label="Балл внешнего теста" type="number" min="0" max="100" step="any" value={score} disabled={busy} onChange={e => setScore(e.target.value)} /></label>
            <Button type="submit" disabled={busy}>{busy ? "Сохранение…" : edited ? "Сохранить балл" : "Добавить результат"}</Button>
            {edited ? <Button type="button" variant="ghost" disabled={busy} onClick={() => { setEdited(null); setAccount(""); setScore(""); }}>Отмена изменения</Button> : null}
            <p className={externalStyles.muted}>Пустой балл означает, что результат есть, но оценка неизвестна. Ноль сохраняется как оценка.</p>
          </form> : null}
        </section> : <p className={externalStyles.muted}>Для просмотра результатов нужны права раздела «Результаты тестов».</p>}
        {test.actions.can_view_results ? <section className={externalStyles.panel}><h2 className={externalStyles.heading}>История изменений</h2>{history.length ? <ol className={externalStyles.history}>{history.map(change => <li key={change.id}><strong>{actions[change.action] ?? change.action}</strong><p className={externalStyles.muted}>{formatAdminTestDate(change.changed_at)} · аккаунт {change.actor_id} · ревизия {change.revision}</p><details><summary>Подробности изменения</summary><pre className={externalStyles.details}>{JSON.stringify({ before: change.metadata_before, after: change.metadata_after, results: change.result_changes }, null, 2)}</pre></details></li>)}</ol> : <p className={externalStyles.muted}>Изменений пока нет.</p>}</section> : null}
      </> : null}
    </div>
  </div>;
}
