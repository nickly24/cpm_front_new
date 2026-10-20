"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { styles } from "./shared";
export function AttendanceCamera({ onRead, onClose, continuous = false, disabled = false, children }: {
    onRead: (code: string) => void;
    onClose: () => void;
    continuous?: boolean;
    disabled?: boolean;
    children?: ReactNode;
}) { const id = useId().replaceAll(":", ""); const [error, setError] = useState(""); const onReadRef = useRef(onRead); const disabledRef = useRef(disabled); useEffect(() => { onReadRef.current = onRead; disabledRef.current = disabled; }, [onRead, disabled]); useEffect(() => { let disposed = false; let scanner: import("html5-qrcode").Html5Qrcode | undefined; let read = false; let lastCode = "", lastAt = 0; async function start() { try {
    const { Html5Qrcode } = await import("html5-qrcode");
    if (disposed)
        return;
    scanner = new Html5Qrcode(id);
    await scanner.start({ facingMode: "environment" }, { fps: 8, qrbox: { width: 240, height: 240 } }, code => { if (!disposed && !disabledRef.current && (continuous || !read)) {
        const now = Date.now();
        if (continuous && code === lastCode && now - lastAt < 2000) return;
        lastCode = code; lastAt = now; read = true;
        onReadRef.current(code);
    } }, () => { });
    if (disposed)
        await scanner.stop();
}
catch (e) {
    if (!disposed)
        setError(e instanceof Error ? e.message : "Не удалось открыть камеру");
} } void start(); return () => { disposed = true; if (scanner?.isScanning)
    void scanner.stop().catch(() => { }); }; }, [id, continuous]); return <div className={styles.modal}><div className={styles.dialog} style={{background:"var(--ds-surface)",color:"var(--ds-text)"}} role="dialog" aria-modal="true" aria-label="Сканирование камерой"><h2>Сканирование камерой</h2><div id={id}/>{error && <p className={styles.error} role="alert">{error}</p>}<p className={styles.muted}>{continuous ? "Подносите QR-коды учеников по очереди. После сохранения можно сразу сканировать следующего." : "Наведите камеру на QR-код ученика. После распознавания проверьте выбранный день и подтвердите отметку."}</p>{children}<button type="button" onClick={onClose}>Закрыть камеру</button></div></div>; }
