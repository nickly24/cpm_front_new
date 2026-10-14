"use client";
import { useCallback, useEffect, useState } from "react";
import { cardsPendingCommands, cardsRecover, type CardsCommand } from "@/lib/bff/cards";
import { BFF_DEV } from "@/lib/config";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { Button } from "@/components/ui/button";

export function CardsCommandRecovery({ onRecovered }: { onRecovered?: (result: unknown) => void }) {
  const [commands, setCommands] = useState<CardsCommand[]>(() => BFF_DEV ? cardsPendingCommands() : []);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  useContextGuard(BFF_DEV && commands.length > 0);
  const sync = useCallback(() => setCommands(cardsPendingCommands()), []);
  useEffect(() => { if (!BFF_DEV) return; window.addEventListener("cpm-cards-command", sync); return () => window.removeEventListener("cpm-cards-command", sync); }, [sync]);
  if (!BFF_DEV || !commands.length) return null;
  return <div role="status" style={{ padding: 16, marginBottom: 16, border: "1px solid var(--border)", borderRadius: 12 }}>
    <p>Результат действия пока не подтверждён. Повтор использует сохранённую команду и не создаёт дубликат. Если доступ к кабинету изменился, восстановите его и повторите проверку результата.</p>
    {error && <p role="alert">{error}</p>}
    <Button disabled={busy} onClick={async () => { setBusy(true); setError(null); try { const result = await cardsRecover(commands[0]); sync(); onRecovered?.(result); } catch (value) { setError(value instanceof Error ? value.message : "Не удалось подтвердить результат"); sync(); } finally { setBusy(false); } }}>{busy ? "Проверка…" : "Повторить действие"}</Button>
  </div>;
}
