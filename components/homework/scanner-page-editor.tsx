"use client";

import { Spinner } from "@/components/ui/spinner";
import {
  Eraser,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  Redo2,
  Type,
  Undo2,
  Waves,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./scanner-page-editor.module.css";

type Tool="select"|"pen"|"eraser";

export function ScannerPageEditor({
  image,
  onSave,
  onClose,
}:{
  image:Blob;
  onSave:(blob:Blob)=>void;
  onClose:()=>void;
}){
  const element=useRef<HTMLCanvasElement>(null);
  const stage=useRef<HTMLDivElement>(null);
  const restoring=useRef(false);
  const fabricCanvas=useRef<import("fabric").Canvas|null>(null);
  const history=useRef<string[]>([]);
  const cursor=useRef(-1);
  const originalSize=useRef({width:1,height:1});
  const baseSize=useRef({width:1,height:1});
  const [color,setColor]=useState("#ef4444");
  const [width,setWidth]=useState(4);
  const [tool,setTool]=useState<Tool>("select");
  const [ready,setReady]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [zoom,setZoom]=useState(1);
  const [historyState,setHistoryState]=useState({index:-1,length:0});

  useEffect(()=>{
    let disposed=false;
    let sourceUrl:string|null=null;
    void(async()=>{
      const {Canvas,FabricImage}=await import("fabric");
      if(disposed||!element.current)return;
      const dimensions=await createImageBitmap(image);
      if(disposed){dimensions.close();return;}
      originalSize.current={width:dimensions.width,height:dimensions.height};
      const availableWidth=Math.max(180,(stage.current?.clientWidth??1024)-32);
      const availableHeight=Math.max(180,(stage.current?.clientHeight??724)-32);
      const scale=Math.min(1,1000/dimensions.width,700/dimensions.height,availableWidth/dimensions.width,availableHeight/dimensions.height);
      const canvasWidth=Math.round(dimensions.width*scale);
      const canvasHeight=Math.round(dimensions.height*scale);
      baseSize.current={width:canvasWidth,height:canvasHeight};
      dimensions.close();
      const canvas=new Canvas(element.current,{
        width:canvasWidth,
        height:canvasHeight,
        backgroundColor:"white",
        preserveObjectStacking:true,
      });
      fabricCanvas.current=canvas;
      sourceUrl=URL.createObjectURL(image);
      const picture=await FabricImage.fromURL(sourceUrl);
      if(disposed)return;
      picture.set({
        left:0,
        top:0,
        selectable:false,
        evented:false,
        scaleX:canvas.width/picture.width!,
        scaleY:canvas.height/picture.height!,
      });
      canvas.add(picture);
      canvas.sendObjectToBack(picture);
      const snapshot=()=>{
        if(restoring.current)return;
        const value=JSON.stringify(canvas.toJSON());
        if(history.current[cursor.current]===value)return;
        history.current=history.current.slice(0,cursor.current+1);
        history.current.push(value);
        cursor.current=history.current.length-1;
        setHistoryState({index:cursor.current,length:history.current.length});
      };
      snapshot();
      canvas.on("object:added",snapshot);
      canvas.on("object:modified",snapshot);
      canvas.on("path:created",snapshot);
      canvas.on("text:changed",snapshot);
      if(!disposed)setReady(true);
    })().catch(()=>{if(!disposed)setError("Не удалось открыть разметку. Вернитесь к страницам и попробуйте ещё раз.")});
    return()=>{
      disposed=true;
      if(sourceUrl)URL.revokeObjectURL(sourceUrl);
      fabricCanvas.current?.dispose();
      fabricCanvas.current=null;
    };
  },[image]);

  const changeZoom=(next:number)=>{
    const normalized=Math.max(.75,Math.min(2.5,Number(next.toFixed(2))));
    const canvas=fabricCanvas.current;
    setZoom(normalized);
    if(!canvas)return;
    canvas.setZoom(normalized);
    canvas.setDimensions({
      width:Math.round(baseSize.current.width*normalized),
      height:Math.round(baseSize.current.height*normalized),
    });
    canvas.requestRenderAll();
  };

  const select=()=>{
    const canvas=fabricCanvas.current;
    if(!canvas)return;
    canvas.isDrawingMode=false;
    setTool("select");
  };

  const drawing=async(next:"pen"|"eraser")=>{
    const canvas=fabricCanvas.current;
    if(!canvas)return;
    const {PencilBrush}=await import("fabric");
    canvas.discardActiveObject();
    canvas.isDrawingMode=true;
    const brush=new PencilBrush(canvas);
    brush.color=next==="eraser"?"#ffffff":color;
    brush.width=width;
    canvas.freeDrawingBrush=brush;
    canvas.requestRenderAll();
    setTool(next);
  };

  const changeColor=(value:string)=>{
    setColor(value);
    const brush=fabricCanvas.current?.freeDrawingBrush;
    // Fabric brushes are an imperative API and must be updated in place.
    // eslint-disable-next-line react-hooks/immutability
    if(brush&&tool==="pen")brush.color=value;
  };

  const changeWidth=(value:number)=>{
    setWidth(value);
    const brush=fabricCanvas.current?.freeDrawingBrush;
    // eslint-disable-next-line react-hooks/immutability
    if(brush&&tool!=="select")brush.width=value;
  };

  const addText=async()=>{
    const canvas=fabricCanvas.current;
    if(!canvas)return;
    select();
    const {IText}=await import("fabric");
    const object=new IText("Введите текст",{
      left:Math.max(24,baseSize.current.width/2-90),
      top:Math.max(24,baseSize.current.height/2-20),
      fill:color,
      fontSize:Math.max(12,baseSize.current.width/22),
      fontFamily:"Arial",
    });
    canvas.add(object);
    canvas.setActiveObject(object);
    object.enterEditing();
    object.selectAll();
  };

  const addBlur=async()=>{
    const canvas=fabricCanvas.current;
    if(!canvas)return;
    select();
    const {Rect}=await import("fabric");
    const region=new Rect({
      left:Math.max(20,baseSize.current.width/2-110),
      top:Math.max(20,baseSize.current.height/2-50),
      width:Math.min(220,baseSize.current.width*.6),
      height:Math.min(100,baseSize.current.height*.2),
      fill:"rgba(100,116,139,.65)",
      stroke:"#ff6b00",
      strokeWidth:2,
      strokeDashArray:[7,5],
    });
    canvas.add(region);
    canvas.setActiveObject(region);
  };

  const restore=async(index:number)=>{
    const canvas=fabricCanvas.current;
    if(!canvas||restoring.current||index<0||index>=history.current.length)return;
    restoring.current=true;
    try{
      await canvas.loadFromJSON(history.current[index]);
      canvas.getObjects()[0]?.set({selectable:false,evented:false});
      cursor.current=index;
      canvas.requestRenderAll();
      setHistoryState({index,length:history.current.length});
    }catch{setError("Не удалось отменить изменение. Текущая разметка осталась открыта.")}
    finally{restoring.current=false;}
  };

  const save=()=>{
    const canvas=fabricCanvas.current;
    if(!canvas||saving)return;
    if(cursor.current===0){onClose();return;}
    setSaving(true);
    setError(null);
    select();
    canvas.discardActiveObject();
    const currentZoom=zoom;
    canvas.setZoom(1);
    canvas.setDimensions(baseSize.current);
    const regions=canvas.getObjects().filter(object=>
      object.type==="rect"&&object.fill==="rgba(100,116,139,.65)",
    );
    regions.forEach(object=>object.set({visible:false}));
    canvas.requestRenderAll();
    const multiplier=Math.max(
      originalSize.current.width/baseSize.current.width,
      originalSize.current.height/baseSize.current.height,
      1,
    );
    const rendered=canvas.toCanvasElement(multiplier);
    const output=document.createElement("canvas");
    output.width=originalSize.current.width;
    output.height=originalSize.current.height;
    const context=output.getContext("2d")!;
    context.drawImage(rendered,0,0,output.width,output.height);
    const outputScaleX=output.width/rendered.width,outputScaleY=output.height/rendered.height;
    for(const object of regions){
      const left=object.left*multiplier;
      const top=object.top*multiplier;
      const regionWidth=object.getScaledWidth()*multiplier;
      const regionHeight=object.getScaledHeight()*multiplier;
      context.save();
      context.filter=`blur(${Math.max(12,14*multiplier)}px)`;
      context.drawImage(rendered,left,top,regionWidth,regionHeight,left*outputScaleX,top*outputScaleY,regionWidth*outputScaleX,regionHeight*outputScaleY);
      context.restore();
    }
    regions.forEach(object=>object.set({visible:true}));
    canvas.setZoom(currentZoom);
    canvas.setDimensions({
      width:Math.round(baseSize.current.width*currentZoom),
      height:Math.round(baseSize.current.height*currentZoom),
    });
    canvas.requestRenderAll();
    output.toBlob(blob=>{
      if(blob)onSave(blob);
      else {setSaving(false);setError("Не удалось сохранить разметку. Попробуйте ещё раз.");}
    },"image/jpeg",.92);
  };

  const canUndo=historyState.index>0;
  const canRedo=historyState.index>=0&&historyState.index<historyState.length-1;

  return <div className={styles.editor}>
    <header>
      <div><span>Разметка страницы</span><h2>Добавьте пометки</h2><p>Перо, текст и размытие сохранятся прямо на снимке.</p></div>
      <button className={styles.close} disabled={saving} onClick={onClose} aria-label="Вернуться к страницам без изменений"><X/></button>
    </header>
    <div className={styles.editorToolbar}>
      <div className={styles.toolbarContent}>
        <div className={styles.toolGroup}>
          <button data-active={tool==="select"} disabled={!ready} onClick={select}><MousePointer2/><span>Выбор</span></button>
          <button data-active={tool==="pen"} disabled={!ready} onClick={()=>void drawing("pen")}><PenLine/><span>Перо</span></button>
          <button data-active={tool==="eraser"} disabled={!ready} onClick={()=>void drawing("eraser")}><Eraser/><span>Белая кисть</span></button>
          <button disabled={!ready} onClick={()=>void addText()}><Type/><span>Текст</span></button>
          <button disabled={!ready} onClick={()=>void addBlur()}><Waves/><span>Размыть</span></button>
        </div>
        <div className={styles.options}>
          <label className={styles.color}><span>Цвет</span><input type="color" value={color} onChange={event=>changeColor(event.target.value)}/></label>
          <label className={styles.width}><span>Толщина</span><input aria-label="Толщина" type="range" min={1} max={20} value={width} onChange={event=>changeWidth(Number(event.target.value))}/><output>{width}</output></label>
        </div>
        <div className={styles.history}>
          <button disabled={!ready||!canUndo} onClick={()=>void restore(cursor.current-1)} aria-label="Отменить"><Undo2/></button>
          <button disabled={!ready||!canRedo} onClick={()=>void restore(cursor.current+1)} aria-label="Вернуть"><Redo2/></button>
        </div>
      </div>
    </div>
    <div className={styles.zoomControls}>
        <button onClick={()=>changeZoom(zoom-.25)} aria-label="Уменьшить"><Minus/></button>
        <span>{Math.round(zoom*100)}%</span>
        <button onClick={()=>changeZoom(zoom+.25)} aria-label="Увеличить"><Plus/></button>
      </div>
    <div ref={stage} className={styles.editorCanvas}>
      {!ready?<div className={styles.loading}><Spinner/>Загружаем редактор…</div>:null}

      <canvas ref={element}/>
    </div>
    {error?<div className={styles.error} role="alert">{error}</div>:null}
    <footer>
      <button disabled={saving} onClick={onClose}>Отмена</button>
      <button disabled={!ready||saving} className={styles.primary} onClick={save}>
        {saving?<><Spinner size="sm"/>Применяем…</>:"Сохранить"}
      </button>
    </footer>
  </div>;
}
