import type { Event } from "@/lib/bff/attendance";
export function isoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
export function civil(iso: string) { const [y,m,d]=iso.split("-").map(Number); return new Date(y,m-1,d,12); }
export function offsetDay(iso: string, days: number) { const date=civil(iso); date.setDate(date.getDate()+days); return isoDate(date); }
export function offsetMonth(iso: string, delta: number) { const date=civil(iso); const day=date.getDate(); date.setDate(1); date.setMonth(date.getMonth()+delta); const end=new Date(date.getFullYear(),date.getMonth()+1,0).getDate(); date.setDate(Math.min(day,end)); return isoDate(date); }
export function monthDays(iso: string) { const first=civil(iso.slice(0,7)+"-01"); const start=offsetDay(isoDate(first),-(first.getDay()+6)%7); return Array.from({length:42},(_,i)=>offsetDay(start,i)); }
export function weekDays(iso: string) { const start=offsetDay(iso,-(civil(iso).getDay()+6)%7); return Array.from({length:7},(_,i)=>offsetDay(start,i)); }
export const minutes=(clock:string)=>Number(clock.slice(0,2))*60+Number(clock.slice(3,5));
export function timelineLayout(events: Event[]) {
  const sorted=[...events].sort((a,b)=>minutes(a.start_time)-minutes(b.start_time)||minutes(a.end_time)-minutes(b.end_time)||a.id-b.id);
  const result: {event:Event;column:number;columns:number}[]=[];
  let cluster: typeof result=[]; let ends:number[]=[]; let maxEnd=-1;
  const finish=()=>{cluster.forEach(item=>item.columns=ends.length);result.push(...cluster);cluster=[];ends=[];};
  for(const event of sorted){const start=minutes(event.start_time),end=minutes(event.end_time);if(start>=maxEnd&&cluster.length)finish();let column=ends.findIndex(value=>value<=start);if(column<0)column=ends.length;ends[column]=end;cluster.push({event,column,columns:1});maxEnd=cluster.length===1?end:Math.max(maxEnd,end);}
  finish();return result;
}
