"use client";

import { Spinner } from "@/components/ui/spinner";
import {
  Eraser,
  MousePointer2,
  PenLine,
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
  const fabricCanvas=useRef<import("fabric").Canvas|null>(null);
  const history=useRef<string[]>([]);
  const cursor=useRef(-1);
  const originalSize=useRef({width:1,height:1});
  const [color,setColor]=useState("#ef4444");
  const [width,setWidth]=useState(4);
  const [tool,setTool]=useState<Tool>("select");
  const [ready,setReady]=useState(false);
  const [saving,setSaving]=useState(false);
  const [historyState,setHistoryState]=useState({index:-1,length:0});

  useEffect(()=>{
    let disposed=false;
    void(async()=>{
      const {Canvas,FabricImage}=await import("fabric");
      if(disposed||!element.current)return;
      const dimensions=await createImageBitmap(image);
      originalSize.current={width:dimensions.width,height:dimensions.height};
      const scale=Math.min(1,1000/dimensions.width,700/dimensions.height);
      const canvasWidth=Math.round(dimensions.width*scale);
      const canvasHeight=Math.round(dimensions.height*scale);
      dimensions.close();
      const canvas=new Canvas(element.current,{
        width:canvasWidth,
        height:canvasHeight,
        backgroundColor:"white",
        preserveObjectStacking:true,
      });
      fabricCanvas.current=canvas;
      const url=URL.createObjectURL(image);
      const picture=await FabricImage.fromURL(url);
      URL.revokeObjectURL(url);
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
      if(!disposed)setReady(true);
    })();
    return()=>{
      disposed=true;
      fabricCanvas.current?.dispose();
      fabricCanvas.current=null;
    };
  },[image]);

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
      left:Math.max(24,canvas.width/2-90),
      top:Math.max(24,canvas.height/2-20),
      fill:color,
      fontSize:28,
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
      left:Math.max(20,canvas.width/2-110),
      top:Math.max(20,canvas.height/2-50),
      width:220,
      height:100,
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
    if(!canvas||index<0||index>=history.current.length)return;
    cursor.current=index;
    await canvas.loadFromJSON(history.current[index]);
    canvas.requestRenderAll();
    setHistoryState({index,length:history.current.length});
  };

  const save=()=>{
    const canvas=fabricCanvas.current;
    if(!canvas||saving)return;
    setSaving(true);
    select();
    canvas.discardActiveObject();
    const regions=canvas.getObjects().filter(object=>
      object.type==="rect"&&object.fill==="rgba(100,116,139,.65)",
    );
    regions.forEach(object=>object.set({visible:false}));
    canvas.requestRenderAll();
    const multiplier=Math.max(
      originalSize.current.width/canvas.getWidth(),
      originalSize.current.height/canvas.getHeight(),
      1,
    );
    const rendered=canvas.toCanvasElement(multiplier);
    const output=document.createElement("canvas");
    output.width=rendered.width;
    output.height=rendered.height;
    const context=output.getContext("2d")!;
    context.drawImage(rendered,0,0);
    for(const object of regions){
      const left=object.left*multiplier;
      const top=object.top*multiplier;
      const regionWidth=object.getScaledWidth()*multiplier;
      const regionHeight=object.getScaledHeight()*multiplier;
      context.save();
      context.filter=`blur(${Math.max(12,14*multiplier)}px)`;
      context.drawImage(rendered,left,top,regionWidth,regionHeight,left,top,regionWidth,regionHeight);
      context.restore();
    }
    regions.forEach(object=>object.set({visible:true}));
    canvas.requestRenderAll();
    output.toBlob(blob=>{
      if(blob)onSave(blob);
      else setSaving(false);
    },"image/jpeg",.92);
  };

  const canUndo=historyState.index>0;
  const canRedo=historyState.index>=0&&historyState.index<historyState.length-1;

  return <div className={styles.editor}>
    <header>
      <div><span>Разметка</span><h2>Добавьте пометки</h2><p>Рисуйте, подписывайте и скрывайте личные данные</p></div>
      <button className={styles.close} onClick={onClose} aria-label="Закрыть"><X/></button>
    </header>
    <div className={styles.editorToolbar}>
      <div className={styles.toolGroup}>
        <button data-active={tool==="select"} disabled={!ready} onClick={select}><MousePointer2/><span>Выбор</span></button>
        <button data-active={tool==="pen"} disabled={!ready} onClick={()=>void drawing("pen")}><PenLine/><span>Перо</span></button>
        <button data-active={tool==="eraser"} disabled={!ready} onClick={()=>void drawing("eraser")}><Eraser/><span>Ластик</span></button>
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
    <div className={styles.editorCanvas}>
      {!ready?<div className={styles.loading}><Spinner/>Загружаем редактор…</div>:null}
      <canvas ref={element}/>
    </div>
    <footer>
      <button disabled={saving} onClick={onClose}>Отмена</button>
      <button disabled={!ready||saving} className={styles.primary} onClick={save}>
        {saving?<><Spinner size="sm"/>Применяем…</>:"Сохранить разметку"}
      </button>
    </footer>
  </div>;
}
