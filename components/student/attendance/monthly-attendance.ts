import type { AttendanceType, Day, Entry, Journal } from "@/lib/bff/attendance";
import { civil, isoDate } from "@/components/student/schedule/calendar-utils";
export type AttendanceKind="present"|"excused"|"absent"|"other";
export const attendanceLabels:Record<AttendanceKind,string>={present:"Присутствие",excused:"Уважительная причина",absent:"Без уважительной причины",other:"Другие отметки"};
export const attendanceColors:Record<AttendanceKind,string>={present:"#36b88a",excused:"#629bdb",absent:"#f36d75",other:"#a0a6b2"};
export function attendanceKind(type:AttendanceType):AttendanceKind {
  if(type.counts_as_present)return "present";
  if(type.counts_as_absent)return type.is_excused?"excused":"absent";
  return "other";
}
export function monthRange(date:string){const first=date.slice(0,7)+"-01";const d=civil(first);return {from:first,to:isoDate(new Date(d.getFullYear(),d.getMonth()+1,0,12))};}
export interface AttendanceRow { division:number; day:Day; entry:Entry|undefined }
export interface AttendanceDay { date:string; rows:AttendanceRow[] }
export function monthlyAttendance(journals:Journal[],account:number,from:string,to:string,division:number|null=null){
  const dates=new Map<string,AttendanceRow[]>();
  const counts:Record<AttendanceKind,number>={present:0,excused:0,absent:0,other:0};
  const seen=new Set<string>();let unmarked=0;
  for(const journal of journals){if(division!==null&&journal.division_id!==division)continue;
    const entries=new Map(journal.entries.filter(entry=>entry.account_id===account&&!entry.is_deleted&&entry.division_id===journal.division_id).map(entry=>[entry.class_day_id,entry]));
    for(const day of journal.days){const key=`${journal.division_id}:${day.id}`;if(seen.has(key)||day.date<from||day.date>to)continue;seen.add(key);
      const entry=entries.get(day.id);const rows=dates.get(day.date)??[];rows.push({division:journal.division_id,day,entry});dates.set(day.date,rows);
      if(entry)counts[attendanceKind(entry.type)]++;else unmarked++;
    }
  }
  const total=Object.values(counts).reduce((sum,n)=>sum+n,0);
  const days:AttendanceDay[]=[...dates.entries()].sort(([a],[b])=>b.localeCompare(a)).map(([date,rows])=>({date,rows:rows.sort((a,b)=>a.division-b.division)}));
  return {days,counts,total,unmarked,presentPercent:total?Math.round(counts.present/total*100):null,absentPercent:total?Math.round(counts.absent/total*100):null};
}
