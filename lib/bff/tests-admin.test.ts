import { beforeEach, describe, expect, it, vi } from "vitest";
const domain = vi.hoisted(()=>vi.fn());
vi.mock("@/lib/bff/client",()=>({domain,getIdentity:()=>({context_revision:"context",user:{division_id:1001,account_id:17,role:"admin"}})}));
vi.mock("./external-tests",()=>({externalCatalog:()=>Promise.resolve([]),externalResultItems:()=>Promise.resolve([]),externalAdminItem:vi.fn()}));
const test={id:"a".repeat(24),revision:1,title:"Тест",description:"",direction_id:1,direction_name:"Python",owner_division_id:1001,owner_division_name:"Основное",is_owner:true,is_attached:true,is_archived:false,bank_available:false,origin:null,actions:{can_edit_metadata:true,can_edit_settings:true,can_attach:false,can_copy:true,can_detach:false,can_archive:true,can_manage_bank:true},placements:[{division_id:1001,settings:{published:false,start_at:null,end_at:null,time_limit_minutes:0,passing_score:null,answers_visible:false}}],created_at:"2026-10-08T10:00:00Z",updated_at:"2026-10-08T10:00:00Z",question_count:0,content_version_id:"b".repeat(24)};
const payload={title:"Тест",direction:"Python",startDate:"",endDate:"",timeLimitMinutes:30,questions:[],visible:false,published:false};
const ownerDraft={id:"d".repeat(24),revision:1,title:"Черновик",description:"",direction_id:1,questions:[],layout:[],state:"draft",source_test_id:null,published_test_id:null,created_by:17,updated_by:17,created_at:"2026-10-08T10:00:00Z",updated_at:"2026-10-08T10:00:00Z",lock:null};
beforeEach(()=>{vi.resetModules();domain.mockReset();});
describe("administrative tests boundary",()=>{
 it("preserves a pending result as null while preserving a ready zero",async()=>{
  domain.mockImplementation(async(path:string)=>path.startsWith("/core/users")?[]:{items:[{submission_id:"pending",account_id:3,test_id:test.id,calculation_status:"queued",result:null},{submission_id:"zero",account_id:4,test_id:test.id,calculation_status:"ready",result:{score:0}}],total:2});
  const api=await import("./tests-admin");const rows=await api.testsSessions(test.id);
  expect(rows.sessions.map(s=>s.score)).toEqual([null,0]);expect(rows.sessions[0].calculationStatus).toBe("queued");
 });
 it("fetches all owner pages before applying local page numbers",async()=>{
  domain.mockImplementation(async(path:string)=>({items:path.includes("offset=0")?Array.from({length:100},()=>test):[test],total:101}));
  const api=await import("./tests-admin");expect(await api.testsCatalog()).toHaveLength(101);expect(domain.mock.calls[1][0]).toContain("offset=100");
 });
 it("resolves a selected direction once across every catalog page without a stale directions cache",async()=>{
  let selected=1;
  domain.mockImplementation(async(path:string)=>{
   if(path==="/core/directions")return [{id:selected,name:"Python"}];
   expect(path).toContain(`direction_id=${selected}`);expect(path).not.toContain("target_division_id");
   return {items:path.includes("offset=0")?Array.from({length:100},()=>test):[test],total:101};
  });
  const api=await import("./tests-admin");await api.testsCatalog({direction:"Python"});
  expect(domain.mock.calls.filter(([path])=>path==="/core/directions")).toHaveLength(1);
  selected=2;await api.testsCatalog({direction:"Python"});
  expect(domain.mock.calls.filter(([path])=>path==="/core/directions")).toHaveLength(2);
 });
 it("hides superseded calculation statistics until the new official result is ready",async()=>{
  let ready=false;
  domain.mockImplementation(async(path:string)=>path.startsWith("/core/users")?[]:{submission_id:"submission",account_id:3,test_id:test.id,calculation_status:ready?"ready":"queued",result:{score:ready?0:88,earned_points:ready?0:44}});
  const api=await import("./tests-admin");const pending=await api.testsSessionDetail("submission");
  expect(pending.session.score).toBeNull();expect(pending.stats).toBeNull();
  ready=true;const current=await api.testsSessionDetail("submission");
  expect(current.session.score).toBe(0);expect(current.stats).toEqual({accuracy:0,totalPoints:0});
 });
 it("keeps logical create idempotency key on a lost HTTP response",async()=>{
  let firstKey="",tries=0;
  domain.mockImplementation(async(path:string,opts?:RequestInit)=>{
   if(path==="/core/directions")return [{id:1,name:"Python"}];
   if(path==="/tests/catalog"){tries++;const key=(opts!.headers as Record<string,string>)["Idempotency-Key"];if(tries===1){firstKey=key;throw new TypeError("lost response");}expect(key).toBe(firstKey);return test;}
   return {...test,revision:2};
  });
  const api=await import("./tests-admin");await expect(api.testsCreate(payload)).rejects.toThrow("lost response");expect(await api.testsCreate(payload)).toEqual({id:test.id});expect(tries).toBe(2);
 });
 it("continues settings after a partial creation without creating a second test",async()=>{
  let settings=0,creates=0;
  domain.mockImplementation(async(path:string)=>{
   if(path==="/core/directions")return [{id:1,name:"Python"}];
   if(path==="/tests/catalog"){creates++;return test;}
   if(path.endsWith("/settings")){settings++;if(settings===1)throw new Error("temporary");return {...test,revision:2};}
  });
  const api=await import("./tests-admin");await expect(api.testsCreate(payload)).rejects.toThrow("создан скрытым");await api.testsCreate(payload);expect(creates).toBe(1);
 });
 it("sends captured content revision and reports queued calculation rather than fabricated updated results",async()=>{
  domain.mockImplementation(async(path:string,opts?:RequestInit)=>{
   if(path==="/core/directions")return [{id:1,name:"Python"}];
   if(path.endsWith("/content")&&opts){expect(JSON.parse(opts.body as string).expected_revision).toBe(1);return {revision:2,max_question_id:15,questions:[]};}
   if(path.endsWith("/settings")){expect(JSON.parse(opts!.body as string).expected_revision).toBe(2);return {...test,revision:3};}
   return test;
  });
  const api=await import("./tests-admin");const result=await api.testsUpdate(test.id,{...payload,expectedRevision:1});expect(result.revision).toBe(3);expect(result.recalc?.queued).toBe(true);expect(result.recalc?.updated).toBe(0);
 });
 it("serializes draft renewal and save using each acknowledged revision",async()=>{
  domain.mockImplementation(async(path:string,opts?:RequestInit)=>{
   if(path==="/core/directions")return [{id:1,name:"Python"}];
   if(!opts)return ownerDraft;
   const body=JSON.parse(opts.body as string);
   if(path.endsWith("/lock")){expect(body.expected_revision).toBe(1);await new Promise(r=>setTimeout(r,10));return {...ownerDraft,revision:2,lock:{actor_id:17,expires_at:"2026-10-08T12:00:00Z"}};}
   expect(body.expected_revision).toBe(2);return {...ownerDraft,revision:3};
  });
  const api=await import("./tests-admin");const draft=await api.testsDraft(ownerDraft.id);await Promise.all([api.testsDraftLock(draft.id),api.testsDraftUpdate(draft.id,draft)]);
 });
 it("edits only the placement settings for an attached test",async()=>{
  const attached={...test,is_owner:false,actions:{...test.actions,can_edit_metadata:false,can_edit_settings:true}};
  domain.mockImplementation(async(path:string,opts?:RequestInit)=>{
   if(!opts)return attached;
   expect(path).toBe(`/tests/${test.id}/settings`);return {...attached,revision:2};
  });
  const api=await import("./tests-admin");const result=await api.testsUpdate(test.id,{...payload,direction:"ignored",expectedRevision:1});expect(result.revision).toBe(2);expect(domain.mock.calls.some(c=>String(c[0]).includes("/content"))).toBe(false);
 });
 it("interprets publication response as a hidden TestView",async()=>{
  domain.mockImplementation(async(path:string,opts?:RequestInit)=>{
   if(path==="/core/directions")return [{id:1,name:"Python"}];
   if(path.endsWith("/publish")){expect(JSON.parse(opts!.body as string).expected_revision).toBe(1);return test;}
   return ownerDraft;
  });
  const api=await import("./tests-admin");await api.testsDraft(ownerDraft.id);expect(await api.testsDraftPublish(ownerDraft.id)).toEqual({success:true,testId:test.id});
 });
 it("keeps catalogue filters scoped without injecting client division/organization",async()=>{
  domain.mockImplementation(async()=>({items:[],total:0}));
  const api=await import("./tests-admin");await api.testsCatalog({bank:true,relation:"copy",ownerDivisionId:"1002",archived:"true"});const path=domain.mock.calls[0][0] as string;expect(path).toContain("/tests/bank?");expect(path).toContain("owner_division_id=1002");expect(path).not.toContain("target_division_id");expect(path).not.toContain("organization_id");
 });
});
