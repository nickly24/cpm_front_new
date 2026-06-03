"use client";

import { useAuth } from "@/contexts/AuthContext";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./performance.module.css";

export function AttendanceQrCard() {
  const { user } = useAuth();
  const studentId = user?.id;
  const [isOpen, setIsOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!isOpen || studentId == null) {
      return;
    }

    let cancelled = false;

    async function generateQr() {
      setIsGenerating(true);

      try {
        const url = await QRCode.toDataURL(String(studentId), {
          width: 220,
          margin: 2,
          color: {
            dark: "#1a1d26",
            light: "#ffffff",
          },
        });

        if (!cancelled) {
          setQrCodeUrl(url);
        }
      } catch {
        if (!cancelled) {
          setQrCodeUrl("");
        }
      } finally {
        if (!cancelled) {
          setIsGenerating(false);
        }
      }
    }

    void generateQr();

    return () => {
      cancelled = true;
    };
  }, [isOpen, studentId]);

  return (
    <section className={styles.qrCard}>
      <div className={styles.qrHeader}>
        <div className={styles.qrIcon}>
          <QrCode size={22} />
        </div>
        <div>
          <h2 className={styles.qrTitle}>QR для посещаемости</h2>
          <p className={styles.qrSubtitle}>
            Покажите код преподавателю для отметки на занятии
          </p>
        </div>
      </div>

      <button
        type="button"
        className={isOpen ? `${styles.btn} ${styles.btnGhost}` : styles.btn}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? "Скрыть QR-код" : "Показать QR-код"}
      </button>

      {isOpen ? (
        <div className={styles.qrPanel}>
          {isGenerating ? (
            <p className={styles.muted}>Генерация QR-кода...</p>
          ) : qrCodeUrl ? (
            <div className={styles.qrImageWrap}>
              <img
                src={qrCodeUrl}
                alt="QR-код студента"
                className={styles.qrImage}
              />
            </div>
          ) : (
            <p className={styles.muted}>Не удалось сгенерировать QR-код</p>
          )}

          {studentId != null ? (
            <p className={styles.qrId}>
              Ваш ID: <strong>{studentId}</strong>
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
