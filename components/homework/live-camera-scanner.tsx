"use client";

import { detectPageCorners, perspectiveCrop, type PagePoint } from "@/lib/homework-scanner/opencv-crop";
import { Camera, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./live-camera-scanner.module.css";

export function LiveCameraScanner({ onCapture, onClose }: { onCapture:(blob:Blob)=>void; onClose:()=>void }) {
  const video=useRef<HTMLVideoElement>(null),overlay=useRef<HTMLCanvasElement>(null),busy=useRef(false),previous=useRef<PagePoint[]|null>(null),stable=useRef(0);
  const [hint,setHint]=useState("Наведите камеру на лист");

  const capture=useCallback(async(points=previous.current)=>{
    if(!video.current||busy.current)return;busy.current=true;
    try{
      const source=document.createElement("canvas");source.width=video.current.videoWidth;source.height=video.current.videoHeight;source.getContext("2d")!.drawImage(video.current,0,0);
      const canvas=points?await perspectiveCrop(source,points.map(point=>({x:point.x*source.width,y:point.y*source.height}))):source;
      canvas.toBlob(blob=>{if(blob)onCapture(blob)},"image/jpeg",.9);
    }finally{window.setTimeout(()=>{busy.current=false;stable.current=0},1200)}
  },[onCapture]);

  useEffect(()=>{
    let stream:MediaStream|undefined,stopped=false,timer=0;
    void navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false}).then(value=>{
      stream=value;if(video.current){video.current.srcObject=value;void video.current.play()}
      const scan=async()=>{
        if(stopped||!video.current||!overlay.current)return;
        const source=document.createElement("canvas"),width=640,height=Math.round(width*(video.current.videoHeight/video.current.videoWidth||.75));source.width=width;source.height=height;source.getContext("2d")!.drawImage(video.current,0,0,width,height);
        let points:PagePoint[]|null=null;try{points=await detectPageCorners(source)}catch{}
        const context=overlay.current.getContext("2d")!,box=overlay.current.getBoundingClientRect();overlay.current.width=Math.round(box.width*devicePixelRatio);overlay.current.height=Math.round(box.height*devicePixelRatio);context.scale(devicePixelRatio,devicePixelRatio);context.clearRect(0,0,box.width,box.height);
        if(points){
          const normalized=points.map(point=>({x:point.x/width,y:point.y/height}));context.beginPath();normalized.forEach((point,index)=>{const x=point.x*box.width,y=point.y*box.height;if(index)context.lineTo(x,y);else context.moveTo(x,y)});context.closePath();context.strokeStyle="#22c55e";context.lineWidth=3;context.stroke();
          if(previous.current){const delta=normalized.reduce((sum,point,index)=>sum+Math.hypot(point.x-previous.current![index].x,point.y-previous.current![index].y),0);stable.current=delta<.035?stable.current+1:0}else stable.current=0;
          previous.current=normalized;setHint(stable.current>=2?"Снимок…":"Держите ровно");if(stable.current>=3)void capture(normalized);
        }else{previous.current=null;stable.current=0;setHint("Границы не найдены — снимите вручную")}
        timer=window.setTimeout(scan,450);
      };
      timer=window.setTimeout(scan,700);
    }).catch(()=>setHint("Камера недоступна. Используйте галерею."));
    return()=>{stopped=true;window.clearTimeout(timer);stream?.getTracks().forEach(track=>track.stop())};
  },[capture]);

  return <div className={styles.camera}><video ref={video} playsInline muted/><canvas ref={overlay}/><button className={styles.close} onClick={onClose}><X/></button><div className={styles.controls}><span>{hint}</span><button onClick={()=>void capture()}><Camera/>Снять</button></div></div>;
}
