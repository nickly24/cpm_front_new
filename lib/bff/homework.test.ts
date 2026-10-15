import {beforeEach,describe,expect,it,vi} from "vitest";
const {domain}=vi.hoisted(()=>({domain:vi.fn()}));
vi.mock("./client",()=>({domain,getIdentity:()=>({user:{account_id:9,id:1001,role:"proctor",group_id:1001}})}));
import {allPages,filesHomework,legacyHomework} from "./homework";
beforeEach(()=>{domain.mockReset();});
describe("BFF adapter contract",()=>{
 it("reports cleared grades as unsubmitted instead of zero points",async()=>{
  domain.mockResolvedValue({assignments:[{id:7,type_name:"Custom",deadline:"2020-01-01"}],students:[{account_id:21,full_name:"Student",results:[{assignment_id:7,result:{status:0,result:0}}]}]});
  expect(await legacyHomework("/api/get-ov-homework-table")).toMatchObject({students:[{results:[{result:null,status_text:"Просрочено"}]}]});
 });
 it("uses broker monitoring without inventing a worker heartbeat",async()=>{
  domain.mockResolvedValue({jobs:[],recent_jobs:[],rabbitmq:false,outbox_pending:3});
  expect(await filesHomework("/api/monitoring")).toMatchObject({jobs:[],recent_jobs:[],rabbitmq:false,outbox_pending:3,warnings:["queue_unavailable","runner_unknown","storage_unknown"],delivery:{connected:false,pending:3},worker:{state:"unknown",rabbitmq:null},storage:{state:"unknown"},processing_ready:false});
 });
 it("keeps manual clear success distinct from the cleared business status",async()=>{
  domain.mockResolvedValue({id:2,status:0,result:0});
  expect(await legacyHomework("/api/edit-homework-session",{method:"POST",body:JSON.stringify({homeworkId:7,studentId:21,status:0})})).toMatchObject({status:true,sessionId:2});
 });
 it("keeps every cursor page and fails instead of hiding a broken cursor",async()=>{
  domain.mockResolvedValueOnce({items:[{id:1}],has_more:true,next_cursor:1}).mockResolvedValueOnce({items:[{id:2}],has_more:false,next_cursor:2});
  expect(await allPages("/assignments")).toEqual([{id:1},{id:2}]);expect(domain.mock.calls[1][0]).toContain("after=1");
  domain.mockResolvedValue({items:[],has_more:true,next_cursor:1});await expect(allPages("/assignments")).rejects.toThrow("некорректную страницу");
 });
 it("maps account identity without substituting profile ID",async()=>{
  domain.mockResolvedValue({items:[{id:50,assignment_id:7,account_id:21,reviewer_account_id:9}],has_more:false});
  const value=await filesHomework<{items:{student_id:number;reviewer_id:number;reviewer_role:string}[]}>("/api/review-queue?student_id=21");
  expect(value.items[0]).toMatchObject({student_id:21,reviewer_id:9,reviewer_role:"proctor"});expect(domain.mock.calls[0][0]).toBe("/homework/review-queue?account_id=21");
 });
 it("does not turn an unsubmitted manual row into a completed zero score",async()=>{
  domain.mockResolvedValue({items:[{homework_id:7,homework_name:"A",homework_type:"Custom",deadline:"2026-10-20",result:null,submission_state:"none"}],pagination:{current_page:1,total_pages:1,total_items:1,items_per_page:12},counts:{all:1,undone:1,in_review:0,revision:0,done:0}});
  expect(await legacyHomework("/api/homeworks/student-with-sessions")).toMatchObject({res:[{homework_id:7,result:null,homework_type:"Custom",submission_state:"none"}]});
 });
 it("preserves zero grade and service upload limits",async()=>{
  domain.mockResolvedValue({legacy_result:{status:1,result:0},submission:{state:"graded",reviewer:{account_id:9,role:"proctor"}},limits:{max_source_bytes:12345,max_output_bytes:6789,max_pages:8,dpi:100,jpeg_quality:60}});
  expect(await filesHomework("/api/workspaces/7?student_id=21")).toMatchObject({legacy_result:{result:0},submission:{reviewer:{id:9}},limits:{max_bytes:12345,max_source_bytes:12345,max_output_bytes:6789,max_pages:8,dpi:100,jpeg_quality:60}});
 });
 it("fails closed on unconfigured storage URLs and unconnected legacy routes",async()=>{
  domain.mockResolvedValue({url:"https://example.invalid/file"});await expect(filesHomework("/api/submissions/50/file-url")).rejects.toThrow("адрес хранилища");
  await expect(legacyHomework("/api/telegram-bot")).rejects.toThrow("пока недоступен");
 });
 it("propagates access failure without returning an empty list",async()=>{
  domain.mockRejectedValue(Object.assign(new Error("access_denied"),{status:403}));await expect(legacyHomework("/api/get-homeworks")).rejects.toThrow("access_denied");
 });
 it("loads the entire paginated group for manual homework grading",async()=>{
  const first=Array.from({length:200},(_,i)=>({account_id:i+1,profile_id:i+1001,role:i===0?"proctor":"student",full_name:`Ученик ${i+1}`}));
  domain.mockResolvedValueOnce(first).mockResolvedValueOnce([{account_id:201,profile_id:1201,role:"student",full_name:"Последний ученик"}]);
  const response=await legacyHomework("/api/student-group-filter",{method:"POST",body:JSON.stringify({id:9})}) as {res:{id:number;full_name:string}[]};
  expect(response.res).toHaveLength(200);
  expect(response.res.at(-1)).toEqual({id:201,full_name:"Последний ученик"});
  expect(domain.mock.calls[1][0]).toContain("offset=200");
 });
 it("preserves report class, null and zero grade independently with owner filters",async()=>{
  domain.mockResolvedValue({assignments:[{id:7,name:"A",type_name:"Custom",deadline:"2026-10-20"}],students:[{account_id:21,full_name:"Student",class:10,results:[{assignment_id:7,result:{status:1,result:0}}]},{account_id:22,full_name:"Unknown",class:null,results:[{assignment_id:7,result:null}]}]});
  expect(await legacyHomework("/api/get-ov-homework-table?date_from=2026-10-01&date_to=2026-10-31&group_id=8")).toMatchObject({homeworks:[{type:"Custom"}],students:[{id:21,class:10,results:[{result:0,status_text:"Сдано"}]},{id:22,class:null,results:[{result:null}]}]});
  expect(domain.mock.calls[0][0]).toBe("/homework/report?date_from=2026-10-01&date_to=2026-10-31&group_id=8");
 });
 it("keeps an accepted job snapshot separate from current workspace policy, including unknown job limits",async()=>{
  const limits={max_source_bytes:1048576,max_output_bytes:524288,max_pages:3,dpi:120,jpeg_quality:75};
  domain.mockResolvedValue({submission:{state:"processing"},limits:{...limits,max_pages:9},active_job:{id:"accepted",limits}});
  expect(await filesHomework("/api/workspaces/7")).toMatchObject({limits:{max_pages:9},active_job:{limits:{max_pages:3}}});
  domain.mockResolvedValue({submission:{state:"processing"},limits,active_job:{id:"corrupt",limits:null}});
  expect(await filesHomework("/api/workspaces/7")).toMatchObject({limits:{max_pages:3},active_job:{limits:null}});
 });
 it("does not invent workspace limits from a missing or invalid current owner policy",async()=>{
  domain.mockResolvedValue({submission:{state:"none"},limits:null}); expect(await filesHomework("/api/workspaces/7")).toMatchObject({limits:null});
 });
 it.each(["unknown","stale","error"])("keeps %s worker/storage readiness unavailable despite connected Rabbit",async state=>{
  domain.mockResolvedValue({rabbitmq:true,outbox_pending:0,jobs:[],recent_jobs:[],processing_ready:true,worker:{state,rabbitmq:null,tools:null,processing:null,fresh_instances:0},storage:{state,checked_at:null}});
  expect(await filesHomework("/api/monitoring")).toMatchObject({processing_ready:false,worker:{state},storage:{state}});
 });
 it("reports healthy processing only from the complete native worker and storage observation",async()=>{
  domain.mockResolvedValue({rabbitmq:true,outbox_pending:0,jobs:[],recent_jobs:[],processing_ready:true,worker:{state:"ok",received_at:"2026-10-09T10:00:00Z",rabbitmq:true,tools:true,processing:false,fresh_instances:1},storage:{state:"ok",checked_at:"2026-10-09T10:00:00Z"}});
  expect(await filesHomework("/api/monitoring")).toMatchObject({processing_ready:true,warnings:[],delivery:{connected:true,pending:0}});
 });
});

describe("student server pagination",()=>{
 it("forwards a single bounded page with filters, counts and cancellation",async()=>{
  const controller=new AbortController();
  const pagination={current_page:2,total_pages:4,total_items:32,items_per_page:8};
  const counts={all:32,undone:16,in_review:8,revision:2,done:8};
  domain.mockResolvedValue({items:[{homework_id:9,homework_name:"Page two",homework_type:"Право",deadline:"2026-10-20T00:00:00Z",submission_state:"graded",result:0,has_file:1,has_draft:0}],pagination,counts,has_more:true,next_cursor:999});
  const value=await legacyHomework("/api/homeworks/student-with-sessions?page=2&limit=8&type=Право&status=done&search=Москва",{signal:controller.signal});
  expect(domain).toHaveBeenCalledTimes(1);
  const query=new URL(domain.mock.calls[0][0],"http://local");
  expect(query.pathname).toBe("/homework/assignments");
  expect(Object.fromEntries(query.searchParams)).toEqual({page:"2",limit:"8",status:"done",type:"Право",search:"Москва"});
  expect(domain.mock.calls[0][1].signal).toBe(controller.signal);
  expect(value).toMatchObject({pagination,counts,res:[{homework_id:9,result:0,has_file:true,has_draft:false}]});
 });
 it("does not fall back to collecting all pages when the owner contract is missing",async()=>{
  domain.mockResolvedValue({items:[],has_more:true,next_cursor:12});
  await expect(legacyHomework("/api/homeworks/student-with-sessions?page=1")).rejects.toThrow("пагинацию");
  expect(domain).toHaveBeenCalledTimes(1);
 });
});
