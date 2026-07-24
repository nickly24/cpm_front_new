"use client";

import { Spinner } from "@/components/ui/spinner";
import {
  scannerCanvasFilter,
  scannerFilterLabels,
  type ScannerFilterMode,
} from "@/lib/homework-scanner/image-filters";
import {
  detectPageCorners,
  perspectiveCrop,
  type PagePoint,
} from "@/lib/homework-scanner/opencv-crop";
import type { ScannerPage } from "@/lib/homework-scanner/project-store";
import {
  Check,
  Crop,
  Eye,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import styles from "./scanner-adjust-editor.module.css";

interface Dimensions { width:number; height:number }

const insetPoints=(width:number,height:number):PagePoint[]=>{
  const x=width*.035,y=height*.035;
  return[
    {x,y},
    {x:width-x,y},
    {x:width-x,y:height-y},
    {x,y:height-y},
  ];
};

function toBlob(canvas:HTMLCanvasElement){
  return new Promise<Blob>((resolve,reject)=>
    canvas.toBlob(value=>value?resolve(value):reject(new Error("Не удалось сохранить изображение")),"image/jpeg",.92),
  );
}

export function ScannerAdjustEditor({
  page,
  onSave,
  onClose,
}:{
  page:ScannerPage;
  onSave:(patch:Pick<ScannerPage,"image"|"mode"|"brightness"|"contrast">)=>void;
  onClose:()=>void;
}){
  const preview=useRef<HTMLCanvasElement>(null);
  const source=useRef<HTMLCanvasElement|null>(null);
  const overlay=useRef<SVGSVGElement>(null);
  const [dimensions,setDimensions]=useState<Dimensions|null>(null);
  const [points,setPoints]=useState<PagePoint[]>([]);
  const [dragging,setDragging]=useState<number|null>(null);
  const [tab,setTab]=useState<"crop"|"filters">("crop");
  const [mode,setMode]=useState<ScannerFilterMode>(page.mode);
  const [brightness,setBrightness]=useState(page.brightness);
  const [contrast,setContrast]=useState(page.contrast);
  const [compare,setCompare]=useState(false);
  const [detecting,setDetecting]=useState(false);
  const [saving,setSaving]=useState(false);
  const [hint,setHint]=useState("Перетащите точки точно к углам листа");
  const [error,setError]=useState<string|null>(null);

  const draw=useCallback(()=>{
    if(!preview.current||!source.current)return;
    const canvas=preview.current,raw=source.current;
    canvas.width=raw.width;
    canvas.height=raw.height;
    const context=canvas.getContext("2d")!;
    context.clearRect(0,0,canvas.width,canvas.height);
    context.filter=compare?"none":scannerCanvasFilter(mode,brightness,contrast);
    context.drawImage(raw,0,0);
  },[brightness,compare,contrast,mode]);

  useEffect(()=>{
    let stopped=false;
    const url=URL.createObjectURL(page.image);
    const picture=new Image();
    picture.onload=()=>{
      URL.revokeObjectURL(url);
      if(stopped)return;
      const canvas=document.createElement("canvas");
      canvas.width=picture.naturalWidth;
      canvas.height=picture.naturalHeight;
      canvas.getContext("2d")!.drawImage(picture,0,0);
      source.current=canvas;
      setDimensions({width:canvas.width,height:canvas.height});
      setPoints(insetPoints(canvas.width,canvas.height));
    };
    picture.onerror=()=>{URL.revokeObjectURL(url);setError("Не удалось открыть изображение")};
    picture.src=url;
    return()=>{stopped=true;URL.revokeObjectURL(url);source.current=null};
  },[page.image]);

  useEffect(()=>draw(),[draw,dimensions]);

  const detect=async()=>{
    if(!source.current||detecting)return;
    setDetecting(true);
    setError(null);
    setHint("Ищем границы листа…");
    try{
      const detected=await detectPageCorners(source.current);
      if(detected){
        setPoints(detected);
        setHint("Границы найдены — при необходимости поправьте точки");
      }else{
        setHint("Лист не найден автоматически — расставьте точки вручную");
      }
    }catch{
      setHint("Автопоиск недоступен — расставьте точки вручную");
    }finally{
      setDetecting(false);
    }
  };

  useEffect(()=>{
    if(!dimensions)return;
    const timer=window.setTimeout(()=>void detect(),120);
    return()=>window.clearTimeout(timer);
    // Autodetect should run once for the loaded source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[dimensions]);

  const pointerPosition=(event:ReactPointerEvent<SVGSVGElement>)=>{
    if(!dimensions||!overlay.current)return null;
    const box=overlay.current.getBoundingClientRect();
    return{
      x:Math.max(0,Math.min(dimensions.width,(event.clientX-box.left)/box.width*dimensions.width)),
      y:Math.max(0,Math.min(dimensions.height,(event.clientY-box.top)/box.height*dimensions.height)),
    };
  };

  const move=(event:ReactPointerEvent<SVGSVGElement>)=>{
    if(dragging===null)return;
    const position=pointerPosition(event);
    if(!position)return;
    setPoints(current=>current.map((point,index)=>index===dragging?position:point));
  };

  const startDrag=(event:ReactPointerEvent<SVGCircleElement>,index:number)=>{
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(index);
  };

  const save=async()=>{
    if(!source.current||points.length!==4||saving)return;
    setSaving(true);
    setError(null);
    try{
      const cropped=await perspectiveCrop(source.current,points);
      onSave({image:await toBlob(cropped),mode,brightness,contrast});
    }catch{
      setError("Не удалось применить границы. Поправьте точки и попробуйте снова.");
      setSaving(false);
    }
  };

  const polygon=points.map(point=>`${point.x},${point.y}`).join(" ");
  const mask=dimensions&&points.length===4
    ?`M0 0H${dimensions.width}V${dimensions.height}H0Z M${points[0].x} ${points[0].y} L${points[1].x} ${points[1].y} L${points[2].x} ${points[2].y} L${points[3].x} ${points[3].y}Z`
    :"";

  return <div className={styles.editor}>
    <header>
      <div>
        <span className={styles.eyebrow}>Редактор страницы</span>
        <h2>{tab==="crop"?"Выровняйте лист":"Настройте изображение"}</h2>
        <p>{tab==="crop"?hint:"Изменения сразу видны на странице"}</p>
      </div>
      <button className={styles.close} onClick={onClose} aria-label="Закрыть редактор"><X/></button>
    </header>

    <div className={styles.tabs}>
      <button data-active={tab==="crop"} onClick={()=>setTab("crop")}><Crop/>Границы</button>
      <button data-active={tab==="filters"} onClick={()=>setTab("filters")}><SlidersHorizontal/>Фильтры</button>
    </div>

    <main>
      <section className={styles.stage}>
        {!dimensions?<div className={styles.loading}><Spinner/>Открываем фотографию…</div>:null}
        {dimensions?<div className={styles.canvasFrame} style={{aspectRatio:`${dimensions.width}/${dimensions.height}`}}>
          <canvas ref={preview}/>
          {tab==="crop"?<svg
            ref={overlay}
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            preserveAspectRatio="none"
            onPointerMove={move}
            onPointerUp={()=>setDragging(null)}
            onPointerCancel={()=>setDragging(null)}
          >
            <path className={styles.mask} d={mask} fillRule="evenodd"/>
            <polygon className={styles.polygon} points={polygon}/>
            {points.map((point,index)=><g key={index}>
              <circle className={styles.handleHit} cx={point.x} cy={point.y} r={Math.max(32,dimensions.width*.025)} onPointerDown={event=>startDrag(event,index)}/>
              <circle className={styles.handle} cx={point.x} cy={point.y} r={Math.max(12,dimensions.width*.009)}/>
            </g>)}
          </svg>:null}
        </div>:null}
      </section>

      <aside className={styles.controls}>
        {tab==="crop"?<>
          <div className={styles.controlIntro}>
            <WandSparkles/>
            <div><strong>Четыре угла</strong><span>Тяните оранжевые точки пальцем или мышью</span></div>
          </div>
          <button className={styles.controlButton} disabled={detecting||!dimensions} onClick={()=>void detect()}>
            {detecting?<Spinner size="sm"/>:<Sparkles/>}{detecting?"Ищем лист…":"Найти границы"}
          </button>
          <button className={styles.controlButton} disabled={!dimensions} onClick={()=>dimensions&&setPoints(insetPoints(dimensions.width,dimensions.height))}>
            <RotateCcw/>Сбросить рамку
          </button>
          <div className={styles.tip}><strong>Совет</strong><span>Оставьте небольшой запас вокруг текста — фон будет выровнен при сохранении.</span></div>
        </>:<>
          <div className={styles.presets}>
            {(Object.keys(scannerFilterLabels) as ScannerFilterMode[]).map(value=><button
              key={value}
              data-active={mode===value}
              onClick={()=>setMode(value)}
            >
              <i data-mode={value}/>
              <span>{scannerFilterLabels[value]}</span>
              {mode===value?<Check/>:null}
            </button>)}
          </div>
          <label className={styles.slider}>
            <span><b>Яркость</b><output>{brightness>0?"+":""}{brightness}</output></span>
            <input type="range" min={-40} max={40} value={brightness} onChange={event=>setBrightness(Number(event.target.value))}/>
          </label>
          <label className={styles.slider}>
            <span><b>Контраст</b><output>{contrast>0?"+":""}{contrast}</output></span>
            <input type="range" min={-40} max={60} value={contrast} onChange={event=>setContrast(Number(event.target.value))}/>
          </label>
          <button
            className={styles.compare}
            onPointerDown={()=>setCompare(true)}
            onPointerUp={()=>setCompare(false)}
            onPointerCancel={()=>setCompare(false)}
            onPointerLeave={()=>setCompare(false)}
          ><Eye/>Удерживайте для оригинала</button>
        </>}
      </aside>
    </main>

    {error?<div className={styles.error}>{error}</div>:null}
    <footer>
      <button onClick={onClose}>Отмена</button>
      <button className={styles.primary} disabled={!dimensions||saving} onClick={()=>void save()}>
        {saving?<><Spinner size="sm"/>Применяем…</>:<><Check/>Готово</>}
      </button>
    </footer>
  </div>;
}
