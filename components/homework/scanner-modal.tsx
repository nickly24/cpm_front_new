"use client";

import { useHomeworkUploads } from "@/contexts/homework-upload-context";
import {
  getScannerProject,
  saveScannerProject,
  type ScannerPage,
} from "@/lib/homework-scanner/project-store";
import { PDFDocument } from "pdf-lib";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  CheckCircle2,
  Crop as CropIcon,
  FilePlus2,
  Pencil,
  RotateCw,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScannerPageEditor } from "./scanner-page-editor";
import { LiveCameraScanner } from "./live-camera-scanner";
import styles from "./scanner-modal.module.css";
import { autoCropCanvas, perspectiveCrop } from "@/lib/homework-scanner/opencv-crop";
import { Spinner } from "@/components/ui/spinner";

async function normalize(file: File): Promise<Blob> {
  let source: Blob = file;
  if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")) {
    const convert = (await import("heic2any")).default;
    const result = await convert({ blob: file, toType: "image/jpeg", quality: 0.88 });
    source = Array.isArray(result) ? result[0] : result;
  }
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, 1654 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let normalized = canvas;
  try { normalized = await autoCropCanvas(canvas); } catch { /* manual crop remains available */ }
  return new Promise((resolve, reject) =>
    normalized.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Не удалось обработать снимок"))),
      "image/jpeg",
      0.86,
    ),
  );
}

async function suggestedMode(image:Blob):Promise<ScannerPage["mode"]>{const bitmap=await createImageBitmap(image),canvas=document.createElement("canvas");canvas.width=80;canvas.height=80;const context=canvas.getContext("2d",{willReadFrequently:true})!;context.drawImage(bitmap,0,0,80,80);bitmap.close();const data=context.getImageData(0,0,80,80).data;let chroma=0,sum=0,sumSquares=0,count=0;for(let index=0;index<data.length;index+=16){const r=data[index],g=data[index+1],b=data[index+2],light=(r+g+b)/3;chroma+=Math.max(r,g,b)-Math.min(r,g,b);sum+=light;sumSquares+=light*light;count++}const deviation=Math.sqrt(sumSquares/count-(sum/count)**2);return chroma/count>18?"color":deviation>65?"bw":"gray"}

function filteredCanvas(page: ScannerPage, image: ImageBitmap) {
  const rotated = page.rotation % 180 !== 0;
  const canvas = document.createElement("canvas");
  canvas.width = rotated ? image.height : image.width;
  canvas.height = rotated ? image.width : image.height;
  const context = canvas.getContext("2d")!;
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((page.rotation * Math.PI) / 180);
  context.filter = `brightness(${100 + page.brightness}%) contrast(${100 + page.contrast}%) ${page.mode === "gray" ? "grayscale(1)" : ""} ${page.mode === "bw" ? "grayscale(1) contrast(180%)" : ""}`;
  context.drawImage(image, -image.width / 2, -image.height / 2);
  return canvas;
}

function BlobPreview({ blob, alt, className }: { blob: Blob; alt: string; className?: string }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  // Scanner previews are local object URLs and cannot use the Next image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={url} alt={alt} />;
}

export function ScannerModal({ homeworkId, onClose }: { homeworkId: number; onClose: () => void }) {
  const [pages, setPages] = useState<ScannerPage[]>([]);
  const [selected, setSelected] = useState(0);
  const [editing, setEditing] = useState(false);
  const [liveCamera, setLiveCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [adding, setAdding] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const replacementCamera = useRef<HTMLInputElement>(null);
  const { enqueue } = useHomeworkUploads();

  useEffect(() => {
    void getScannerProject(homeworkId).then((project) => setPages(project?.pages ?? []));
  }, [homeworkId]);

  const persist = async (next: ScannerPage[]) => {
    setPages(next);
    try {
      await saveScannerProject({ homeworkId, pages: next, updatedAt: Date.now() });
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить проект");
    }
  };

  const add = async (files: FileList | null) => {
    if (!files) return;
    setAdding(true);
    const next = [...pages];
    try { for (const file of Array.from(files)) {
      if (next.length >= 35) {
        setError("Максимум 35 страниц");
        break;
      }
      if (file.size > 25 * 1024 * 1024) {
        setError(`${file.name}: больше 25 МБ`);
        continue;
      }
      try {
        const image=await normalize(file);
        next.push({
          id: crypto.randomUUID(),
          image,
          rotation: 0,
          mode: await suggestedMode(image),
          brightness: 0,
          contrast: 0,
        });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Формат не поддерживается");
        break;
      }
    }
      await persist(next);
      setSelected(Math.max(0, next.length - 1));
    } finally { setAdding(false); }
  };

  const addCaptured = async (blob: Blob) => {
    if (pages.length >= 35) { setError("Максимум 35 страниц"); setLiveCamera(false); return; }
    const image=await normalize(new File([blob],"camera.jpg",{type:"image/jpeg"}));
    const next=[...pages,{id:crypto.randomUUID(),image,rotation:0,mode:await suggestedMode(image),brightness:0,contrast:0}];
    await persist(next);setSelected(next.length-1);setLiveCamera(false);
  };

  const update = (patch: Partial<ScannerPage>) => {
    void persist(pages.map((page, index) => (index === selected ? { ...page, ...patch } : page)));
  };

  const move = (delta: number) => {
    const target = selected + delta;
    if (target < 0 || target >= pages.length) return;
    const next = [...pages];
    [next[selected], next[target]] = [next[target], next[selected]];
    setSelected(target);
    void persist(next);
  };

  const crop = async () => {
    if (!current) return;
    const raw = window.prompt("Поля обрезки в процентах: слева, сверху, справа, снизу", "0,0,0,0");
    if (raw === null) return;
    const margins = raw.split(",").map((value) => Number(value.trim()));
    if (margins.length !== 4 || margins.some((value) => !Number.isFinite(value) || value < 0 || value > 40)) {
      setError("Укажите четыре числа от 0 до 40");
      return;
    }
    setProcessingAction("crop");
    const bitmap = await createImageBitmap(current.image);
    const [left, top, right, bottom] = margins;
    const sourceX = Math.round((bitmap.width * left) / 100);
    const sourceY = Math.round((bitmap.height * top) / 100);
    const width = Math.round((bitmap.width * (100 - left - right)) / 100);
    const height = Math.round((bitmap.height * (100 - top - bottom)) / 100);
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    canvas.getContext("2d")!.drawImage(bitmap, sourceX, sourceY, width, height, 0, 0, width, height); bitmap.close();
    const image = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("crop_failed")), "image/jpeg", 0.9));
    update({ image });
    setProcessingAction(null);
  };

  const correctCorners = async () => {
    if (!current) return;
    const raw=window.prompt("Четыре угла в %: x,y; x,y; x,y; x,y", "0,0; 100,0; 100,100; 0,100");if(raw===null)return;
    const values=raw.split(";").map(pair=>pair.split(",").map(value=>Number(value.trim())));
    if(values.length!==4||values.some(pair=>pair.length!==2||pair.some(value=>!Number.isFinite(value)||value<0||value>100))){setError("Укажите четыре пары координат от 0 до 100");return}
    setProcessingAction("corners");
    try { const bitmap=await createImageBitmap(current.image),source=document.createElement("canvas");source.width=bitmap.width;source.height=bitmap.height;source.getContext("2d")!.drawImage(bitmap,0,0);bitmap.close();
      const corrected=await perspectiveCrop(source,values.map(([x,y])=>({x:x*source.width/100,y:y*source.height/100}))),image=await new Promise<Blob>((resolve,reject)=>corrected.toBlob(blob=>blob?resolve(blob):reject(new Error("perspective_failed")),"image/jpeg",.9));update({image});
    } finally { setProcessingAction(null); }
  };

  const build = async () => {
    if (!pages.length) return;
    setBuilding(true);
    try {
      const pdf = await PDFDocument.create();
      for (const page of pages) {
        const bitmap = await createImageBitmap(page.image);
        const canvas = filteredCanvas(page, bitmap);
        bitmap.close();
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) => (value ? resolve(value) : reject(new Error("render_failed"))),
            "image/jpeg",
            0.82,
          ),
        );
        const embedded = await pdf.embedJpg(await blob.arrayBuffer());
        const sheet = pdf.addPage([embedded.width, embedded.height]);
        sheet.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
      }
      const bytes = await pdf.save({ useObjectStreams: true });
      const file = new File([Uint8Array.from(bytes).buffer], `homework-${homeworkId}.pdf`, {
        type: "application/pdf",
      });
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("PDF больше 10 МБ. Удалите лишние страницы или переведите их в ч/б.");
      }
      enqueue(homeworkId, file);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось собрать PDF");
    } finally {
      setBuilding(false);
    }
  };

  const current = pages[selected];
  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <header>
          <div className={styles.headerTitle}>
            <h2>Сканер</h2>
            <p><CheckCircle2 /> Проект сохранён локально на устройстве · {pages.length} из 35</p>
          </div>
          <div className={styles.headerActions}>
            <input hidden multiple ref={input} type="file" accept="image/jpeg,image/png,image/heic,image/webp,.heic" onChange={(event) => void add(event.target.files)} />
            <input hidden ref={replacementCamera} type="file" accept="image/*" capture="environment" onChange={(event) => { const file=event.target.files?.[0]; if(file) void normalize(file).then((image)=>update({image})); }} />
            <button disabled={adding} onClick={() => setLiveCamera(true)}><Camera />Камера</button>
            <button disabled={adding} onClick={() => input.current?.click()}>{adding ? <Spinner size="sm" /> : <FilePlus2 />}{adding ? "Добавляем…" : "Из галереи"}</button>
            <button className={styles.primary} disabled={!pages.length || building || adding} onClick={() => void build()}>{building ? <><Spinner size="sm" />Собираем PDF…</> : <><FilePlus2 />Создать PDF</>}</button>
            <button className={styles.close} onClick={onClose} aria-label="Закрыть"><X /></button>
          </div>
        </header>
        <main>
          <aside className={styles.thumbnails}>
            <h3>Страницы ({pages.length})</h3>
            {pages.map((page, index) => (
              <button key={page.id} data-active={index === selected} onClick={() => setSelected(index)}>
                <BlobPreview blob={page.image} alt={`Страница ${index + 1}`} />
                <span>{index + 1}</span>
              </button>
            ))}
          </aside>
          <section className={styles.previewSection}>
            {current ? (
              <BlobPreview className={styles.preview} blob={current.image} alt="Страница" />
            ) : (
              <div className={styles.empty}><Camera size={54} /><h3>Сфотографируйте или добавьте листы</h3><p>JPEG, PNG, HEIC и WebP до 25 МБ.</p></div>
            )}
          </section>
          {current ? <aside className={styles.toolPanel}>
            <h3>Страница {selected + 1}</h3>
            <div className={styles.tools}>
              <button data-primary onClick={() => setEditing(true)}><Pencil />Редактор</button>
              <button disabled={processingAction !== null} onClick={() => void crop()}>{processingAction === "crop" ? <Spinner size="sm" /> : <CropIcon />}Обрезать</button>
              <button disabled={processingAction !== null} onClick={() => void correctCorners()}>{processingAction === "corners" ? <Spinner size="sm" /> : null}4 угла</button>
              <button onClick={() => { if (window.confirm("Пересъёмка удалит правки этой страницы. Продолжить?")) replacementCamera.current?.click(); }}><Camera />Пересня́ть</button>
              <button onClick={() => update({ rotation: (current.rotation + 90) % 360 })}><RotateCw />Повернуть</button>
              <button disabled={selected === 0} onClick={() => move(-1)}><ArrowUp />Выше</button>
              <button disabled={selected === pages.length - 1} onClick={() => move(1)}><ArrowDown />Ниже</button>
              <button className={styles.delete} onClick={() => { const next = pages.filter((_, index) => index !== selected); setSelected(Math.max(0, selected - 1)); void persist(next); }}><Trash2 />Удалить</button>
            </div>
            <h4>Режим</h4>
            <select value={current.mode} onChange={(event) => update({ mode: event.target.value as ScannerPage["mode"] })}>
              <option value="auto">Авто</option><option value="color">Цвет</option><option value="gray">Серый</option><option value="bw">Ч/б</option>
            </select>
            <label>Яркость <input type="range" min={-40} max={40} value={current.brightness} onChange={(event) => update({ brightness: Number(event.target.value) })} /><span>{current.brightness}</span></label>
            <label>Контраст <input type="range" min={-40} max={60} value={current.contrast} onChange={(event) => update({ contrast: Number(event.target.value) })} /><span>{current.contrast}</span></label>
          </aside> : null}
        </main>
        {error ? <div className={styles.error}>{error}</div> : null}
        {editing && current ? (
          <ScannerPageEditor
            image={current.image}
            onClose={() => setEditing(false)}
            onSave={(image) => { update({ image }); setEditing(false); }}
          />
        ) : null}
        {liveCamera ? <LiveCameraScanner onCapture={(blob)=>void addCaptured(blob)} onClose={()=>setLiveCamera(false)} /> : null}
      </div>
    </div>
  );
}
