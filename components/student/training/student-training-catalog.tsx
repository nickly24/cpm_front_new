"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cardsCatalogDirections, cardsCatalogPage } from "@/lib/bff/cards";
import { fetchSectionStudyView } from "@/lib/training/training-api";
import { decodeTrainingSegment, trainingBasePath, trainingDirectionPath, trainingSectionPath, trainingStudyPath } from "@/lib/training/training-routes";
import { trainingError } from "@/lib/training/exam-training";
import type { UserRole } from "@/lib/auth/types";
import type { SectionStudyViewResponse, TrainingDirection, TrainingSectionNode } from "@/lib/training/training-types";
import { LoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { TrainingSectionsListView } from "./training-topics-view";
import { TrainingSectionDetail } from "./training-section-detail";
import { TrainingFlashcards } from "./training-flashcards";
import styles from "./student-training.module.css";

export function PaginatedStudentTraining(props:{role:UserRole;pathSegments:string[]}) {
 const {user}=useAuth();
 // Identity/context changes remount every list/detail request and discard its state.
 const scope=user?.context_revision??`${user?.account_id}:${user?.organization_id}:${user?.division_id}:${user?.role}`;
 return <Catalog key={`${scope}:${props.pathSegments.join("/")}`} {...props} studentId={user?.account_id??user?.id??0}/>;
}
function Catalog({role,pathSegments,studentId}:{role:UserRole;pathSegments:string[];studentId:number}) {
 const router=useRouter(),params=useSearchParams();
 const pathKey=pathSegments.join("/");
 const [directions,setDirections]=useState<TrainingDirection[]|null>(null);
 const [view,setView]=useState<SectionStudyViewResponse|null>(null);
 const [error,setError]=useState<string|null>(null);
 const [reload,setReload]=useState(0);
 const explicit=(pathSegments[0]==="manual"||pathSegments[0]==="test")&&pathSegments.length>=2;
 const detail=explicit||pathSegments.length>=2;
 useEffect(()=>{
  const controller=new AbortController();let active=true;
  cardsCatalogDirections(controller.signal).then(value=>{if(active)setDirections(value)},e=>{if(active)setError(trainingError(e))});
  return()=>{active=false;controller.abort()};
 },[reload]);
 useEffect(()=>{
  if(!directions||!detail)return;
  let active=true;const controller=new AbortController();
  const load=async()=>{
   const kind=pathSegments[0] as "manual"|"test",ref=pathSegments[1];
   if(!explicit){
    const direction=directions.find(d=>d.name===decodeTrainingSegment(pathSegments[0]));
    if(!direction)throw new Error("Направление больше недоступно");
    const page=await cardsCatalogPage(direction.id,{search:decodeTrainingSegment(ref),limit:50},controller.signal);
    const section=page.sections.find(s=>s.name===decodeTrainingSegment(ref));
    if(!section)throw new Error("Раздел больше недоступен");
    router.replace(trainingSectionPath(role,direction,section));return;
   }
   const result=await fetchSectionStudyView(studentId,kind,ref,controller.signal);
   if(active)setView(result);
  };
  load().catch(e=>{if(active)setError(trainingError(e))});
  return()=>{active=false;controller.abort()};
 // Route is keyed below; arrays are intentionally compared by their path value.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[directions,detail,explicit,pathKey,reload,role,router,studentId]);
 const goBack=()=>router.push(view?.direction_id?trainingDirectionPath(role,directions?.find(d=>d.id===view.direction_id)??{name:""}):trainingBasePath(role));
 if(detail){
  if(error)return <div><p role="alert">{error}</p><Button onClick={()=>{setError(null);setView(null);setReload(v=>v+1)}}>Повторить загрузку</Button><Button onClick={goBack}>К направлениям</Button></div>;
  if(!view)return <LoadingState label="Загрузка раздела…" variant="panel"/>;
  const section:TrainingSectionNode={kind:view.section_kind,refId:view.section_ref_id,name:view.section_name,stats:view.stats,total_cards:view.stats.total,learned_cards:view.stats.learned,answer_changed_cards:view.stats.answer_changed,progress_percent:view.stats.progress_percent??0};
  const direction=directions?.find(d=>d.id===view.direction_id)??{name:""};
  if(pathSegments[2]==="study"){
   const raw=Number(params.get("batch")??0);const batch=Number.isInteger(raw)&&raw>=-1?raw:0;
   const mode=["all","learned","stale"].includes(params.get("mode")??"")?params.get("mode") as "all"|"learned"|"stale":"unlearned";
   return <TrainingFlashcards key={`${pathKey}:${batch}:${mode}`} section={section} studentId={studentId} batchIndex={batch} studyMode={mode} onBack={()=>router.push(trainingSectionPath(role,direction,section))}/>;
  }
  return <TrainingSectionDetail key={pathKey} section={section} studentId={studentId} onBack={goBack} onStartFlashcards={(batch,mode)=>router.push(trainingStudyPath(role,direction,section,{batch,mode}))} onProgressChange={()=>{}}/>;
 }
 const selected=pathSegments.length?directions?.find(d=>d.name===decodeTrainingSegment(pathSegments[0])):directions?.[0];
 return <div className={styles.page}>
  {error?<div><p role="alert" className={styles.alert}>{error}</p><Button onClick={()=>{setError(null);setReload(v=>v+1)}}>Повторить загрузку</Button></div>:!directions?<LoadingState label="Загрузка направлений…" variant="panel"/>:selected?<TrainingSectionsListView key={selected.id} directions={directions} direction={selected} selectedDirectionId={selected.id} studentId={studentId} loading={false} error={null} onSelectDirection={(id,filters)=>{const next=directions.find(d=>d.id===id);if(next){const query=new URLSearchParams();for(const [key,value] of Object.entries(filters??{}))if(value&&value!=="all")query.set(key,value);router.push(`${trainingDirectionPath(role,next)}${query.size?`?${query}`:""}`);}}} onSelectSection={s=>router.push(trainingSectionPath(role,selected,s))}/>:<p>{directions.length?"Направление больше недоступно":"Пока нет доступных направлений"}</p>}
 </div>;
}
