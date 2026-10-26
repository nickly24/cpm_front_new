import {expect,it} from 'vitest';
import type {UploadSession} from '@/lib/bff/uploads';
import {nativeUploadView,nativeUploadEditPayload} from './admin-uploads-bff-model';
import {uploadPreviewCanCommit} from './admin-uploads-bff-preview';
it('keeps 6000 Excel questions editable and committable without dropping off-page rows',()=>{
 const rows=Array.from({length:6000},(_,i)=>({row:i+2,title:'Большой тест',number:String(i+1),category:'Текстовый ответ',question:`Вопрос ${i+1}`,options:'',answer:'первый\nвторой'}));
 const session={id:'a'.repeat(32),organization_id:11,division_id:17,actor_account_id:1,type:'tests.json',owner:'tests',revision:1,owner_revision:1,state:'preview',expires_at:'2099-01-01T00:00:00Z',created_at:'2026-10-26T00:00:00Z',preview:{state:'preview',source_table:{importFormat:'question_table',metadata:{published:false},rows},preview:{organization_id:11,division_id:17,valid:true,errors:[],warnings:[],summary:{questions_total:6000},preview:{questions:rows.map((_,i)=>({question_id:i+1}))}}}} as unknown as UploadSession;
 expect(nativeUploadView(session)?.valid).toBe(true);
 expect(uploadPreviewCanCommit(session)).toBe(true);
 const payload=nativeUploadEditPayload(session,{'source-5999':{input:{...rows[5999],answer:'новый ответ'},excluded:false}})?.payload as {rows:typeof rows};
 expect(payload.rows).toHaveLength(6000);
 expect(payload.rows[5999].answer).toBe('новый ответ');
 expect(payload.rows[0]).toEqual(rows[0]);
 const wrongScope={...session,division_id:18};
 expect(uploadPreviewCanCommit(wrongScope)).toBe(false);
});
