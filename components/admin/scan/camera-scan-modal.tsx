"use client";

import type { AttendanceSetAction } from "@/lib/attendance/attendance-api";
import { markInPersonAttendance } from "@/lib/attendance/attendance-api";
import cameraStyles from "@/components/admin/scan/admin-scan.module.css";
import { normalizeScannedStudentId } from "@/lib/attendance/attendance-utils";
import { useEffect, useRef, useState } from "react";

const SCAN_COOLDOWN_MS = 2200;
const SUCCESS_SHOW_MS = 1200;
const CONTAINER_ID = "cpm-camera-scan-container";

interface CameraScanModalProps {
  open: boolean;
  classDayId: number | null;
  onClose: () => void;
  onSuccess: (studentId: string, action?: AttendanceSetAction) => void;
}

export function CameraScanModal({
  open,
  classDayId,
  onClose,
  onSuccess,
}: CameraScanModalProps) {
  const [frameState, setFrameState] = useState<
    "idle" | "scanning" | "success" | "duplicate"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const lastScannedRef = useRef<{ value: string | null; at: number }>({
    value: null,
    at: 0,
  });
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (!open || !classDayId) return;

    setError(null);
    setFrameState("idle");
    let mounted = true;

    async function startCamera() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras.length) {
          if (mounted) setError("Камера не найдена");
          return;
        }
        if (!mounted) return;

        const html5Qrcode = new Html5Qrcode(CONTAINER_ID);
        scannerRef.current = html5Qrcode;

        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const cameraConfig = isMobile
          ? { facingMode: "environment" as const }
          : cameras[0].id;

        await html5Qrcode.start(
          cameraConfig,
          {
            fps: 10,
            qrbox: { width: 260, height: 200 },
            aspectRatio: 1,
          },
          (decodedText) => {
            if (!mounted || !classDayId) return;
            const now = Date.now();
            if (
              lastScannedRef.current.value === decodedText &&
              now - lastScannedRef.current.at < SCAN_COOLDOWN_MS
            ) {
              return;
            }
            lastScannedRef.current = { value: decodedText, at: now };

            const studentId = normalizeScannedStudentId(decodedText);
            if (!studentId) return;

            setFrameState("scanning");
            void markInPersonAttendance(classDayId, studentId)
              .then((result) => {
                if (!mounted) return;
                if (result.status) {
                  if (result.action === "unchanged") {
                    setFrameState("duplicate");
                  } else {
                    setFrameState("success");
                  }
                  onSuccessRef.current(studentId, result.action);
                  window.setTimeout(() => {
                    if (mounted) setFrameState("idle");
                  }, result.action === "unchanged" ? 1800 : SUCCESS_SHOW_MS);
                } else {
                  setFrameState("idle");
                  setError(result.error ?? "Ошибка");
                  window.setTimeout(() => {
                    if (mounted) setError(null);
                  }, 4000);
                }
              })
              .catch((err: unknown) => {
                if (!mounted) return;
                setFrameState("idle");
                setError(
                  err instanceof Error ? err.message : "Ошибка сети",
                );
                window.setTimeout(() => {
                  if (mounted) setError(null);
                }, 4000);
              });
          },
          () => {},
        );
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Не удалось запустить камеру",
          );
        }
      }
    }

    void startCamera();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        void scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open, classDayId]);

  if (!open) return null;

  const frameClass =
    frameState === "success"
      ? `${cameraStyles.cameraFrame} ${cameraStyles.cameraFrameSuccess}`
      : frameState === "duplicate"
        ? `${cameraStyles.cameraFrame} ${cameraStyles.cameraFrameDuplicate}`
        : frameState === "scanning"
          ? `${cameraStyles.cameraFrame} ${cameraStyles.cameraFrameScanning}`
          : cameraStyles.cameraFrame;

  return (
    <div className={cameraStyles.cameraOverlay}>
      <div className={cameraStyles.cameraModal}>
        <div className={cameraStyles.cameraHeader}>
          <button
            type="button"
            className={cameraStyles.cameraBack}
            onClick={onClose}
          >
            ← Назад
          </button>
          <span className={cameraStyles.cameraTitle}>Сканирование камерой</span>
        </div>
        <div className={cameraStyles.cameraBody}>
          <div className={cameraStyles.cameraReaderWrap}>
            <div id={CONTAINER_ID} className={cameraStyles.cameraReader} />
            <div className={cameraStyles.cameraMask}>
              <div className={frameClass}>
                <span className={cameraStyles.cameraFrameText}>
                  {frameState === "idle" && "Наведите QR или штрих-код"}
                  {frameState === "scanning" && "Сканирование…"}
                  {frameState === "success" && "✓ Готово"}
                  {frameState === "duplicate" && "⚠ Уже отмечен"}
                </span>
              </div>
            </div>
          </div>
          {error ? <div className={cameraStyles.cameraError}>{error}</div> : null}
        </div>
      </div>
    </div>
  );
}
