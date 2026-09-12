"use client";

import { detectPageCorners, type PagePoint } from "@/lib/homework-scanner/opencv-crop";
import { scannerCanvasBlob } from "@/lib/homework-scanner/page-render";
import { Camera, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import styles from "./live-camera-scanner.module.css";

export function LiveCameraScanner({ onCapture, onClose }: { onCapture: (blob: Blob) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const capturing = useRef(false);
  const previous = useRef<PagePoint[] | null>(null);
  const stable = useRef(0);
  const automatic = useRef(false);
  const [autoCapture, setAutoCapture] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("Разрешите доступ к камере");
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(async () => {
    const element = video.current;
    if (!element?.videoWidth || capturing.current) return;
    capturing.current = true;
    setBusy(true);
    try {
      const source = document.createElement("canvas");
      source.width = element.videoWidth;
      source.height = element.videoHeight;
      source.getContext("2d")!.drawImage(element, 0, 0);
      // Keep the complete frame; the student chooses any crop in the page editor.
      onCapture(await scannerCanvasBlob(source, .9));
    } catch {
      setError("Не удалось сделать снимок. Попробуйте ещё раз.");
      capturing.current = false;
      setBusy(false);
    }
  }, [onCapture]);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let stopped = false;
    let timer = 0;
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera_unavailable");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) { stream.getTracks().forEach(track => track.stop()); return; }
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        if (stopped) return;
        setReady(true);
        setHint("Поместите лист в кадр целиком");
        const scan = async () => {
          const element = video.current;
          if (stopped || !element || !overlay.current || capturing.current) return;
          if (!element.videoWidth) { timer = window.setTimeout(() => void scan(), 300); return; }
          const source = document.createElement("canvas");
          source.width = 640;
          source.height = Math.round(640 * element.videoHeight / element.videoWidth);
          source.getContext("2d")!.drawImage(element, 0, 0, source.width, source.height);
          let points: PagePoint[] | null = null;
          try { points = await detectPageCorners(source); } catch { /* Manual capture remains available. */ }
          if (stopped || !overlay.current || capturing.current) return;
          const canvas = overlay.current;
          const box = canvas.getBoundingClientRect();
          const ratio = window.devicePixelRatio || 1;
          canvas.width = Math.round(box.width * ratio);
          canvas.height = Math.round(box.height * ratio);
          const context = canvas.getContext("2d")!;
          context.scale(ratio, ratio);
          context.clearRect(0, 0, box.width, box.height);
          if (points) {
            const normalized = points.map(point => ({ x: point.x / source.width, y: point.y / source.height }));
            const scale = Math.min(box.width / source.width, box.height / source.height);
            const width = source.width * scale, height = source.height * scale;
            const left = (box.width - width) / 2, top = (box.height - height) / 2;
            context.beginPath();
            normalized.forEach((point, index) => {
              const x = left + point.x * width, y = top + point.y * height;
              if (index) context.lineTo(x, y); else context.moveTo(x, y);
            });
            context.closePath();
            context.strokeStyle = "#5de190";
            context.lineWidth = 3;
            context.stroke();
            if (previous.current) {
              const delta = normalized.reduce((sum, point, index) => sum + Math.hypot(point.x - previous.current![index].x, point.y - previous.current![index].y), 0);
              stable.current = delta < .035 ? stable.current + 1 : 0;
            }
            previous.current = normalized;
            setHint(automatic.current ? "Лист найден. Держите камеру ровно" : "Лист найден — можно снимать");
            if (automatic.current && stable.current >= 3) void capture();
          } else {
            previous.current = null;
            stable.current = 0;
            setHint("Убедитесь, что все края листа видны");
          }
          timer = window.setTimeout(() => void scan(), 450);
        };
        timer = window.setTimeout(() => void scan(), 400);
      } catch {
        if (!stopped) setError("Камера недоступна. Разрешите доступ в браузере или вернитесь к выбору фотографий.");
      }
    };
    void start();
    return () => { stopped = true; window.clearTimeout(timer); stream?.getTracks().forEach(track => track.stop()); };
  }, [capture]);

  return <div className={styles.camera}>
    <header><div><h2>Снимите страницу</h2><p>Все края листа должны попадать в кадр</p></div><button disabled={busy} className={styles.close} onClick={onClose} aria-label="Вернуться к страницам"><X /></button></header>
    <div className={styles.viewfinder}><video ref={video} playsInline muted /><canvas ref={overlay} />{!ready && !error ? <div className={styles.loading}><Spinner />Подключаем камеру…</div> : null}</div>
    <div className={styles.controls}>
      {error ? <p className={styles.error} role="alert">{error}</p> : <p aria-live="polite">{busy ? "Добавляем снимок…" : hint}</p>}
      <label><input type="checkbox" checked={autoCapture} disabled={!ready || busy} onChange={event => { automatic.current = event.target.checked; stable.current = 0; setAutoCapture(event.target.checked); }} /><span>Автоснимок, когда камера неподвижна</span></label>
      <button className={styles.capture} disabled={!ready || busy} onClick={() => void capture()}>{busy ? <Spinner size="sm" /> : <Camera />}{busy ? "Добавляем…" : "Снять страницу"}</button>
      <button className={styles.back} disabled={busy} onClick={onClose}>Вернуться к страницам</button>
    </div>
  </div>;
}
