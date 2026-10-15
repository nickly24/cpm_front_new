/* eslint-disable @typescript-eslint/no-explicit-any -- boundary adapter for versioned service and legacy UI DTOs */
import { domain, getIdentity } from "./client";
import type { HomeworkWorkspace } from "@/lib/homework-files/types";
import { homeworkUploadLimits } from "@/lib/homework-files/limits";
import { assertHomeworkStorageURL } from "@/lib/homework-files/storage-url";
type Row = Record<string, any>;
const hw = <T = Row>(path: string, options?: RequestInit) => domain<T>(`/homework/${path}`, options);
const write = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const day = (s: string | null) => s?.slice(0, 10) ?? null;
const assignment = (h: Row) => ({ ...h, type: h.type_name, deadline: day(h.deadline), published: h.published === true || h.published === 1 });
export async function homeworkTypes() { return (await hw<{ items: {id: number; name: string; archived: boolean}[] }>("types")).items; }
export async function allPages(path: string): Promise<Row[]> {
  const url = new URL(path, "http://local"); url.searchParams.set("limit", "200");
  const rows: Row[] = []; let last: number | undefined;
  for (let n = 0; n < 100; n++) {
    const page = await hw(url.pathname.slice(1) + url.search); rows.push(...page.items);
    if (!page.has_more) return rows;
    if (page.next_cursor == null || page.next_cursor === last) throw new Error("Сервис вернул некорректную страницу");
    last = page.next_cursor; url.searchParams.set("after", String(last));
  }
  throw new Error("Слишком большой список. Уточните фильтр.");
}
function paginate(rows: Row[], q: URLSearchParams) {
  const size = Math.max(1, Number(q.get("limit") || 100)); const total = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(total, Math.max(1, Number(q.get("page") || 1)));
  return { status: true, res: rows.slice((page - 1) * size, page * size), pagination: { current_page: page, total_pages: total, total_items: rows.length, items_per_page: size } };
}
function workspace(v: Row): HomeworkWorkspace {
  const limits = homeworkUploadLimits(v.limits);
  return { ...v, submission: { ...v.submission, reviewer: v.submission.reviewer ? { ...v.submission.reviewer, id: v.submission.reviewer.account_id } : null }, limits: limits ? { ...limits, max_bytes: limits.max_source_bytes, poll_after_seconds: 10 } : null } as HomeworkWorkspace;
}
const label = (w: Row) => w.legacy_result?.status === 1 ? "сдано" : ({ submitted: "На проверке", in_review: "На проверке", revision_requested: "На доработке", draft: "Черновик" } as Record<string,string>)[w.submission.state] || "не сдано";
function late(deadline: string | null, stamp?: string | null) {
 if (!deadline) return 0;
 const end=stamp?.slice(0,10) || new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Moscow"});
 return Math.max(0,Math.round((Date.parse(end)-Date.parse(deadline.slice(0,10)))/86400000));
}
async function list(q: URLSearchParams) {
  const rows = await allPages("/assignments");
  const type = q.get("type"), search = (q.get("search") || "").toLowerCase();
  const status=q.get("status");
  return rows.filter(h=>{const hidden=!h.published;const ended=late(h.deadline)>0;return !status||status==="all"||(status==="hidden"?hidden:status==="ended"?!hidden&&ended:!hidden&&!ended);}).filter(h => (!type || type === "all" || h.type_name === type) && h.name.toLowerCase().includes(search));
}
export async function legacyHomework(path: string, options: RequestInit = {}): Promise<unknown> {
  const url = new URL(path, "http://local"), p = url.pathname, q = url.searchParams;
  const body: Row = options.body ? JSON.parse(String(options.body)) : {};
  const method = options.method || "GET";
  if (p === "/api/get-homeworks") return paginate((await list(q)).map(assignment), q);
  if (p === "/api/homeworks/student-with-sessions") {
    const query = new URLSearchParams({ page: q.get("page") || "1", limit: q.get("limit") || "12", status: q.get("status") || "all" });
    for (const key of ["type", "search"]) if (q.get(key)) query.set(key, q.get(key)!);
    const data = await hw(`assignments?${query}`, { signal: options.signal });
    if (!data.pagination || !data.counts) throw new Error("Сервис не вернул пагинацию заданий. Обновите страницу позже.");
    return { status: true, res: data.items.map((h: Row) => ({ ...h, deadline: day(h.deadline), has_file: Boolean(h.has_file), has_draft: Boolean(h.has_draft), status: label({ submission: { state: h.submission_state }, legacy_result: { status: h.result == null ? 0 : 1 } }) })), pagination: data.pagination, counts: data.counts };
  }
  const match = p.match(/^\/api\/homework\/(\d+)(?:\/(overview|students))?$/);
  if (p === "/api/create-homework" || match && method === "PUT") {
    const prev = match ? await hw(`assignments/${match[1]}`) : {};
    const typeName = body.homeworkType ?? body.type ?? prev.type_name;
    const types = await homeworkTypes(); const type = types.find(t => t.name === typeName);
    // Existing archived type can stay; never manufacture or silently rename a type.
    const typeID = type?.id ?? (typeName === prev.type_name ? prev.type_id : undefined);
    if (!typeID) throw new Error("Выберите существующий тип домашней работы этого подразделения");
    const data = await hw(match ? `assignments/${match[1]}` : "assignments", write(match ? "PUT" : "POST", { name: body.homeworkName ?? body.name ?? prev.name, type_id: typeID, deadline: day(body.deadline ?? prev.deadline), published: body.published ?? (prev.published !== undefined ? Boolean(prev.published) : true) }));
    return { status: true, id: data.id, homeworkId: data.id, message: "Сохранено" };
  }
  if (match) {
    const id = match[1];
    if (method === "DELETE") { const data = await hw(`assignments/${id}`, write("DELETE")); return { homeworkId: data.id, message: "Удалено" }; }
    if (!match[2]) return assignment(await hw(`assignments/${id}`));
    const students = await allPages(`/assignments/${id}/students?${new URLSearchParams({search:q.get("search") || "", status:q.get("status") || "all"})}`);
    if (match[2] === "overview") {
      const h = assignment(await hw(`assignments/${id}`)); const done = students.filter(s => s.workspace.legacy_result?.status === 1);
      const overdue = students.filter(s => s.workspace.legacy_result?.status !== 1 && (h.deadline || "9999") < new Date().toLocaleDateString("sv-SE", {timeZone:"Europe/Moscow"})).length;
      return {homework:h,analytics:{totalStudents:students.length,submitted:done.length,inProgress:students.length-done.length-overdue,overdue,averageScore:done.length ? done.reduce((n,s)=>n+s.workspace.legacy_result.result,0)/done.length : null}};
    }
    return paginate(students.map(s => ({student_id:s.account_id,student_name:s.full_name,group_name:s.group_name ?? null,session_id:s.workspace.legacy_result?.id,status:s.workspace.legacy_result?.status ?? 0,result:s.workspace.legacy_result?.result ?? null,date_pass:s.workspace.legacy_result?.date_pass,status_text:label(s.workspace),days_overdue:late(s.workspace.homework.deadline,s.workspace.legacy_result?.date_pass)})),q);
  }
  if (p === "/api/student-group-filter") {
    const rows = await (await import("./core-admin")).coreGroupMembers(Number(body.id));
    return {status:true,res:rows.filter(u=>u.role==="student").map(u=>({id:u.account_id,full_name:u.full_name}))};
  }
  if (p === "/api/get-homework-sessions") {
    const rows = await allPages(`/assignments/${Number(body.homeworkId)}/students`);
    return {status:true,res:rows.map(s=>{const w=s.workspace,r=w.legacy_result;return {id:r?.id??null,status:r?.status??0,result:r?.result??0,homework_id:Number(body.homeworkId),student_id:s.account_id,date_pass:r?.date_pass??null,student_full_name:s.full_name,file_managed:w.submission.state!=="none",file_submission_id:w.submission.id,file_submission_state:w.submission.state};})};
  }
  if (p === "/api/pass_homework" || p === "/api/edit-homework-session") {
    if (!body.studentId || !body.homeworkId) throw new Error("Не указаны аккаунт ученика и задание");
    const data = await hw(`assignments/${body.homeworkId}/manual`,write("POST",{account_id:body.studentId,date_pass:day(body.datePass) ?? "",...(body.result === undefined ? {} : {result:body.result}),...(body.status === undefined ? {} : {status:body.status})}));
    return {...data,status:true,sessionId:data.id};
  }
  if (p === "/api/pass_homework_bulk") {
    const group = getIdentity()?.user.group_id; if (!group) throw new Error("В этом подразделении группа не назначена");
    const data = await hw(`assignments/${body.homeworkId}/manual/bulk`,write("POST",{group_id:group,date_pass:day(body.datePass),...(body.result===undefined?{}:{result:body.result})}));
    return {status:true,...data,total:data.passed+data.skipped+data.errors.length,errors:data.errors.map((e:Row)=>({student_id:e.account_id,error:e.error}))};
  }
  if (p === "/api/get-ov-homework-table") {
    const data = await hw(`report?${q}`);
    return {status:true,homeworks:data.assignments.map((h:Row)=>({...h,deadline:day(h.deadline),type:h.type_name ?? ""})),students:data.students.map((s:Row)=>({id:s.account_id,full_name:s.full_name,class:s.class ?? null,group_name:s.group_name ?? null,results:s.results.map((r:Row)=>({homework_id:r.assignment_id,status:r.result?.status??0,result:r.result?.status===1?r.result.result:null,date_pass:r.result?.date_pass??null,status_text:r.result?.status===1?"Сдано":late(data.assignments.find((h:Row)=>h.id===r.assignment_id)?.deadline)>0?"Просрочено":"Не начато",days_overdue:late(data.assignments.find((h:Row)=>h.id===r.assignment_id)?.deadline,r.result?.date_pass),deadline:day(data.assignments.find((h:Row)=>h.id===r.assignment_id)?.deadline)}))}))};
  }
  throw new Error("Этот раздел пока недоступен");
}
export async function filesHomework<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = new URL(path, "http://local");
  let p = url.pathname.replace(/^\/api\//, "");
  p = p.replace(/^workspaces\/(\d+)$/, "assignments/$1/workspace").replace(/^workspaces\/(\d+)\//, "assignments/$1/");
  for (const [oldKey,newKey] of [["student_id","account_id"],["homework_id","assignment_id"]]) if(url.searchParams.has(oldKey)){url.searchParams.set(newKey,url.searchParams.get(oldKey)!);url.searchParams.delete(oldKey);}
  const data = await hw(p+url.search,options);
  if (p === "monitoring") {
    const current = getIdentity()?.user;
    if ((current?.organization_id && data.organization_id !== current.organization_id) || (current?.division_id && data.division_id !== current.division_id)) throw new Error("Мониторинг относится к другому кабинету. Обновите страницу.");
    const worker = data.worker ?? { state: "unknown", received_at: null, observed_at: null, rabbitmq: null, tools: null, processing: null, fresh_instances: 0 };
    const storage = data.storage ?? { state: "unknown", checked_at: null };
    const broker = typeof data.rabbitmq === "boolean" ? data.rabbitmq : null;
    const warnings = [broker === false ? "queue_unavailable" : broker === null ? "queue_unknown" : null,
      worker.state === "stale" ? "runner_stale" : worker.state === "error" ? "runner_unavailable" : worker.state !== "ok" ? "runner_unknown" : null,
      storage.state === "stale" ? "storage_stale" : storage.state === "error" ? "storage_unavailable" : storage.state !== "ok" ? "storage_unknown" : null].filter(Boolean);
    return {...data, worker, storage, processing_ready: data.processing_ready === true && broker === true && worker.state === "ok" && worker.rabbitmq === true && worker.tools === true && typeof worker.processing === "boolean" && worker.fresh_instances > 0 && storage.state === "ok", warnings, delivery:{connected:broker,pending:data.outbox_pending}} as T;
  }
  if (p.endsWith("/file-url")) assertHomeworkStorageURL(data.url);
  if (p.endsWith("/workspace")) return workspace(data) as T;
  if (p === "review-queue" || p === "archive") return {...data,items:data.items.map((r:Row)=>({...r,student_id:r.account_id,reviewer_id:r.reviewer_account_id,reviewer_role:r.reviewer_account_id===getIdentity()?.user.account_id ? getIdentity()?.user.role : null}))} as T;
  return data as T;
}
