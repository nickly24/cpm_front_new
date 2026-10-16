"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useBackdropDismiss } from "@/components/ui/dismissible-overlay";
import styles from "./student-pages.module.css";

export function StudentLogoutButton() {
  const { logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const title = useId(), description = useId();
  const dismiss = () => { if (!pending.current) setOpen(false); };
  const backdrop = useBackdropDismiss<HTMLDialogElement>(dismiss);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal(); cancel.current?.focus({ preventScroll: true });
    return () => { element?.close(); document.body.style.overflow = previous; };
  }, [open]);
  const confirm = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { await logout(); router.replace("/login"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось выйти. Попробуйте ещё раз."); }
    finally { pending.current = false; setBusy(false); }
  };
  return <>
    <button type="button" className={styles.logoutButton} onClick={() => { setError(""); setOpen(true); }}><LogOut size={20}/><span>Выйти из кабинета</span></button>
    <dialog ref={dialog} className={styles.confirmation} aria-labelledby={title} aria-describedby={description} onCancel={event => { if (pending.current) event.preventDefault(); else setOpen(false); }} onClose={dismiss} {...backdrop}>
      <div className={styles.confirmationCard}>
        <span className={styles.logoutIcon} aria-hidden><LogOut size={26}/></span>
        <h2 id={title}>Выйти из кабинета?</h2><p id={description}>Для возвращения потребуется снова войти в систему.</p>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <div className={styles.confirmationActions}><button type="button" ref={cancel} disabled={busy} onClick={dismiss}>Остаться</button><button type="button" className={styles.confirmExit} disabled={busy} onClick={() => void confirm()}>{busy ? "Выходим…" : "Выйти"}</button></div>
      </div>
    </dialog>
  </>;
}
