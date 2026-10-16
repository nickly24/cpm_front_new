"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import styles from "./performance.module.css";

export function StudentProfileQr({ studentId }: { studentId?: number }) {
  const payload = typeof studentId === "number" && Number.isSafeInteger(studentId) && studentId > 0 ? String(studentId) : null;
  const [image, setImage] = useState<{ payload: string; url: string } | null>(null);
  const [failedPayload, setFailedPayload] = useState<string | null>(null);

  useEffect(() => {
    if (!payload) return;
    const value = payload;
    let cancelled = false;
    async function generate() {
      try {
        // Plain student ID only. No JSON, account ID, identity fields or session data.
        const url = await QRCode.toDataURL(value, {
          width: 256,
          margin: 4,
          errorCorrectionLevel: "M",
          color: { dark: "#111827", light: "#ffffff" },
        });
        if (!cancelled) setImage({ payload: value, url });
      } catch {
        if (!cancelled) setFailedPayload(payload);
      }
    }
    void generate();
    return () => { cancelled = true; };
  }, [payload]);

  return <div className={styles.profileQr}>
    <div className={styles.profileQrImage}>
      {payload && image?.payload === payload ? (
        // Locally generated QR bitmap; no remote image request or optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.url} width={256} height={256} alt="QR-код ученика" />
      ) : <p role="status">{!payload ? "QR-код недоступен" : failedPayload === payload ? "Не удалось создать QR-код" : "Подготовка QR-кода…"}</p>}
    </div>
    <p className={styles.profileQrLabel}>Мой QR-код</p>
  </div>;
}
