import {expect,it} from 'vitest';
import {applyConfirmedCell,applyConfirmedCells} from './confirmed-cell';
import type {Entry} from '@/lib/bff/attendance';
import type {AttendanceReportData} from './attendance-report-types';
const report:AttendanceReportData={period:{date_from:'2026-10-01',date_to:'2026-10-31'},class_days:[{id:11,date:'2026-10-20',comment:null}],students:[{student_id:7,full_name:'Synthetic',class:10,group_id:null,group_name:null,school_id:null,school_short_name:null}],entries:[]};
const entry:Entry={id:45,division_id:2,class_day_id:11,account_id:7,group_id:null,full_name:'Synthetic',type:{id:88,division_id:2,version:5,code:'custom',name:'Историческое имя',color:'#abcdef',mark:'И',sort_order:0,is_active:false,counts_as_present:false,counts_as_absent:true,is_excused:true,scan_default:false,zap_default:false},zap_id:null,is_deleted:false,updated_at:'2026-10-20T12:00:00Z'};
const intent={account:7,day:11,type:88};
it('uses the exact committed snapshot even when a current type is archived',()=>{const next=applyConfirmedCell(report,{revision:8,value:entry},7,2,intent);expect(next.entries[0]).toMatchObject({student_id:7,type_name:'Историческое имя',snapshot:{color:'#abcdef',mark:'И'}});expect(report.entries).toHaveLength(0);});
it('rejects responses for another student, day, division or type',()=>{for(const value of [{...entry,account_id:700},{...entry,class_day_id:12},{...entry,division_id:3},{...entry,type:{...entry.type,id:99}},{...entry,id:undefined}])expect(()=>applyConfirmedCell(report,{revision:8,value},7,2,intent)).toThrow();});
it('never accepts an unexpected revision or unconfirmed delete',()=>{expect(()=>applyConfirmedCell(report,{revision:9,value:entry},7,2,intent)).toThrow();expect(()=>applyConfirmedCell(report,{revision:8,value:{}},7,2,{...intent,type:0})).toThrow();});
it('removes only the exact cell after a committed delete',()=>{const before=applyConfirmedCell(report,{revision:8,value:entry},7,2,intent);before.entries.push({...before.entries[0],student_id:8,id:46});const next=applyConfirmedCell(before,{revision:9,value:{deleted:true}},8,2,{...intent,type:0});expect(next.entries.map(e=>e.student_id)).toEqual([8]);expect(before.entries).toHaveLength(2);});

it('applies all canonical batch cells at one revision and rejects incomplete or foreign results',()=>{
 const before={...report,class_days:[...report.class_days,{id:12,date:'2026-10-21',comment:null}]};
 const intents=[intent,{...intent,day:12}],second={...entry,id:46,class_day_id:12};
 const result={revision:8,value:{cells:[entry,second]}};
 expect(applyConfirmedCells(before,result,7,2,intents).entries).toHaveLength(2);expect(before.entries).toHaveLength(0);
 for(const value of [{cells:[entry]},{cells:[entry,entry]},{cells:[entry,{...second,division_id:3}]},{cells:[entry,{...second,is_deleted:true}]}])expect(()=>applyConfirmedCells(before,{revision:8,value},7,2,intents)).toThrow();
 expect(before.entries).toHaveLength(0);
 const marked=applyConfirmedCells(before,result,7,2,intents);
 expect(applyConfirmedCells(marked,{revision:9,value:{cells:[{...entry,is_deleted:true},{...second,is_deleted:true}]}},8,2,intents.map(c=>({...c,type:0}))).entries).toHaveLength(0);
 expect(()=>applyConfirmedCells(marked,{revision:9,value:{cells:[{...entry,id:999,is_deleted:true},{...second,is_deleted:true}]}},8,2,intents.map(c=>({...c,type:0})))).toThrow();
});
