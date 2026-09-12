"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useHomeworkUploads } from "@/contexts/homework-upload-context";
import { getScannerProject, saveScannerProject, type ScannerPage } from "@/lib/homework-scanner/project-store";
import { renderScannerPage, scannerCanvasBlob } from "@/lib/homework-scanner/page-render";
import { scannerFilterLabels } from "@/lib/homework-scanner/image-filters";
import { PDFDocument } from "pdf-lib";
import { ArrowDown, ArrowLeft, ArrowUp, Camera, CheckCircle2, FilePlus2, Images, Pencil, RotateCw, SlidersHorizontal, Trash2, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ScannerAdjustEditor } from "./scanner-adjust-editor";
import { ScannerPageEditor } from "./scanner-page-editor";
import { LiveCameraScanner } from "./live-camera-scanner";
import { useHomeworkDialog } from "@/lib/homework-files/use-dialog";
import { Spinner } from "@/components/ui/spinner";
import styles from "./scanner-modal.module.css";

async function normalize(file: File): Promise<Blob> {
  let source: Blob = file;
  if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")) {
    const convert = (await import("heic2any")).default;
    const result = await convert({ blob: file, toType: "image/jpeg", quality: .88 });
    source = Array.isArray(result) ? result[0] : result;
  }
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, 1654 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d")!;
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return scannerCanvasBlob(canvas, .86);
}

function PagePreview({ page, thumbnail = false }: { page: ScannerPage; thumbnail?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let stopped = false;
    void renderScannerPage(page, { maxSide: thumbnail ? 180 : 1200 }).then(rendered => {
      if (stopped || !canvas.current) return;
      canvas.current.width = rendered.width;
      canvas.current.height = rendered.height;
      canvas.current.getContext("2d")!.drawImage(rendered, 0, 0);
      setFailed(false);
    }).catch(() => { if (!stopped) setFailed(true); });
    return () => { stopped = true; };
  }, [page, thumbnail]);
  return failed ? <span>Не удалось открыть страницу</span> : <canvas ref={canvas} className={styles.preview} aria-label="Предпросмотр страницы" role="img" />;
}

type Screen = "pages" | "adjust" | "markup" | "camera";

export function ScannerModal({ homeworkId, onClose }: { homeworkId: number; onClose: () => void }) {
  const { user } = useAuth();
  const { enqueue } = useHomeworkUploads();
  const [pages, setPages] = useState<ScannerPage[]>([]);
  const pagesRef = useRef<ScannerPage[]>([]);
  const [selected, setSelected] = useState(0);
  const [screen, setScreen] = useState<Screen>("pages");
  const [editorImage, setEditorImage] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"loading" | "saving" | "saved" | "failed">("loading");
  const [building, setBuilding] = useState(false);
  const [adding, setAdding] = useState(false);
  const [previousEdit, setPreviousEdit] = useState<ScannerPage | null>(null);
  const [deleted, setDeleted] = useState<{ page: ScannerPage; index: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const replacementCamera = useRef<HTMLInputElement>(null);
  const writeQueue = useRef(Promise.resolve());
  const writeVersion = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const current = pages[selected];
  const busy = adding || building || saveState === "loading";

  useEffect(() => {
    let stopped = false;
    void getScannerProject(homeworkId, user?.id).then(project => {
      if (stopped) return;
      pagesRef.current = project?.pages ?? [];
      setPages(pagesRef.current);
      setSaveState("saved");
    }).catch(() => {
      if (stopped) return;
      setSaveState("failed");
      setSaveError("Не удалось открыть сохранённый проект. Можно добавить страницы и подготовить PDF, не закрывая сканер.");
    });
    return () => { stopped = true; };
  }, [homeworkId, user?.id]);

  useEffect(() => { root.current?.focus(); }, [screen]);

  const persist = (next: ScannerPage[]) => {
    pagesRef.current = next;
    setPages(next);
    setSaveState("saving");
    const version = ++writeVersion.current;
    const pending = writeQueue.current.then(() => saveScannerProject({ homeworkId, pages: next, updatedAt: Date.now() }, user?.id));
    writeQueue.current = pending.then(() => {
      if (version !== writeVersion.current) return;
      setSaveState("saved");
      setSaveError(null);
    }, reason => {
      if (version !== writeVersion.current) return;
      setSaveState("failed");
      setSaveError(reason instanceof Error ? reason.message : "Последние изменения пока не сохранены на устройстве.");
    });
    return writeQueue.current;
  };

  const add = async (files: FileList | File[] | null, replace = false) => {
    if (!files || !files.length || busy) return;
    setAdding(true);
    setError(null);
    const next = [...pagesRef.current];
    const errors: string[] = [];
    try {
      for (const file of Array.from(files)) {
        if (!replace && next.length >= 35) { errors.push("В одном PDF может быть до 35 страниц."); break; }
        if (file.size > 25 * 1024 * 1024) { errors.push(`${file.name}: размер больше 25 МБ.`); continue; }
        try {
          const image = await normalize(file);
          const page: ScannerPage = { id: crypto.randomUUID(), image, rotation: 0, mode: "auto", brightness: 0, contrast: 0 };
          if (replace && next[selected]) next[selected] = { ...page, id: next[selected].id };
          else next.push(page);
        } catch {
          errors.push(`${file.name}: не удалось прочитать изображение. Используйте JPEG, PNG, HEIC или WebP.`);
        }
      }
      await persist(next);
      if (!replace) setSelected(Math.max(0, next.length - 1));
      if (errors.length) setError(errors.join(" "));
    } finally {
      setAdding(false);
      if (input.current) input.current.value = "";
      if (replacementCamera.current) replacementCamera.current.value = "";
    }
  };

  const update = (patch: Partial<ScannerPage>) => {
    setPreviousEdit(pagesRef.current[selected] ?? null);
    void persist(pagesRef.current.map((page, index) => index === selected ? { ...page, ...patch } : page));
  };

  const move = (delta: number) => {
    const next = [...pagesRef.current];
    const target = selected + delta;
    if (target < 0 || target >= next.length) return;
    [next[selected], next[target]] = [next[target], next[selected]];
    setSelected(target);
    void persist(next);
  };

  const openMarkup = async () => {
    if (!current || busy) return;
    setAdding(true);
    setError(null);
    try {
      setEditorImage(await scannerCanvasBlob(await renderScannerPage(current), .98));
      setScreen("markup");
    } catch { setError("Не удалось открыть разметку. Попробуйте ещё раз."); }
    finally { setAdding(false); }
  };

  const build = async () => {
    if (!pages.length || busy) return;
    setBuilding(true);
    setError(null);
    try {
      const pdf = await PDFDocument.create();
      for (const page of pagesRef.current) {
        const blob = await scannerCanvasBlob(await renderScannerPage(page), .82);
        const embedded = await pdf.embedJpg(await blob.arrayBuffer());
        const sheet = pdf.addPage([embedded.width, embedded.height]);
        sheet.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
      }
      const bytes = await pdf.save({ useObjectStreams: true });
      const file = new File([Uint8Array.from(bytes).buffer], `homework-${homeworkId}.pdf`, { type: "application/pdf" });
      if (file.size > 10 * 1024 * 1024) throw new Error("PDF получился больше 10 МБ. Удалите лишние страницы или выберите фильтр «Документ».");
      enqueue(homeworkId, file);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось подготовить PDF. Страницы остались в сканере.");
    } finally { setBuilding(false); }
  };

  const close = () => {
    if (busy) return;
    if (screen !== "pages") setScreen("pages");
    else onClose();
  };

  useHomeworkDialog(root, close);

  return <div className={styles.backdrop}>
    <div ref={root} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-label="Сканер домашней работы">
      {screen === "adjust" && current ? <ScannerAdjustEditor page={current} onClose={() => setScreen("pages")} onSave={patch => { update(patch); setScreen("pages"); }} />
      : screen === "markup" && editorImage ? <ScannerPageEditor image={editorImage} onClose={() => setScreen("pages")} onSave={image => {
        // Markup includes the visible rotation and treatment; do not apply them twice.
        update({ image, rotation: 0, mode: "auto", brightness: 0, contrast: 0 });
        setScreen("pages");
      }} />
      : screen === "camera" ? <LiveCameraScanner onCapture={blob => { setScreen("pages"); void add([new File([blob], "camera.jpg", { type: "image/jpeg" })]); }} onClose={() => setScreen("pages")} />
      : <>
        <header className={styles.header}>
          <button className={styles.back} disabled={busy} onClick={onClose}><ArrowLeft /><span>К работе</span></button>
          <div className={styles.headerTitle}><h2>Сканер</h2><p>{pages.length} из 35 страниц</p></div>
          <span className={styles.localBadge}><CheckCircle2 />На устройстве</span>
        </header>
        <ol className={styles.steps} aria-label="Подготовка файла"><li data-active={!pages.length}><b>1</b>Добавьте</li><li data-active={Boolean(pages.length)}><b>2</b>Проверьте</li><li><b>3</b>Подготовьте PDF</li></ol>
        <input hidden multiple ref={input} type="file" accept="image/jpeg,image/png,image/heic,image/webp,.heic" onChange={event => void add(event.target.files)} />
        <input hidden ref={replacementCamera} type="file" accept="image/*" capture="environment" onChange={event => void add(event.target.files, true)} />
        <main className={styles.body}>
          {saveState === "loading" ? <div className={styles.empty}><Spinner /><h3>Открываем страницы…</h3></div>
          : !pages.length ? <div className={styles.empty}>
            <div className={styles.emptyIcon}><Images /></div><h3>Соберите работу из фотографий</h3><p>Каждый снимок станет страницей PDF. После добавления проверьте, что текст читается целиком.</p>
            <div className={styles.addActions}><button className={styles.primary} disabled={busy} onClick={() => setScreen("camera")}><Camera />Снять страницу</button><button disabled={busy} onClick={() => input.current?.click()}><Images />Выбрать фото</button></div>
            <small>JPEG, PNG, HEIC или WebP · до 25 МБ на фото</small>
          </div> : <>
            <div className={styles.pageBar}><h3>Страницы <span>{pages.length}</span></h3><div className={styles.addActions}><button disabled={busy || pages.length >= 35} onClick={() => setScreen("camera")}><Camera /><span>Камера</span></button><button disabled={busy || pages.length >= 35} onClick={() => input.current?.click()}>{adding ? <Spinner size="sm" /> : <Images />}<span>Добавить фото</span></button></div></div>
            <div className={styles.thumbnails} aria-label="Страницы PDF">{pages.map((page, index) => <button key={page.id} aria-label={`Страница ${index + 1}`} aria-pressed={index === selected} disabled={busy} data-active={index === selected} onClick={() => setSelected(index)}><PagePreview page={page} thumbnail /><span>{index + 1}</span></button>)}</div>
            {current ? <div className={styles.pageWorkspace}>
              <section className={styles.previewSection}><PagePreview page={current} /></section>
              <section className={styles.toolPanel}><div className={styles.pageTitle}><h3>Страница {selected + 1}</h3><span>{scannerFilterLabels[current.mode]}</span></div><p>Проверьте края листа и читаемость текста.</p>
                <div className={styles.tools}>
                  <button disabled={busy} className={styles.adjust} onClick={() => setScreen("adjust")}><SlidersHorizontal /><span>Границы и фильтры</span></button>
                  <button disabled={busy} onClick={() => void openMarkup()}><Pencil /><span>Разметка</span></button>
                  <button disabled={busy} onClick={() => update({ rotation: (current.rotation + 90) % 360 })}><RotateCw /><span>Повернуть</span></button>
                  <button disabled={busy} onClick={() => { if (window.confirm("Заменить снимок? Обработка и разметка этой страницы будут удалены.")) replacementCamera.current?.click(); }}><Camera /><span>Переснять</span></button>
                </div>
                {previousEdit?.id === current.id ? <button disabled={busy} onClick={() => { const previous = previousEdit; setPreviousEdit(null); void persist(pagesRef.current.map(page => page.id === previous.id ? previous : page)); }}><Undo2 />Отменить последнюю правку</button> : null}
                <div className={styles.orderControls}><span>Порядок страниц</span><button aria-label="Переместить страницу раньше" disabled={busy || selected === 0} onClick={() => move(-1)}><ArrowUp />Раньше</button><button aria-label="Переместить страницу позже" disabled={busy || selected === pages.length - 1} onClick={() => move(1)}><ArrowDown />Позже</button></div>
                <button className={styles.delete} disabled={busy} onClick={() => { setDeleted({ page: current, index: selected }); const next = pagesRef.current.filter((_, index) => index !== selected); setSelected(Math.max(0, selected - 1)); void persist(next); }}><Trash2 />Удалить страницу</button>
              </section>
            </div> : null}
          </>}
          {deleted ? <div className={styles.undo}><span>Страница удалена</span><button disabled={busy || pages.length >= 35} onClick={() => { const next = [...pagesRef.current]; const index = Math.min(deleted.index, next.length); next.splice(index, 0, deleted.page); setSelected(index); setDeleted(null); void persist(next); }}><Undo2 />Вернуть</button></div> : null}
        </main>
        {(error || saveError) ? <div className={styles.error} role="alert">{error ? <p>{error}</p> : null}{saveError ? <p>{saveError}</p> : null}</div> : null}
        <footer className={styles.footer}>
          <div><p aria-live="polite">{saveState === "saving" ? "Сохраняем страницы…" : saveState === "failed" ? "Есть несохранённые изменения" : "Проект хранится на этом устройстве"}</p><small>PDF загрузится в работу. Отправить на проверку можно следующим шагом.</small></div>
          <button className={styles.primary} disabled={!pages.length || busy} onClick={() => void build()}>{building ? <Spinner size="sm" /> : <FilePlus2 />}{building ? "Подготавливаем…" : "Подготовить PDF"}</button>
        </footer>
      </>}
    </div>
  </div>;
}
