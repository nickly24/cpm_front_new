"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { examGet, queryString } from "@/lib/exams-v2/api";
import type { Page, StudentResult } from "@/lib/exams-v2/types";
interface Snapshot { pages:Record<number,Page<StudentResult>> }
export function useExamResultsFeed(filters:Record<string,string>,enabled:boolean,initialPage=1,pageSize=6){
  const query=JSON.stringify(filters),key=`${query}:${initialPage}:${pageSize}`;
  const cache=useRef(new Map<string,Snapshot>());
  const request=useRef<AbortController|null>(null);
  const retryMode=useRef<"ensure"|"next"|"previous"|"reload">("ensure");
  const [state,setState]=useState<{key:string;snapshot?:Snapshot;loading:boolean;error:string|null}>({key,loading:true,error:null});
  const load=useCallback(async(mode:"ensure"|"next"|"previous"|"reload"|"retry")=>{
    if(!enabled||request.current)return;
    const action=mode==="retry"?retryMode.current:mode;retryMode.current=action;
    const cached=cache.current.get(key);
    if(action==="ensure"&&cached){setState({key,snapshot:cached,loading:false,error:null});return;}
    const numbers=cached?Object.keys(cached.pages).map(Number):[];const max=Math.max(initialPage,...numbers),min=Math.min(initialPage,...numbers);
    if(action==="next"&&!cached?.pages[max]?.pagination.hasNext)return;
    if(action==="previous"&&min<=1)return;
    const page=action==="next"?max+1:action==="previous"?min-1:initialPage;
    const controller=new AbortController();request.current=controller;setState({key,snapshot:cached,loading:true,error:null});
    try{
      const result=await examGet<Page<StudentResult>>(`/api/student/exams/results${queryString({...JSON.parse(query),page,limit:pageSize})}`,{},controller.signal);
      if(controller.signal.aborted)return;
      const snapshot={pages:{...(action==="reload"?{}:cached?.pages),[page]:result}};
      cache.current.set(key,snapshot);while(cache.current.size>8)cache.current.delete(cache.current.keys().next().value!);
      setState({key,snapshot,loading:false,error:null});
    }catch(error){if(!controller.signal.aborted)setState({key,snapshot:cached,loading:false,error:error instanceof Error?error.message:"Не удалось загрузить результаты"});}
    finally{if(request.current===controller)request.current=null;}
  },[key,query,initialPage,pageSize,enabled]);
  useEffect(()=>{void Promise.resolve().then(()=>load("ensure"));return()=>{request.current?.abort();request.current=null;};},[load]);
  const current=state.key===key?state:null;const pages=current?.snapshot?.pages??{};const numbers=Object.keys(pages).map(Number).sort((a,b)=>a-b);
  const items=numbers.flatMap(page=>pages[page].items);const unique=[...new Map(items.map(item=>[item.examId,item])).values()];
  return {items:unique,loading:current?.loading??true,error:current?.error??null,total:numbers.length?pages[numbers[0]].pagination.total:0,hasPrevious:numbers.length>0&&numbers[0]>1,hasNext:numbers.length>0&&pages[numbers[numbers.length-1]].pagination.hasNext,next:useCallback(()=>void load("next"),[load]),previous:()=>void load("previous"),retry:()=>void load("retry"),reload:useCallback(()=>void load("reload"),[load])};
}
