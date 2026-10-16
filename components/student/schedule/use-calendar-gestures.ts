"use client";
import { useEffect, type RefObject } from "react";
export function useCalendarGestures(ref:RefObject<HTMLElement|null>, onSwipe:(direction:number)=>void,onZoom:(view:"day"|"month")=>void,disabled=false){
  useEffect(()=>{const element=ref.current;if(!element||disabled)return;let start:{x:number;y:number}|null=null;let distance=0;let pinched=false;let zoomed=false;const gap=(touches:TouchList)=>Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
    const begin=(event:TouchEvent)=>{if(event.touches.length===2){distance=gap(event.touches);pinched=true;zoomed=false;start=null;}else if(event.touches.length===1){start={x:event.touches[0].clientX,y:event.touches[0].clientY};pinched=false;}};
    const move=(event:TouchEvent)=>{if(event.touches.length===2&&distance){if(event.cancelable)event.preventDefault();const ratio=gap(event.touches)/distance;if(!zoomed&&(ratio>1.24||ratio<.8)){zoomed=true;onZoom(ratio>1?"day":"month");}}};
    const end=(event:TouchEvent)=>{if(event.touches.length)return;if(!pinched&&start&&event.changedTouches.length){const dx=event.changedTouches[0].clientX-start.x,dy=event.changedTouches[0].clientY-start.y;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5){if(event.cancelable)event.preventDefault();onSwipe(dx<0?1:-1);}}start=null;distance=0;pinched=false;};
    const cancel=()=>{start=null;distance=0;pinched=false;};
    element.addEventListener("touchstart",begin,{passive:true});element.addEventListener("touchmove",move,{passive:false});element.addEventListener("touchend",end);element.addEventListener("touchcancel",cancel);
    return()=>{element.removeEventListener("touchstart",begin);element.removeEventListener("touchmove",move);element.removeEventListener("touchend",end);element.removeEventListener("touchcancel",cancel);};
  },[ref,onSwipe,onZoom,disabled]);
}
