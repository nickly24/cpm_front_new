/** Boundary between the current React administration screens and the tests owner DTOs. */
import { domain, getIdentity } from "@/lib/bff/client";
import { BFF_EXTERNAL_TESTS_DEV } from "@/lib/config";
import { externalAdminItem, externalCatalog, externalResultItems } from "./external-tests";
import type { AdminTestChangesResponse, AdminTestDetail, AdminTestFormData, AdminTestListItem, AdminTestQuestion, Direction } from "@/lib/admin/admin-tests-types";
import type { AdminTestDraft } from "@/lib/admin/admin-test-drafts-types";
import type { AdminTestUpdateResponse } from "@/lib/admin/admin-tests-api";
import type { AdminListQuery, AdminTestAttemptsListResponse, AdminTestSessionsListResponse } from "@/lib/admin/admin-tests-monitoring-types";
import { testDetailToCanvasState, allocateStableQuestionIds, parseAnswerIdFromCanvasId } from "@/lib/admin/admin-test-canvas-adapter";
import { assertTestTextAnswers } from "@/lib/admin/admin-test-text-answers";

type OwnerQuestion = { question_id: number; type: AdminTestQuestion["type"]; text: string; points: number; answers: {id:string;text:string;is_correct?:boolean}[]; correct_answers?:string[] };
type OwnerSettings = { published: boolean; start_at: string|null; end_at: string|null; time_limit_minutes:number; passing_score:number|null; answers_visible:boolean };
export type TestsActions = {can_edit_metadata:boolean;can_edit_settings:boolean;can_attach:boolean;can_copy:boolean;can_detach:boolean;can_archive:boolean;can_manage_bank:boolean};
export type OwnerTest = {id:string;revision:number;title:string;description:string;direction_id:number;direction_name:string;owner_division_id:number;owner_division_name:string;is_owner:boolean;is_attached:boolean;is_archived:boolean;bank_available:boolean;origin:{test_id:string;source_revision:number;division_id:number}|null;actions:TestsActions;placements:{division_id:number;settings:OwnerSettings}[];created_at:string;updated_at:string;question_count:number;content_version_id:string};
type OwnerContent = {test_id:string;revision:number;title:string;description:string;direction_id:number;questions:OwnerQuestion[];max_question_id:number;used_option_ids:Record<string,string[]>};
type OwnerDraft = {id:string;revision:number;title:string;description:string;direction_id:number;questions:OwnerQuestion[];layout:{question_id:number;x:number;y:number}[];state:string;source_test_id:string|null;published_test_id:string|null;created_by:number;updated_by:number;created_at:string;updated_at:string;lock:{actor_id:number;expires_at:string}|null};
export type OwnerSubmission = {attempt_id:string;submission_id:string;account_id:number;test_id:string;revision:number;submission_status:string;calculation_status:string;calculation_revision:number;accepted_at:string;calculated_at:string|null;calculation_error?:string;result:{score:number;earned_points:number;max_points:number}|null};
type OwnerAttempt = {id:string;revision:number;account_id:number;test_id:string;status:string;started_at:string;answer_deadline:string;completed_at:string|null;questions:OwnerQuestion[];answers:{question_id:number;value:unknown}[];question_order:number[];submission_id:string|null;practice:boolean;server_time:string};
type Page<T> = {items:T[];total:number;limit:number;offset:number};
const tests = new Map<string,OwnerTest>();
const contents = new Map<string,OwnerContent>();
const drafts = new Map<string,OwnerDraft>();
const attempts = new Map<string,OwnerAttempt>();
const submissions = new Map<string,OwnerSubmission>();
const draftRuns = new Map<string,Promise<unknown>>();
const publicationRevisions = new Map<string,number>();
const json = (method:string, body:unknown):RequestInit => ({method,body:JSON.stringify(body)});
const operationKeys=new Map<string,string>();
const partialCreations=new Map<string,OwnerTest>();
function operationScope(path:string,body:unknown) {return `${getIdentity()?.context_revision}:${path}:${JSON.stringify(body)}`;}
async function createDomain<T>(path:string,body:unknown):Promise<T> {
  const scope=operationScope(path,body),key=operationKeys.get(scope)||crypto.randomUUID();operationKeys.set(scope,key);
  const data=await domain<T>(path,{...json("POST",body),headers:{"Idempotency-Key":key}});
  operationKeys.delete(scope);return data;
}
function division() { const id=getIdentity()?.user.division_id; if(!id) throw new Error("Выберите подразделение"); return id; }
function remember(t:OwnerTest) { tests.set(t.id,t);return t; }
export async function allTestsPages<T>(path:string):Promise<T[]> {
  const items:T[]=[];
  for(let offset=0;offset<=100000;offset+=100) {
    const page=await domain<Page<T>>(`${path}${path.includes("?")?"&":"?"}limit=100&offset=${offset}`);
    if(!Array.isArray(page.items)) throw new Error("Некорректный ответ списка");
    items.push(...page.items);
    if(items.length>=page.total) return items;
    if(page.items.length===0) throw new Error("Список изменился. Обновите его.");
  }
  throw new Error("Слишком большой список. Уточните фильтры.");
}
export async function testsDirections():Promise<Direction[]> {
  const rows=await domain<(Direction & {is_active?:boolean|number})[]>("/core/directions");
  return rows.filter(d=>d.is_active!==false&&d.is_active!==0);
}
async function directionId(name:string, allowEmpty=false) {
  if(allowEmpty&&!name.trim())return 0;
  const found=(await testsDirections()).find(d=>d.name===name);
  if(!found)throw new Error("Выберите действующее направление организации");
  return found.id;
}
function legacyQuestion(q:OwnerQuestion):AdminTestQuestion { return {questionId:q.question_id,type:q.type,text:q.text,points:q.points,answers:(q.answers||[]).map(a=>({id:a.id,text:a.text,isCorrect:a.is_correct===true})),correctAnswers:q.correct_answers||[]}; }
function ownerQuestion(q:AdminTestQuestion):OwnerQuestion { return {question_id:q.questionId,type:q.type,text:q.text,points:q.points,answers:q.type==="text"?[]:q.answers.map(a=>({id:a.id,text:a.text,is_correct:a.isCorrect})),correct_answers:q.type==="text"?q.correctAnswers:[]}; }
function currentSettings(t:OwnerTest):OwnerSettings {return t.placements.find(p=>p.division_id===division())?.settings||{published:false,start_at:null,end_at:null,time_limit_minutes:0,passing_score:null,answers_visible:false};}
export function testsListItem(t:OwnerTest):AdminTestListItem {
  const s=currentSettings(t);
  return {id:t.id,title:t.title,startDate:s.start_at,endDate:s.end_at,timeLimitMinutes:s.time_limit_minutes,published:s.published,visible:s.answers_visible,description:t.description,directionName:t.direction_name,ownerDivisionId:t.owner_division_id,ownerDivisionName:t.owner_division_name,isOwner:t.is_owner,isAttached:t.is_attached,isArchived:t.is_archived,bankAvailable:t.bank_available,origin:t.origin,actions:t.actions,revision:t.revision,questionCount:t.question_count};
}
export interface TestsCatalogFilter {bank?:boolean;direction?:string;relation?:string;ownerDivisionId?:string;archived?:string;q?:string}
export interface TestsCatalogPageQuery extends TestsCatalogFilter {
  page?: number;
  limit?: number;
  directionId?: number;
  status?: import("@/lib/admin/admin-tests-types").AdminTestStatusFilter;
  dateFrom?: string;
  dateTo?: string;
  signal?: AbortSignal;
}
export interface TestsCatalogPage {
  items: AdminTestListItem[];
  total: number;
  limit: number;
  offset: number;
  statusCounts: Record<string, number>;
}

/** One server page, including external tests. Never enumerate catalogue pages. */
export async function testsCatalogPage(filter: TestsCatalogPageQuery = {}): Promise<TestsCatalogPage> {
  const page = filter.page ?? 1, limit = filter.limit ?? 6;
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || (page - 1) * limit > 100000) {
    throw new Error("Некорректная страница списка тестов");
  }
  const query = new URLSearchParams({ view: "admin", limit: String(limit), offset: String((page - 1) * limit), include_external: String(BFF_EXTERNAL_TESTS_DEV && !filter.bank) });
  if (filter.directionId) query.set("direction_id", String(filter.directionId));
  else if (filter.direction) query.set("direction_id", String(await directionId(filter.direction)));
  if (filter.q?.trim()) query.set("q", filter.q.trim());
  if (filter.relation && filter.relation !== "all") query.set("relation", filter.relation);
  if (filter.ownerDivisionId) query.set("owner_division_id", filter.ownerDivisionId);
  if (filter.archived) query.set("is_archived", filter.archived);
  if (filter.status && filter.status !== "all") query.set("status", filter.status);
  if (filter.dateFrom) query.set("date_from", filter.dateFrom);
  if (filter.dateTo) query.set("date_to", filter.dateTo);
  type Response = Page<{ test?: OwnerTest; external_test?: Parameters<typeof externalAdminItem>[0] }> & { status_counts: Record<string, number> };
  const data = await domain<Response>(`/tests/${filter.bank ? "bank" : "catalog"}?${query}`, { signal: filter.signal });
  if (!Array.isArray(data.items) || data.items.length > limit || data.limit !== limit || !Number.isSafeInteger(data.total) || data.total < 0 ||
      !Number.isSafeInteger(data.offset) || data.offset < 0 || !data.status_counts || !Number.isSafeInteger(data.status_counts.all) ||
      Object.values(data.status_counts).some(n => !Number.isSafeInteger(n) || n < 0)) {
    throw new Error("Некорректный ответ страницы тестов. Проверьте версию сервера");
  }
  const items = data.items.map(row => {
    if (row.test && !row.external_test) return testsListItem(remember(row.test));
    if (row.external_test && !row.test) return externalAdminItem(row.external_test);
    throw new Error("Некорректная карточка теста");
  });
  return { items, total: data.total, limit: data.limit, offset: data.offset, statusCounts: data.status_counts };
}

export async function testsCatalog(filter:TestsCatalogFilter={}):Promise<AdminTestListItem[]> {
  const query=new URLSearchParams();
  if(filter.direction)query.set("direction_id",String(await directionId(filter.direction)));
  if(filter.q?.trim())query.set("q",filter.q.trim());
  if(filter.relation&&filter.relation!=="all")query.set("relation",filter.relation);
  if(filter.ownerDivisionId)query.set("owner_division_id",filter.ownerDivisionId);
  if(filter.archived&&filter.archived!=="all")query.set("is_archived",filter.archived);
  const [internal, external] = await Promise.all([
    allTestsPages<OwnerTest>(`/tests/${filter.bank?"bank":"catalog"}?${query}`),
    BFF_EXTERNAL_TESTS_DEV && !filter.bank && (!filter.archived || filter.archived === "false" || filter.archived === "all") && (!filter.relation || filter.relation === "all" || filter.relation === "owned") && (!filter.ownerDivisionId || filter.ownerDivisionId === String(division()))
      ? externalCatalog({ directionId: Number(query.get("direction_id")) || undefined, search: filter.q }) : Promise.resolve([]),
  ]);
  return [...internal.map(t=>testsListItem(remember(t))), ...external.map(externalAdminItem)];
}
export async function testsDetail(id:string):Promise<AdminTestDetail> {
  const [t,c]=await Promise.all([domain<OwnerTest>(`/tests/${id}`),domain<OwnerContent>(`/tests/${id}/content`)]);
  remember(t);contents.set(id,c);
  const s=currentSettings(t);
  return {_id:id,title:t.title,description:t.description,direction:t.direction_name,startDate:s.start_at||"",endDate:s.end_at||"",timeLimitMinutes:s.time_limit_minutes,passingScore:s.passing_score,published:s.published,visible:s.answers_visible,questions:c.questions.map(legacyQuestion),createdAt:t.created_at,updatedAt:t.updated_at,expectedRevision:c.revision,maxQuestionId:c.max_question_id,actions:t.actions,isAttached:t.is_attached};
}
function rfcDate(value:string) { if(!value)return null;const date=new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)?`${value}:00+03:00`:value);if(Number.isNaN(date.getTime()))throw new Error("Некорректная дата");return date.toISOString(); }
export async function testsCreate(p:AdminTestFormData) {
  assertTestTextAnswers(p.questions);
  const body={title:p.title,description:p.description||"",direction_id:await directionId(p.direction),questions:p.questions.map(ownerQuestion)};
  const scope=operationScope("/tests/catalog",body);
  const t=partialCreations.get(scope)||remember(await createDomain<OwnerTest>("/tests/catalog",body));partialCreations.set(scope,t);
  try {await testsSaveSettings(t.id,p,t.revision);} catch(err) {throw new Error(`Тест ${t.id} создан скрытым. Настройки подразделения не сохранены: ${err instanceof Error?err.message:"ошибка"}. Повтор сохранения продолжит настройку этого теста.`);}
  partialCreations.delete(scope);return {id:t.id};
}
async function testSnapshot(id:string) { return tests.get(id)||remember(await domain<OwnerTest>(`/tests/${id}`)); }
export async function testsSaveSettings(id:string,p:Partial<AdminTestFormData>,expected?:number) {
  const t=await testSnapshot(id),s=currentSettings(t);
  const body={expected_revision:expected??p.expectedRevision??t.revision,published:p.published??s.published,start_at:p.startDate===undefined?s.start_at:rfcDate(p.startDate),end_at:p.endDate===undefined?s.end_at:rfcDate(p.endDate),time_limit_minutes:p.timeLimitMinutes??s.time_limit_minutes,passing_score:p.passingScore===undefined?s.passing_score:p.passingScore,answers_visible:p.visible??s.answers_visible};
  return remember(await domain<OwnerTest>(`/tests/${id}/settings`,json("PUT",body)));
}
export async function testsUpdate(id:string,p:AdminTestFormData):Promise<AdminTestUpdateResponse> {
  const t=await testSnapshot(id);
  if(!t.actions.can_edit_metadata && !t.actions.can_edit_settings)throw Object.assign(new Error("Недостаточно прав для изменения теста"),{status:403});
  let rev=p.expectedRevision??t.revision;
  if(t.actions.can_edit_metadata) {
    assertTestTextAnswers(p.questions);
    const content=await domain<OwnerContent>(`/tests/${id}/content`,json("PUT",{expected_revision:rev,title:p.title,description:p.description||"",direction_id:await directionId(p.direction),questions:p.questions.map(ownerQuestion)}));
    contents.set(id,content);rev=content.revision;tests.set(id,{...t,revision:rev});p.expectedRevision=rev;
  }
  if(t.actions.can_edit_settings) {
    try {const saved=await testsSaveSettings(id,p,rev);p.expectedRevision=saved.revision;}
    catch(err){throw new Error(`Содержимое сохранено. Настройки подразделения не сохранены: ${err instanceof Error?err.message:"ошибка"}. Обновите тест.`);}
  }
  return {revision:p.expectedRevision,maxQuestionId:contents.get(id)?.max_question_id,message:"Тест сохранён. Расчёт выполняется асинхронно согласно настройке организации.",testId:id,recalc:{updated:0,sessions:0,queued:true}};
}
export async function testsPatch(id:string,p:{published?:boolean;visible?:boolean}) {const saved=await testsSaveSettings(id,p);return {message:"Настройки подразделения сохранены",testId:id,revision:saved.revision};}
export async function testsAction(id:string,action:"attach"|"copy"|"detach"|"archive"|"restore"|"bank-open"|"bank-close",revision?:number) {
  const t=await testSnapshot(id);const rev=revision??t.revision;
  if(action==="detach")return domain(`/tests/${id}/attachment`,json("DELETE",{expected_revision:rev}));
  const isArchive=action==="archive"||action==="restore",isBank=action.startsWith("bank-");
  const route=isArchive?"archive":isBank?"bank":action;
  const body={expected_revision:rev,...(isArchive?{is_archived:action==="archive"}:isBank?{available:action==="bank-open"}:action==="copy"?{title:`${t.title} — копия`}:{})};
  const updated=action==="copy"?await createDomain<OwnerTest>(`/tests/${id}/${route}`,body):await domain<OwnerTest>(`/tests/${id}/${route}`,json(isArchive||isBank?"PUT":"POST",body));
  remember(updated);return updated;
}
function serializeDraft<T>(id:string,fn:()=>Promise<T>):Promise<T> {
  const previous=draftRuns.get(id)||Promise.resolve();const next=previous.catch(()=>{}).then(fn);draftRuns.set(id,next);
  void next.finally(()=>{if(draftRuns.get(id)===next)draftRuns.delete(id);}).catch(()=>{});return next;
}
async function toDraft(d:OwnerDraft):Promise<AdminTestDraft> {
  drafts.set(d.id,d);const dirs=await testsDirections();
  const detail={_id:d.id,title:d.title,description:d.description,direction:dirs.find(x=>x.id===d.direction_id)?.name||"",startDate:"",endDate:"",timeLimitMinutes:30,published:false,visible:false,questions:d.questions.map(legacyQuestion),expectedRevision:d.revision} satisfies AdminTestDetail;
  const draft=testDetailToCanvasState(detail);
  for(const position of d.layout)draft.canvas.layout[`q_${position.question_id}`]={x:position.x,y:position.y};
  return {...draft,description:d.description,expectedRevision:d.revision,state:d.state,status:d.state==="archived"?"archived":"active",createdBy:d.created_by,updatedBy:d.updated_by,createdAt:d.created_at,updatedAt:d.updated_at,publishedTestId:d.published_test_id,lockedBy:d.lock?.actor_id||null,lockedByRole:getIdentity()?.user.role,lockedUntil:d.lock?.expires_at||null};
}
async function draftBody(p:Partial<AdminTestDraft>) {
  const canvas=p.canvas||{questions:[],layout:{}};const nodes=canvas.questions.filter(q=>!q.markedForDeletion);const ids=allocateStableQuestionIds(nodes.map(q=>q.id));
  const questions=nodes.map((q,i)=>({question_id:ids[i],type:q.type,text:q.text,points:q.points,answers:q.type==="text"?[]:q.answers.filter(a=>a.kind==="answer").map(a=>({id:parseAnswerIdFromCanvasId(a.id,q.id),text:a.text,is_correct:a.isCorrect})),correct_answers:q.type==="text"?q.answers.filter(a=>a.kind==="textAnswer").map(a=>a.text):[]}));
  return {title:p.title||"",description:p.description||"",direction_id:await directionId(p.direction||"",true),questions,layout:nodes.map((q,i)=>({question_id:ids[i],x:canvas.layout[q.id]?.x||0,y:canvas.layout[q.id]?.y||0}))};
}
export async function testsDrafts(state="active") {return Promise.all((await allTestsPages<OwnerDraft>(`/tests/drafts?state=${state==="active"?"draft":state}`)).map(toDraft));}
export async function testsDraft(id:string) {return toDraft(await domain<OwnerDraft>(`/tests/drafts/${id}`));}
export async function testsDraftCreate(p:Partial<AdminTestDraft>={}) {return toDraft(await createDomain<OwnerDraft>("/tests/drafts",await draftBody(p)));}
export async function testsDraftFromTest(id:string) {return toDraft(await createDomain<OwnerDraft>(`/tests/${id}/draft`,{}));}
export async function testsDraftLock(id:string) {return serializeDraft(id,async()=>{const prev=drafts.get(id)||await domain<OwnerDraft>(`/tests/drafts/${id}`);return {success:true,draft:await toDraft(await domain<OwnerDraft>(`/tests/drafts/${id}/lock`,json("POST",{expected_revision:prev.revision})))};});}
export async function testsDraftUnlock(id:string) {return serializeDraft(id,async()=>{const prev=drafts.get(id);if(!prev)return {success:true};const d=await domain<OwnerDraft>(`/tests/drafts/${id}/lock`,json("DELETE",{expected_revision:prev.revision}));drafts.set(id,d);return {success:true};});}
export async function testsDraftUpdate(id:string,p:Partial<AdminTestDraft>) {return serializeDraft(id,async()=>{const prev=drafts.get(id);if(!prev)throw new Error("Сначала загрузите черновик");
if(publicationRevisions.has(id)) {
 const body=await draftBody(p),sealed={title:prev.title,description:prev.description,direction_id:prev.direction_id,questions:prev.questions,layout:prev.layout};
 const normalized={...body,title:body.title.trim(),description:body.description.trim(),questions:body.questions.map(q=>({...q,text:q.text.trim(),answers:q.answers.map(a=>({...a,text:a.text.trim()})),correct_answers:q.correct_answers.map(a=>a.trim())}))};
 if(JSON.stringify(normalized)!==JSON.stringify(sealed))throw new Error("Публикация уже принята. Завершите её повтором без изменения черновика.");
 return {...await toDraft(prev),canvas:p.canvas||{questions:[],layout:{}}};
}
const saved=await toDraft(await domain<OwnerDraft>(`/tests/drafts/${id}`,json("PUT",{expected_revision:prev.revision,...await draftBody(p)})));return {...saved,canvas:p.canvas||saved.canvas};});}
export async function testsDraftPublish(id:string) {return serializeDraft(id,async()=>{
 const prev=drafts.get(id);if(!prev)throw new Error("Сначала загрузите черновик");
 assertTestTextAnswers(prev.questions.map(legacyQuestion));
 const sourceRevision=publicationRevisions.get(id)??prev.revision;publicationRevisions.set(id,sourceRevision);
 const published=remember(await domain<OwnerTest>(`/tests/drafts/${id}/publish`,json("POST",{expected_revision:sourceRevision})));
 publicationRevisions.delete(id);return {success:true,testId:published.id};
});}
export async function testsDraftArchive(id:string) {return serializeDraft(id,async()=>{const prev=drafts.get(id)||await domain<OwnerDraft>(`/tests/drafts/${id}`);await domain(`/tests/drafts/${id}`,json("DELETE",{expected_revision:prev.revision}));return {success:true};});}
export async function testsHistory(id:string,filter:{page?:number;limit?:number;questionId?:number;eventType?:string}={}):Promise<AdminTestChangesResponse> {
  type Version={id:string;created_at:string;actor_id:number;change_batch:{actor_role:string;changed_at:string;changes:{kind:string;question_id?:number;before:Record<string,unknown>|null;after:Record<string,unknown>|null}[]}|null};
  const versions=await allTestsPages<Version>(`/tests/${id}/history`);const items=versions.flatMap((v,i)=>(v.change_batch?.changes||[]).map((c,j)=>({id:`${v.id}-${j}`,testId:id,questionId:c.question_id??null,changeKey:`${v.id}-${j}`,eventType:(c.kind==="questions_reordered"?"question_reordered":c.kind) as "question_updated",actor:{userId:v.actor_id,role:v.change_batch?.actor_role,fullName:`Аккаунт ${v.actor_id}`},changedAt:v.created_at,revision:versions.length-i,before:c.before,after:c.after,diff:{fieldChanges:Object.fromEntries(Object.keys(c.after||c.before||{}).filter(k=>JSON.stringify(c.before?.[k])!==JSON.stringify(c.after?.[k])).map(k=>[k,{before:c.before?.[k],after:c.after?.[k]}]))},context:{source:"tests-service"}}))).filter(c=>(filter.questionId===undefined||c.questionId===filter.questionId)&&(!filter.eventType||c.eventType===filter.eventType));
  const page=filter.page||1,limit=filter.limit||20,total=items.length,totalPages=Math.max(1,Math.ceil(total/limit));return {success:true,items:items.slice((page-1)*limit,page*limit),pagination:{page,limit,total,totalPages,hasNext:page<totalPages,hasPrev:page>1}};
}
function pagination(total:number,p:AdminListQuery) {const page=p.page||1,limit=p.limit||10,totalPages=Math.max(1,Math.ceil(total/limit));return {page,limit,total,totalPages,hasNext:page<totalPages,hasPrev:page>1};}
async function accountNames() {
  const names=new Map<number,string>();
  try {for(let offset=0;offset<=100000;offset+=100){const rows=await domain<{account_id:number;full_name:string}[]>(`/core/users?limit=100&offset=${offset}`);rows.forEach(r=>names.set(r.account_id,r.full_name));if(rows.length<100)return names;}throw new Error("Уточните список пользователей");}
  catch(err){if((err as {status?:number}).status!==403)throw err;}return names;
}
export const calculationLabel=(status?:string) => ({queued:"В очереди",processing:"Проверка ответов",retrying:"Повторная проверка",ready:"Готово",failed:"Ошибка проверки"}[status||""]||"Проверка ответов");
export async function testsSessions(id:string,p:AdminListQuery & {calculationStatus?:string}={}):Promise<AdminTestSessionsListResponse> {
  const names=await accountNames(),rows=(await allTestsPages<OwnerSubmission>(`/tests/submissions?test_id=${id}${p.calculationStatus?`&calculation_status=${p.calculationStatus}`:""}`)).map(s=>{submissions.set(s.submission_id,s);return {sessionId:s.submission_id,attemptId:s.attempt_id,studentId:s.account_id,studentFullName:names.get(s.account_id)||`Аккаунт ${s.account_id}`,score:s.calculation_status==="ready"?s.result?.score??null:null,completedAt:s.accepted_at,calculationStatus:s.calculation_status,calculationRevision:s.calculation_revision,revision:s.revision};}).filter(s=>!p.search||s.studentFullName.toLowerCase().includes(p.search.toLowerCase()));const paging=pagination(rows.length,p);return {success:true,testId:id,sessions:rows.slice((paging.page-1)*paging.limit,paging.page*paging.limit),pagination:paging,search:p.search||""};
}
export async function testsAttempts(id:string,p:AdminListQuery & {status?:string}={}):Promise<AdminTestAttemptsListResponse> {
  const names=await accountNames();const rows=(await allTestsPages<OwnerAttempt>(`/tests/attempts?test_id=${id}`)).filter(a=>!p.status||p.status!=="active"||a.status==="in_progress"||a.status==="expired_pending_upload").map(a=>{attempts.set(a.id,a);return {attemptId:a.id,studentId:a.account_id,studentFullName:names.get(a.account_id)||`Аккаунт ${a.account_id}`,testId:a.test_id,status:a.status,startedAt:a.started_at,expiresAt:a.answer_deadline,remainingSeconds:Math.max(0,Math.floor((new Date(a.answer_deadline).getTime()-new Date(a.server_time).getTime())/1000)),timeExpired:a.status==="expired_pending_upload",answeredCount:a.answers.length,totalQuestions:a.questions.length,linkedSessionId:a.submission_id,revision:a.revision};}).filter(a=>!p.search||a.studentFullName.toLowerCase().includes(p.search.toLowerCase()));const paging=pagination(rows.length,p);return {success:true,testId:id,attempts:rows.slice((paging.page-1)*paging.limit,paging.page*paging.limit),pagination:paging,search:p.search||""};
}
export async function testsOverview(id:string) {
  const [stats,active]=await Promise.all([domain<{ready:number;average_score:number|null;accepted:number;queued:number;failed:number}>(`/tests/submissions/stats?test_id=${id}`),allTestsPages<OwnerAttempt>(`/tests/attempts?test_id=${id}`)]);
  return {success:true,testId:id,testTitle:tests.get(id)?.title,analytics:{sessionsCompleted:stats.ready,averageScore:stats.average_score,attemptsInProgress:active.filter(a=>a.status==="in_progress").length,attemptsExpired:active.filter(a=>a.status==="expired_pending_upload").length,attemptsSubmitted:stats.accepted,attemptsActive:active.filter(a=>a.status!=="accepted").length,calculationsQueued:stats.queued,calculationsFailed:stats.failed}};
}
export async function testsAttemptDetail(id:string) {const a=await domain<OwnerAttempt>(`/tests/attempts/${id}`);attempts.set(id,a);const names=await accountNames();return {success:true,studentFullName:names.get(a.account_id)||`Аккаунт ${a.account_id}`,testTitle:tests.get(a.test_id)?.title,attempt:{...a,attemptId:id,answeredCount:a.answers.length,totalQuestions:a.questions.length},items:a.questions.map(q=>{const answer=a.answers.find(x=>x.question_id===q.question_id);return {questionId:q.question_id,question:legacyQuestion(q) as unknown as Record<string,unknown>,studentAnswer:answer?{type:q.type,value:answer.value,selectedAnswer:q.type==="single"?answer.value:undefined,selectedAnswers:Array.isArray(answer.value)?answer.value:typeof answer.value==="string"&&q.type!=="text"?[answer.value]:[],textAnswer:q.type==="text"?answer.value:undefined}:null,answered:!!answer};})};}
export async function testsSessionDetail(id:string) {const s=await domain<OwnerSubmission>(`/tests/submissions/${id}`);submissions.set(id,s);const names=await accountNames();return {success:true,studentFullName:names.get(s.account_id)||`Аккаунт ${s.account_id}`,session:{...s,score:s.calculation_status==="ready"?s.result?.score??null:null,completedAt:s.accepted_at,calculationStatus:s.calculation_status},stats:s.calculation_status==="ready"&&s.result?{accuracy:s.result.score,totalPoints:s.result.earned_points}:null};}
export async function testsResetAttempt(id:string,revision?:number) {const a=attempts.get(id)||await domain<OwnerAttempt>(`/tests/attempts/${id}`);await domain(`/tests/attempts/${id}`,json("DELETE",{expected_revision:revision??a.revision}));return {success:true};}
export async function testsResetSubmission(id:string) {const s=submissions.get(id)||await domain<OwnerSubmission>(`/tests/submissions/${id}`);return testsResetAttempt(s.attempt_id,s.revision);}
export async function testsForceSubmit(id:string) {const s=await domain<OwnerSubmission>(`/tests/attempts/${id}/force-submit`,json("POST",{}));submissions.set(s.submission_id,s);return {success:true,sessionId:s.submission_id,message:"Сдача принята. Проверка ответов выполняется в очереди."};}
export async function testsRetryCalculation(id:string,revision:number) {return domain(`/tests/submissions/${id}/retry-calculation`,json("POST",{expected_revision:revision}));}
export async function testsCalculationHistory(id:string) {const rows=await allTestsPages<{calculation:{calculation_revision:number;score:number;earned_points:number;max_points:number;calculated_at:string}}>(`/tests/submissions/${id}/calculations`);return rows.map(r=>r.calculation);}
export async function testsStudentSessions(accountId:number) {const rows=await allTestsPages<OwnerSubmission>(`/tests/submissions?account_id=${accountId}`);let catalog:AdminTestListItem[]=[];try{catalog=await testsCatalog();}catch(err){if((err as {status?:number}).status!==403)throw err;}return rows.map(s=>({id:s.submission_id,testId:s.test_id,testTitle:catalog.find(t=>t.id===s.test_id)?.title||`Тест ${s.test_id}`,score:s.calculation_status==="ready"?s.result?.score??null:null,completedAt:s.accepted_at,calculationStatus:s.calculation_status}));}
export async function testsSessionStats(id:string) {
 const s=await domain<OwnerSubmission>(`/tests/submissions/${id}`);
 if(s.calculation_status!=="ready"||!s.result)throw new Error(calculationLabel(s.calculation_status));
 const [review,attempt]=await Promise.all([
  domain<{questions:OwnerQuestion[];question_results:{question_id:number;points:number;is_correct:boolean}[]}>(`/tests/submissions/${id}/review`),
  domain<OwnerAttempt>(`/tests/attempts/${s.attempt_id}`),
 ]);
 const questionTypes:Record<string,{count:number;correct:number;points:number}>={};
 for(const q of review.questions){const row=review.question_results.find(r=>r.question_id===q.question_id);const type=questionTypes[q.type]??{count:0,correct:0,points:0};type.count++;if(row?.is_correct)type.correct++;type.points+=row?.points||0;questionTypes[q.type]=type;}
 const elapsed=attempt.completed_at?Math.max(0,Math.round((new Date(attempt.completed_at).getTime()-new Date(attempt.started_at).getTime())/60000)):undefined;
 return {accuracy:s.result.score,totalPoints:s.result.earned_points,totalQuestions:review.question_results.length,correctAnswers:review.question_results.filter(q=>q.is_correct).length,timeSpentMinutes:elapsed,questionTypes};
}

export async function testsResultsStudents() {
  const [rows, external, names] = await Promise.all([allTestsPages<OwnerSubmission>("/tests/submissions"), BFF_EXTERNAL_TESTS_DEV ? externalResultItems() : Promise.resolve([]), accountNames()]);
  for (const { result } of external) if (result?.full_name) names.set(result.account_id, result.full_name);
  const ids=[...new Set([...rows.map(s=>s.account_id), ...external.flatMap(s=>s.result?[s.result.account_id]:[])])];
  return ids.map(id=>({id,account_id:id,full_name:names.get(id)||`Аккаунт ${id}`,class:null,group_id:null}));
}
