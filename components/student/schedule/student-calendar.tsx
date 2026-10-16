"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, SlidersHorizontal, UserRound, Video, X } from "lucide-react";
import { readAttendance, attendanceError, type AvailableCalendar, type Event, type Schedule } from "@/lib/bff/attendance";
import { useAuth } from "@/contexts/AuthContext";
import { useBackdropDismiss } from "@/components/ui/dismissible-overlay";
import { civil, isoDate, minutes, monthDays, offsetDay, offsetMonth, timelineLayout, weekDays } from "./calendar-utils";
import { useCalendarGestures } from "./use-calendar-gestures";
import styles from "./student-calendar.module.css";
const dayLabel=(date:string)=>civil(date).toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"});
const zoneLabel=(zone:string)=>({"Europe/Moscow":"Московское время","Asia/Yekaterinburg":"Екатеринбург · МСК+2","Asia/Novosibirsk":"Новосибирск · МСК+4","Asia/Vladivostok":"Владивосток · МСК+7","UTC":"Всемирное время · UTC"}[zone]??zone);
const monthLabel=(date:string)=>civil(date).toLocaleDateString("ru-RU",{month:"long",year:"numeric"}).replace(" г.","");
function CalendarDialog({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){
  const ref=useRef<HTMLDialogElement>(null);const backdrop=useBackdropDismiss<HTMLDialogElement>(onClose);
  useEffect(()=>{const el=ref.current;const previous=document.body.style.overflow;document.body.style.overflow="hidden";el?.showModal();return()=>{el?.close();document.body.style.overflow=previous;};},[]);
  return <dialog className={styles.dialog} ref={ref} aria-label={title} onCancel={onClose} {...backdrop}><header><h2>{title}</h2><button className={styles.iconButton} type="button" aria-label="Закрыть окно" onClick={onClose}><X size={22}/></button></header>{children}</dialog>;
}
export function StudentCalendar(){
  const { user }=useAuth();
  const [date,setDate]=useState(()=>isoDate(new Date()));
  const [view,setView]=useState<"month"|"day">("month");
  const [mode,setMode]=useState<"personal"|"overlay">("personal");
  const [selected,setSelected]=useState<number[]|null>(null);
  const [schedule,setSchedule]=useState<Schedule|null>(null);
  const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [revision,setRevision]=useState(0);
  const [settings,setSettings]=useState(false);const [activeEvent,setActiveEvent]=useState<Event|null>(null);
  const [now,setNow]=useState(()=>new Date());
  const surface=useRef<HTMLDivElement>(null);const scroller=useRef<HTMLDivElement>(null);
  const days=monthDays(date); const from=days[0],to=days[41];
  const today=isoDate(now);const organization=user?.organization_id;
  const selectedKey=selected?.join(",")??"";
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{const controller=new AbortController();void Promise.resolve().then(async()=>{
    if(controller.signal.aborted)return;setLoading(true);setError("");
    try{
      const index=await readAttendance<AvailableCalendar[]>("/calendars",controller.signal);
      const chosen=(selectedKey?selectedKey.split(",").map(Number):selected===null?index.value.filter(c=>c.is_member).map(c=>c.division_id):[]).filter(id=>index.value.some(c=>c.division_id===id));
      const path=mode==="personal"?"/me/schedule":`/schedule?division_ids=${chosen.join(",")}`;
      const result=mode==="overlay"&&!chosen.length?{value:{organization_id:organization??0,calendars:index.value,events:[],overlap_clusters:[]}}:await readAttendance<Schedule>(`${path}${path.includes("?")?"&":"?"}date_from=${from}&date_to=${to}`,controller.signal);
      if(!controller.signal.aborted)setSchedule(result.value);
    }catch(err){if(!controller.signal.aborted)setError(attendanceError(err));}finally{if(!controller.signal.aborted)setLoading(false);}
  });return()=>controller.abort();},[from,to,mode,selectedKey,selected,organization,revision]);
  const shift=useCallback((direction:number)=>setDate(current=>view==="month"?offsetMonth(current,direction):offsetDay(current,direction)),[view]);
  const zoom=useCallback((next:"day"|"month")=>setView(next),[]);
  useCalendarGestures(surface,shift,zoom,settings||!!activeEvent);
  const currentEvents=(schedule?.events??[]).filter(event=>event.date===date);
  const laidOut=timelineLayout(currentEvents);
  const startHour=Math.max(0,Math.min(8,...currentEvents.map(event=>Math.floor(minutes(event.start_time)/60))));
  const endHour=Math.min(24,Math.max(20,...currentEvents.map(event=>Math.ceil(minutes(event.end_time)/60))));
  useEffect(()=>{if(loading)return;const element=scroller.current;if(!element)return;const frame=requestAnimationFrame(()=>{if(view==="month"){element.scrollTop=0;return;}const first=schedule?.events.filter(event=>event.date===date).sort((a,b)=>a.start_time.localeCompare(b.start_time))[0];const hour=first?minutes(first.start_time)/60:9;element.scrollTop=Math.max(0,(hour-startHour)*76-26);});return()=>cancelAnimationFrame(frame);},[view,date,loading,schedule,startHour]);
  const counts=new Map<string,number>();for(const event of schedule?.events??[])counts.set(event.date,(counts.get(event.date)??0)+1);
  const calendars=schedule?.calendars??[];const chosen=selected??calendars.filter(c=>c.is_member).map(c=>c.division_id);
  const summary=mode==="personal"?"Мои занятия":`Календари · ${chosen.length}`;
  const openDay=(day:string)=>{setDate(day);setView("day");};
  const card=(event:Event)=><button className={styles.agendaCard} type="button" key={event.id} onClick={()=>setActiveEvent(event)}><span className={styles.agendaTime}>{event.start_time.slice(0,5)}<small>{event.end_time.slice(0,5)}</small></span><span className={styles.agendaBody}><small>{event.division_name}</small><strong>{event.lesson_name}</strong><span>{event.is_in_person?`${event.location}${event.classroom?` · ${event.classroom}`:""}`:"Дистанционно"}</span>{event.is_changed?<em>Расписание изменено</em>:null}</span><ChevronRight size={17} aria-hidden/></button>;
  return <section className={styles.page} data-view={view} aria-label="Календарь занятий">
    <div className={styles.topbar}><button className={styles.calendarChoice} type="button" onClick={()=>setSettings(true)} aria-label="Выбрать календари"><SlidersHorizontal size={18}/><span>{summary}</span></button><button type="button" className={styles.today} onClick={()=>{setDate(isoDate(new Date()));setNow(new Date());if(surface.current)surface.current.scrollTop=0;if(scroller.current)scroller.current.scrollTop=view==="month"?0:Math.max(0,(new Date().getHours()+new Date().getMinutes()/60-startHour)*76-50);}}>Сегодня</button></div>
    <div className={styles.calendarSurface} ref={surface}>
      <div className={styles.periodBar}><button className={styles.iconButton} aria-label={view==="month"?"Предыдущий месяц":"Предыдущий день"} onClick={()=>shift(-1)}><ChevronLeft size={23}/></button><button type="button" className={styles.periodTitle} onClick={()=>setView("month")} aria-label="Показать месяц">{monthLabel(date)}</button><button className={styles.iconButton} aria-label={view==="month"?"Следующий месяц":"Следующий день"} onClick={()=>shift(1)}><ChevronRight size={23}/></button></div>
      <div className={styles.viewSwitch} role="group" aria-label="Вид календаря"><button type="button" aria-pressed={view==="month"} onClick={()=>setView("month")}>Месяц</button><button type="button" aria-pressed={view==="day"} onClick={()=>setView("day")}>День</button></div>
      <div className={styles.weekdays} aria-hidden>{["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(day=><span key={day}>{day}</span>)}</div>
      <div className={`${styles.grid} ${view==="day"?styles.weekStrip:""}`} role="group" aria-label={view==="month"?"Дни месяца":"Дни недели"}>{(view==="month"?days:weekDays(date)).map(day=><button type="button" key={day} className={styles.day} data-selected={day===date} data-today={day===today} data-outside={day.slice(0,7)!==date.slice(0,7)} aria-current={day===today?"date":undefined} aria-pressed={day===date} aria-label={`${dayLabel(day)}${day===today?", сегодня":""}, занятий: ${counts.get(day)??0}`} onClick={()=>openDay(day)}><span>{civil(day).getDate()}</span><small className={styles.dots} data-busy={(counts.get(day)??0)>3} aria-hidden>{Array.from({length:(counts.get(day)??0)>3?1:(counts.get(day)??0)},(_,i)=><i key={i}/>)}</small></button>)}</div>
      <div className={styles.scrollArea} ref={scroller} aria-busy={loading}>
        {error?<div role="alert" className={styles.error}>{error}<button onClick={()=>setRevision(n=>n+1)}>Повторить</button></div>:null}
        {loading?<div className={styles.loading} role="status" aria-label="Загрузка расписания"><span/></div>:view==="month"?<div className={styles.agenda}><div className={styles.agendaHeading}><h2>{dayLabel(date)}</h2><span>{currentEvents.length}</span></div>{currentEvents.length?currentEvents.map(card):<div className={styles.empty}><CalendarDays size={29}/><p>На этот день занятий нет</p><span>Выберите другую дату в календаре</span></div>}</div>:<>
          <div className={styles.dayHeading}><h2>{dayLabel(date)}</h2><span>{currentEvents.length?`Занятий: ${currentEvents.length}`:"Занятий нет"}</span></div>
          <div className={styles.timeline} style={{height:(endHour-startHour)*76+36} as CSSProperties}>{Array.from({length:endHour-startHour+1},(_,i)=><div className={styles.hour} style={{top:i*76}} key={i}><time>{String(startHour+i).padStart(2,"0")}:00</time><span/></div>)}
            {laidOut.map(({event,column,columns})=><button type="button" key={event.id} className={styles.lesson} aria-label={`${event.start_time}–${event.end_time}, ${event.lesson_name}, ${event.division_name}`} onClick={()=>setActiveEvent(event)} style={{top:(minutes(event.start_time)-startHour*60)*76/60,height:Math.max(30,(minutes(event.end_time)-minutes(event.start_time))*76/60-3),left:`calc(48px + (100% - 54px) * ${column/columns})`,width:`calc((100% - 54px) / ${columns} - 4px)`} as CSSProperties}><small>{event.start_time.slice(0,5)}–{event.end_time.slice(0,5)}</small><strong>{event.lesson_name}</strong><span>{event.division_name}</span></button>)}
            {date===today&&now.getHours()+now.getMinutes()/60>=startHour&&now.getHours()+now.getMinutes()/60<=endHour?<div className={styles.now} style={{top:(now.getHours()+now.getMinutes()/60-startHour)*76}} aria-label="Текущее время"><time>{now.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</time><span/></div>:null}
          </div></>}
      </div>
    </div>
    {settings?<CalendarDialog title="Календари" onClose={()=>setSettings(false)}><p className={styles.dialogHint}>Собрать личное расписание или выбрать подразделения.</p><div className={styles.settingsModes}><button type="button" aria-pressed={mode==="personal"} onClick={()=>setMode("personal")}>Мои занятия<small>Все мои подразделения, с учётом группы</small></button><button type="button" aria-pressed={mode==="overlay"} onClick={()=>setMode("overlay")}>Выбрать календари<small>Показать занятия выбранных подразделений</small></button></div>{calendars.length?<div className={styles.calendarList}>{calendars.map(calendar=><label key={calendar.division_id}><input type="checkbox" checked={mode==="personal"?calendar.is_member:chosen.includes(calendar.division_id)} disabled={mode==="personal"} onChange={event=>setSelected(event.target.checked?[...chosen,calendar.division_id]:chosen.filter(id=>id!==calendar.division_id))}/><span>{calendar.division_name}<small>{calendar.is_member?"Моё подразделение":"Общий календарь организации"}</small></span></label>)}</div>:<p className={styles.dialogHint}>Доступных календарей пока нет.</p>}<button type="button" className={styles.primary} onClick={()=>setSettings(false)}>Готово</button></CalendarDialog>:null}
    {activeEvent?<CalendarDialog title="Занятие" onClose={()=>setActiveEvent(null)}><p className={styles.eventDivision}>{activeEvent.division_name}</p><h3 className={styles.eventTitle}>{activeEvent.lesson_name}</h3>{activeEvent.is_changed?<p className={styles.changed}>Расписание изменено</p>:null}<div className={styles.eventInfo}><div><CalendarDays size={20}/><span>{dayLabel(activeEvent.date)}</span></div><div><Clock3 size={20}/><span>{activeEvent.start_time.slice(0,5)}–{activeEvent.end_time.slice(0,5)}<small>{zoneLabel(activeEvent.timezone)}</small></span></div>{activeEvent.teacher_name?<div><UserRound size={20}/><span>{activeEvent.teacher_name}</span></div>:null}<div>{activeEvent.is_in_person?<MapPin size={20}/>:<Video size={20}/>}<span>{activeEvent.is_in_person?[activeEvent.location,activeEvent.classroom].filter(Boolean).join(" · "):"Дистанционно"}</span></div></div></CalendarDialog>:null}
  </section>;
}
