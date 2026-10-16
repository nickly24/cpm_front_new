"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, ChevronRight, LoaderCircle, RotateCcw, Settings2 } from "lucide-react";
import { fetchSectionStudyView, markCardLearned, unmarkCardLearned, updateSectionStudySettings } from "@/lib/training/training-api";
import { CARD_STATUS_LABELS, STUDY_FILTER_LABELS, type SectionKind, type SectionStudyViewResponse, type StudyFilter, type StudySettingsPayload, type TrainingCard, type TrainingSectionNode } from "@/lib/training/training-types";
import { calcProgressPercent } from "@/lib/training/training-utils";
import { BFF_DEV } from "@/lib/config";
import { useContextGuard } from "@/lib/bff/use-context-guard";
import { TrainingSettingsPanel, TrainingWorkspaceDialog } from "./training-workspace-dialog";
import styles from "./training-workspace.module.css";
import { TrainingActionArt } from "./training-action-art";
interface TrainingSectionDetailProps { section:TrainingSectionNode;studentId:number;onBack:()=>void;onStartFlashcards:(batchIndex:number,studyMode:StudyFilter)=>void;onProgressChange?:(section:TrainingSectionNode)=>void }
export function TrainingSectionDetail({section,studentId,onBack,onStartFlashcards,onProgressChange}:TrainingSectionDetailProps) {
 const [data,setData]=useState<SectionStudyViewResponse|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
 const [saving,setSaving]=useState(false),[pending,setPending]=useState<string|null>(null),[mutationError,setMutationError]=useState<string|null>(null);
 const [settingsOpen,setSettingsOpen]=useState(false),[cardsOpen,setCardsOpen]=useState(false),[batchOpen,setBatchOpen]=useState(false);
 const [selected,setSelected]=useState(-1);
 const busy=useRef(false),alive=useRef(true),sequence=useRef(0),request=useRef<AbortController|null>(null);
 const snapshot=useRef(section),progressCallback=useRef(onProgressChange);
 useEffect(()=>{snapshot.current=section;progressCallback.current=onProgressChange;},[section,onProgressChange]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current?.abort();};},[]);
 useContextGuard(BFF_DEV&&(saving||pending!==null));
 const kind=section.kind as SectionKind,ref=section.refId;
 const load=useCallback(async(initial=true)=>{
  const current=++sequence.current;request.current?.abort();const controller=new AbortController();request.current=controller;
  if(initial){setLoading(true);setError(null);}
  try {
   const value=await fetchSectionStudyView(studentId,kind,ref,controller.signal);
   if(!alive.current||controller.signal.aborted||current!==sequence.current)return false;
   setData(value);
   const previous=snapshot.current,next={...previous,stats:value.stats,total_cards:value.stats.total,learned_cards:value.stats.learned,answer_changed_cards:value.stats.answer_changed,progress_percent:value.stats.progress_percent??calcProgressPercent(value.stats.learned,value.stats.total)};
   if(previous.total_cards!==next.total_cards||previous.learned_cards!==next.learned_cards||previous.answer_changed_cards!==next.answer_changed_cards||previous.progress_percent!==next.progress_percent)progressCallback.current?.(next);
   return true;
  } catch(value) {
   if(!alive.current||controller.signal.aborted||current!==sequence.current)return false;
   const message=value instanceof Error?value.message:"Не удалось загрузить карточки";
   if(initial)setError(message);else setMutationError(`Не удалось обновить прогресс. ${message}`);
   return false;
  } finally {if(alive.current&&current===sequence.current&&initial)setLoading(false);}
 },[studentId,kind,ref]);
 useEffect(()=>{void Promise.resolve().then(()=>{if(alive.current)void load();});},[load]);
 const persist=async(patch:StudySettingsPayload)=>{
  if(busy.current||!data)return false;
  busy.current=true;setSaving(true);setMutationError(null);
  try {
   const values={batch_size:patch.batch_size??data.settings.batch_size,study_mode:patch.study_mode??data.settings.study_mode,last_batch_index:patch.last_batch_index??data.settings.last_batch_index??0};
   const result=await updateSectionStudySettings(studentId,kind,ref,values);
   if(!alive.current)return false;
   if(result.success===false)throw new Error(result.error||"Не удалось сохранить настройки");
   const settings=result.settings??values;
   setData(previous=>previous?{...previous,settings:{...settings,last_batch_index:patch.last_batch_index===-1?-1:settings.last_batch_index??0}}:previous);
   if(values.batch_size!==data.settings.batch_size)await load(false);
   return true;
  } catch(value){if(alive.current)setMutationError(value instanceof Error?value.message:"Не удалось сохранить настройки");return false;}
  finally{busy.current=false;if(alive.current)setSaving(false);}
 };
 const toggle=async(card:TrainingCard)=>{
  if(busy.current)return;busy.current=true;setPending(card.card_ref);setMutationError(null);
  try {
   const response=card.status==="learned"?await unmarkCardLearned(studentId,card.card_ref,{kind,ref}):await markCardLearned({student_id:studentId,section_kind:kind,section_ref_id:ref,card_ref:card.card_ref,content_fingerprint:card.content_fingerprint});
   if(!alive.current)return;
   if(response.success===false)throw new Error(response.error||"Не удалось сохранить отметку");
   await load(false);
  } catch(value){if(alive.current){setMutationError(value instanceof Error?value.message:"Не удалось сохранить прогресс");if(typeof value==="object"&&value&&"code" in value&&value.code==="content_changed")await load(false);}}
  finally{busy.current=false;if(alive.current)setPending(null);}
 };
 if(loading)return <div className={styles.loading} role="status"><LoaderCircle size={24}/>Загрузка раздела…</div>;
 if(!data)return <div className={styles.error} role="alert"><p>{error||"Карточки недоступны"}</p><button type="button" onClick={()=>void load()}>Повторить загрузку</button><button type="button" onClick={onBack}>К разделам</button></div>;
 const {cards,batches,stats,settings}=data;
 const current=batches.find(item=>item.index===selected),percent=BFF_DEV?stats.progress_percent??0:calcProgressPercent(stats.learned,stats.total);
 const groups=batches.filter(item=>selected===-1||item.index===selected).map(item=>({...item,cards:cards.slice(item.from-1,item.to)}));
 const count=groups.reduce((sum,item)=>sum+item.cards.length,0);
 const notice=mutationError?<div className={styles.error} role="alert"><p>{mutationError}</p><button type="button" disabled={saving||pending!==null} onClick={()=>{setMutationError(null);void load(false);}}>Обновить данные</button></div>:null;
 return <section className={styles.page} aria-label="Раздел карточек">
  <button className={styles.back} type="button" aria-label="К разделам карточек" onClick={onBack}><ArrowLeft size={23}/></button>
  <header className={styles.intro}><span className={styles.source}>{section.kind==="test"?"Из теста":section.kind==="exam"?"Из экзамена":"Свои карточки"}</span><h1>{section.name}</h1><div className={styles.progressLabel}><span>Прогресс раздела</span><strong>{percent}%</strong></div><div className={styles.track} role="progressbar" aria-label="Прогресс раздела" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{width:`${percent}%`}}/></div></header>
  <div className={styles.workspace}><aside className={styles.stats} aria-label="Прогресс обучения">{[[stats.learned,"Выучено"],[stats.unlearned,"Осталось"],[stats.answer_changed,"Новый ответ"],[stats.total,"Всего"]].map(([value,label])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}</aside>
   <div className={styles.study}><div className={styles.studyHeading}><h2>Обучение</h2><button className={styles.settingsButton} type="button" onClick={()=>{setMutationError(null);setSettingsOpen(true);}}><Settings2 size={18}/><span>Настройки</span></button></div>
    <div className={styles.batchSelect}><span id="training-batch-label">Набор карточек</span><button type="button" aria-labelledby="training-batch-label training-batch-value" aria-haspopup="dialog" aria-expanded={batchOpen} disabled={saving||pending!==null} onClick={()=>setBatchOpen(true)}><span id="training-batch-value">{selected===-1?`Все карточки · ${stats.total}`:`Набор ${selected+1} · ${current?.from}–${current?.to}`}</span><ChevronDown size={18}/></button></div>
    <p className={styles.mode}>{STUDY_FILTER_LABELS[settings.study_mode]} · по {settings.batch_size} карточек</p>
    {current||selected===-1?<button className={`${styles.primary} ${styles.studyAction}`} type="button" disabled={saving||pending!==null} onClick={()=>onStartFlashcards(selected,settings.study_mode)}><TrainingActionArt kind="study"/><span>Учить {selected===-1?"все карточки":"набор"}</span><ChevronRight className={styles.actionArrow} size={18}/></button>:null}
    <button className={styles.openCards} type="button" onClick={()=>setCardsOpen(true)}><TrainingActionArt kind="review"/><span><strong>{selected===-1?"Все карточки раздела":"Карточки выбранного набора"}</strong><small>Карточек: {count} · посмотреть и отметить выученное</small></span><ChevronRight size={20}/></button>
   </div>
  </div>
  {!cardsOpen&&!settingsOpen?notice:null}
  {batchOpen?<TrainingWorkspaceDialog title="Выбрать набор" closeLabel="Закрыть выбор набора" onClose={()=>setBatchOpen(false)}><div className={styles.dialogBody}><div className={styles.batchChoices}>{[{index:-1,label:"Все карточки",description:`Весь раздел · карточек: ${stats.total}`},...batches.map(batch=>({index:batch.index,label:`Набор ${batch.index+1}`,description:`Карточки ${batch.from}–${batch.to}`}))].map(item=><button type="button" key={item.index} aria-pressed={selected===item.index} disabled={saving||pending!==null} onClick={()=>{void persist({last_batch_index:item.index}).then(saved=>{if(saved){setSelected(item.index);setBatchOpen(false);}});}}><span><strong>{item.label}</strong><small>{item.description}</small></span><span className={styles.selectionMark}>{selected===item.index?<Check size={16}/>:null}</span></button>)}</div>{notice}</div></TrainingWorkspaceDialog>:null}
  {settingsOpen?<TrainingSettingsPanel settings={settings} busy={saving||pending!==null} error={mutationError} onClose={()=>setSettingsOpen(false)} onSave={async(size,mode)=>{const next=size!==settings.batch_size?-1:selected;const saved=await persist({batch_size:size,study_mode:mode,last_batch_index:next});if(saved)setSelected(next);return saved;}}/>:null}
  {cardsOpen?<TrainingWorkspaceDialog full title={selected===-1?"Карточки раздела":"Карточки набора"} subtitle={section.name} onClose={()=>setCardsOpen(false)}><div className={styles.dialogBody} data-testid="training-card-scroll">{notice}{groups.map(group=><section className={styles.cardGroup} key={group.index}><h3>Набор {group.index+1} · {group.from}–{group.to}</h3>{group.cards.map(card=><article className={styles.card} key={card.card_ref} data-state={card.status}><div><p className={styles.question}>{card.question}</p><p className={styles.answer}>{card.answer}</p><span className={styles.cardStatus}>{CARD_STATUS_LABELS[card.status]}</span></div><button type="button" className={styles.mark} aria-label={card.status==="learned"?"Пометить как невыученное":"Пометить как выученное"} aria-busy={pending===card.card_ref} disabled={saving||pending!==null} onClick={()=>void toggle(card)}>{pending===card.card_ref?<LoaderCircle size={19}/>:card.status==="learned"?<RotateCcw size={19}/>:<Check size={19}/>}</button></article>)}</section>)}{!count?<p className={styles.mode}>В этом наборе пока нет карточек.</p>:null}</div></TrainingWorkspaceDialog>:null}
 </section>;
}
