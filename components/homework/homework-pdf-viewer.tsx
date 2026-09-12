"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { ArrowLeft, ArrowRight, ExternalLink, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import styles from "./homework-pdf-viewer.module.css";

export function HomeworkPdfViewer({ url, filename = "Домашняя работа.pdf", onRefresh }: { url: string; filename?: string; onRefresh?: () => void }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [renderedPage, setRenderedPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(600);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const resize = new ResizeObserver(([entry]) => setWidth(Math.max(200, entry.contentRect.width - 32)));
    resize.observe(element);
    return () => resize.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    let destroy: (() => Promise<void>) | undefined;
    const load = async () => {
      setBusy(true); setError(null); setDocument(null); setPage(1); setRenderedPage(0);
      try {
        const pdfjs = await import("pdfjs-dist");
        if (!active) return;
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const loading = pdfjs.getDocument({ url, isEvalSupported: false });
        destroy = () => loading.destroy();
        const next = await loading.promise;
        if (active) setDocument(next);
      } catch { if (active) { setError("Не удалось показать PDF. Обновите ссылку или откройте файл отдельно."); setBusy(false); } }
    };
    void load();
    return () => { active = false; void destroy?.().catch(() => undefined); };
  }, [url]);

  useEffect(() => {
    if (!document || !canvas.current) return;
    let active = true;
    let render: RenderTask | undefined;
    const draw = async () => {
      setBusy(true); setError(null);
      try {
        const pdfPage = await document.getPage(Math.min(page, document.numPages));
        if (!active || !canvas.current) return;
        const original = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({ scale: width / original.width * zoom });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const element = canvas.current;
        element.width = Math.floor(viewport.width * ratio);
        element.height = Math.floor(viewport.height * ratio);
        element.style.width = `${viewport.width}px`; element.style.height = `${viewport.height}px`;
        render = pdfPage.render({ canvas: element, canvasContext: element.getContext("2d")!, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
        await render.promise;
        if (active) setRenderedPage(page);
      } catch (reason) {
        if (active && !(reason instanceof Error && reason.name === "RenderingCancelledException")) setError("Не удалось отобразить страницу. Попробуйте открыть PDF отдельно.");
      } finally { if (active) setBusy(false); }
    };
    void draw();
    return () => { active = false; render?.cancel(); };
  }, [document, page, width, zoom]);

  return <section className={styles.viewer} aria-label={`Просмотр: ${filename}`}>
    <div className={styles.toolbar}>
      <div className={styles.paging}><button type="button" disabled={!document || page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Предыдущая страница"><ArrowLeft size={18} /></button><span aria-live="polite">{document ? `${page} / ${document.numPages}` : "PDF"}</span><button type="button" disabled={!document || page >= document.numPages} onClick={() => setPage(p => p + 1)} aria-label="Следующая страница"><ArrowRight size={18} /></button></div>
      <div className={styles.tools}><button type="button" onClick={() => setZoom(z => Math.max(1, z - 0.25))} disabled={zoom <= 1} aria-label="Уменьшить"><ZoomOut size={18} /></button><button type="button" onClick={() => setZoom(z => Math.min(2.5, z + 0.25))} disabled={zoom >= 2.5} aria-label="Увеличить"><ZoomIn size={18} /></button><a href={url} target="_blank" rel="noreferrer" aria-label="Открыть PDF отдельно"><ExternalLink size={18} /></a></div>
    </div>
    {error ? <div className={styles.error} role="alert"><p>{error}</p>{onRefresh ? <button type="button" onClick={onRefresh}><RefreshCw size={16} />Обновить PDF</button> : null}<a href={url} target="_blank" rel="noreferrer">Открыть в браузере</a></div> : null}
    <div ref={container} className={styles.canvasArea} aria-busy={busy || (!error && renderedPage !== page)}>
      {busy || (!error && renderedPage !== page) ? <div className={styles.loading}><Spinner /><span>Открываем страницу…</span></div> : null}
      <canvas ref={canvas} aria-label={`Страница ${renderedPage || page} PDF`} data-rendered-page={renderedPage} />
    </div>
    <p className={styles.hint}>Листайте страницы стрелками. Для мелкого текста увеличьте масштаб.</p>
  </section>;
}
