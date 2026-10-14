"use client";
import { useEffect, useId, useRef, useState } from "react";
import { styles } from "./shared";
export function AttendanceCamera({ onRead, onClose }: {
    onRead: (code: string) => void;
    onClose: () => void;
}) { const id = useId().replaceAll(":", ""); const [error, setError] = useState(""); const onReadRef = useRef(onRead); useEffect(() => { onReadRef.current = onRead; }, [onRead]); useEffect(() => { let disposed = false; let scanner: import("html5-qrcode").Html5Qrcode | undefined; let read = false; async function start() { try {
    const { Html5Qrcode } = await import("html5-qrcode");
    if (disposed)
        return;
    scanner = new Html5Qrcode(id);
    await scanner.start({ facingMode: "environment" }, { fps: 8, qrbox: { width: 240, height: 240 } }, code => { if (!disposed && !read) {
        read = true;
        onReadRef.current(code);
    } }, () => { });
    if (disposed)
        await scanner.stop();
}
catch (e) {
    if (!disposed)
        setError(e instanceof Error ? e.message : "Не удалось открыть камеру");
} } void start(); return () => { disposed = true; if (scanner?.isScanning)
    void scanner.stop().catch(() => { }); }; }, [id]); return <div className={styles.modal}><div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Сканирование камерой"><h2>Сканирование камерой</h2><div id={id}/>{error && <p className={styles.error} role="alert">{error}</p>}<p className={styles.muted}>Наведите камеру на QR-код ученика. После распознавания проверьте выбранный день и подтвердите отметку.</p><button onClick={onClose}>Закрыть камеру</button></div></div>; }
