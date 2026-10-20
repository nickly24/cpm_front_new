import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ identity: { user: { account_id: 9, organization_id: 7, division_id: 11 as number | null } }, domain: vi.fn(), blob: vi.fn() }));
vi.mock("./client", () => ({ domain: state.domain, getIdentity: () => state.identity, bffBlobRequest: state.blob }));
import { commitUpload, createUpload, downloadUploadTemplate, uploadExternalTargets, uploadDirections, uploadCanRetry, uploadError, downloadUploadSource, editUpload, pendingUploadCommand, recoverUploadCommand, retryUpload, uploadCatalog, uploadJobs, uploadReportCSV, uploadSession, type UploadJob, type UploadSession, type UploadType } from "./uploads";

const scope = { actor_account_id: 9, organization_id: 7, division_id: 11 }, id = "a".repeat(32), jobId = "b".repeat(32);
const session: UploadSession = { ...scope, id, type: "users.credentials", owner: "core", state: "preview", revision: 2, owner_revision: 1, expires_at: "2099-01-01", created_at: "2026-10-09", file_id: "c".repeat(32) };
const job: UploadJob = { ...scope, id: jobId, session_id: id, type: session.type, owner: "core", status: "queued", attempt: 0, processed: 0, total: 0, created_at: "2026-10-09", authorization: {bound:true,mode:"apply"}, capabilities: { retry_delivery: true, recover_receipt: false, revoke_authorization: true, retry_confirmation: false } };
const type: UploadType = { type: session.type, owner: "core", permission: "users", formats: ["csv"], mode: "owner_session", target_scope: "division", max_bytes: 10000, template: true, create: true, edit: false, commit: true };
let storage: Map<string, string>, sharedStorage: Map<string, string>;
function browserStorage(map: Map<string,string>) { return { get length() { return map.size; }, key: (i: number) => [...map.keys()][i] ?? null, getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => map.set(key, value), removeItem: (key: string) => map.delete(key) }; }
const receiptFor = (pending: NonNullable<ReturnType<typeof pendingUploadCommand>>, resource: string) => ({command_id:pending.id,resource_id:resource,type:pending.type,owner:pending.owner??"core",scope:pending.scope,state:"completed",action:pending.action==="create"?"session.create":`${["commit","edit"].includes(pending.action)?"session":"job"}.${pending.action}:${pending.resource}`});
beforeEach(() => {
  storage = new Map(); sharedStorage = new Map(); state.domain.mockReset(); state.blob.mockReset(); state.identity.user = { account_id: 9, organization_id: 7, division_id: 11 };
  vi.stubGlobal("sessionStorage", browserStorage(storage)); vi.stubGlobal("localStorage", browserStorage(sharedStorage));
  vi.stubGlobal("navigator", { locks: { request: async (_name: string, _options: unknown, callback: (lock: object)=>unknown) => callback({}) } });
});
afterEach(() => vi.unstubAllGlobals());
describe("uploads owner boundary", () => {
  it("requires a selected division and rejects foreign catalog or session data", async () => {
    state.identity.user.division_id = null; await expect(uploadCatalog()).rejects.toThrow("Выберите подразделение"); expect(state.domain).not.toHaveBeenCalled();
    state.identity.user.division_id = 11; state.domain.mockResolvedValueOnce({ scope: { ...scope, actor_account_id: 10 }, types: [] }); await expect(uploadCatalog()).rejects.toThrow("другому кабинету");
    state.domain.mockResolvedValueOnce({ ...session, division_id: 12 }); await expect(uploadSession(id)).rejects.toThrow("другому кабинету");
  });
  it("validates file capability, extension, size and selector fields before any command", async () => {
    const file = new File(["row"], "source.csv");
    await expect(createUpload({ ...type, create: false }, file)).rejects.toThrow("недоступен");
    await expect(createUpload(type, new File(["row"], "source.js"))).rejects.toThrow("Выберите файл");
    await expect(createUpload(type, new File([], "source.csv"))).rejects.toThrow("Файл пуст");
    await expect(createUpload({ ...type, max_bytes: 1 }, file)).rejects.toThrow("превышает");
    await expect(createUpload(type, file, { organization_id: "8" })).rejects.toThrow("параметры");
    expect(state.domain).not.toHaveBeenCalled(); expect(storage.size).toBe(0);
  });
  it("journals identity before multipart and keeps credential rows exclusively in memory", async () => {
    state.domain.mockImplementationOnce(async (_path, options) => {
      expect(pendingUploadCommand()).toMatchObject({ action: "create", type: "users.credentials", scope });
      expect([...storage.values()].join()).not.toContain("SECRET-password");
      expect(options.body).toBeInstanceOf(FormData); expect(options.body.get("type")).toBe(type.type);
      expect(options.body.get("division_id")).toBeNull(); expect(options.headers["Idempotency-Key"]).toBe(pendingUploadCommand()?.id);
      return session;
    });
    expect(await createUpload(type, new File(["full_name,login,password\nStudent,s,SECRET-password"], "source.csv"))).toEqual(session);
    expect(state.domain).toHaveBeenCalledTimes(1); expect(storage.size).toBe(0);
  });
  it("does not repeat an unknown create and resolves only its original receipt", async () => {
    const file = new File(["rows"], "source.csv");
    state.domain.mockRejectedValueOnce(Object.assign(new Error("lost"), { status: 0 }));
    await expect(createUpload(type, file)).rejects.toThrow("lost"); const pending = pendingUploadCommand()!;
    await expect(createUpload(type, file)).rejects.toThrow("предыдущей команды");
    state.domain.mockResolvedValueOnce(receiptFor(pending,id)).mockResolvedValueOnce(session);
    expect(await recoverUploadCommand()).toEqual({ session }); expect(storage.size).toBe(0);
    expect(state.domain.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
    expect(state.domain.mock.calls[1][0]).toBe(`/uploads/receipts/${pending.id}`);
  });
  it("retains unknown create while the owner reference has not been confirmed", async () => {
    state.domain.mockRejectedValueOnce(Object.assign(new Error("unknown"), { status: 503 })); await expect(createUpload(type, new File(["rows"], "source.csv"))).rejects.toThrow();
    const pending = pendingUploadCommand()!;
    state.domain.mockResolvedValueOnce(receiptFor(pending,id)).mockResolvedValueOnce({ ...session, state: "outcome_unknown" });
    await expect(recoverUploadCommand()).rejects.toThrow("ещё не подтверждён"); expect(pendingUploadCommand()?.id).toBe(pending.id);
  });
  it("does not clear an uncertain command on a later access denial or wrong receipt", async () => {
    state.domain.mockRejectedValueOnce(Object.assign(new Error("lost"), { status: 503 })); await expect(commitUpload(session, true)).rejects.toThrow(); const pending = pendingUploadCommand()!;
    state.domain.mockRejectedValueOnce(Object.assign(new Error("denied"), { status: 403 })); await expect(recoverUploadCommand()).rejects.toThrow("denied");
    state.domain.mockResolvedValueOnce({ command_id: pending.id, resource_id: jobId, type: "cards.xlsx", scope }); await expect(recoverUploadCommand()).rejects.toThrow("не соответствует"); expect(pendingUploadCommand()?.id).toBe(pending.id);
  });
  it("sends exactly the coordinator revision and native card edits without fake scope", async () => {
    state.domain.mockResolvedValueOnce(session);
    await editUpload(session, { cards: [{ row: 2, question: "Вопрос", answer: "Первая\nВторая", skip: false }] });
    expect(JSON.parse(state.domain.mock.calls[0][1].body)).toEqual({ expected_revision: 2, owner_payload: { cards: [{ row: 2, question: "Вопрос", answer: "Первая\nВторая", skip: false }] } });
  });
  it("recovers a lost commit into the same job without a second POST", async () => {
    state.domain.mockRejectedValueOnce(Object.assign(new Error("lost"), { status: 503 })); await expect(commitUpload(session, true)).rejects.toThrow(); const pending = pendingUploadCommand()!;
    state.domain.mockResolvedValueOnce(receiptFor(pending,jobId)).mockResolvedValueOnce(job);
    expect(await recoverUploadCommand()).toEqual({ job }); expect(pendingUploadCommand()).toBeNull(); expect(state.domain.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
  });
  it("clears known owner rejection and keeps the same job when explicitly reauthorizing", async () => {
    state.domain.mockRejectedValueOnce(Object.assign(new Error("conflict"), { status: 409, code: "preview_modified" })); await expect(commitUpload(session, true)).rejects.toThrow("изменился"); expect(storage.size).toBe(0);
    state.domain.mockResolvedValueOnce(job).mockImplementationOnce(async()=>receiptFor(pendingUploadCommand()!,jobId)).mockResolvedValueOnce(job); expect(await retryUpload(job)).toEqual(job); expect(state.domain.mock.calls[1][0]).toBe(`/uploads/jobs/${jobId}/retry`);
  });
  it("rejects a cabinet switch during a read and filters no foreign job into the list", async () => {
    state.domain.mockImplementationOnce(async () => { state.identity.user.division_id = 12; return [job]; }); await expect(uploadJobs()).rejects.toThrow("другому кабинету");
    state.identity.user.division_id = 11; state.domain.mockResolvedValueOnce([{ ...job, actor_account_id: 10 }]); await expect(uploadJobs()).rejects.toThrow("другому кабинету");
  });
  it("uses the protected download helper and rejects malformed file IDs", async () => {
    const blob = new Blob(["bytes"]); state.blob.mockResolvedValueOnce(blob); expect(await downloadUploadSource(session)).toBe(blob); expect(state.blob).toHaveBeenCalledWith(`/uploads/files/${session.file_id}/download`);
    await expect(downloadUploadSource({ ...session, file_id: "../escape" })).rejects.toThrow("Недопустимый ID"); expect(state.blob).toHaveBeenCalledTimes(1);
  });
  it("exports only row audit fields, preserving zero and neutralizing spreadsheet formulas", () => {
    const csv = uploadReportCSV({ job_id: jobId, scope, type: type.type, owner: "core", report: { rows: [{ source_row: 0, state: "owner_confirmed", warnings: ["\t=cmd()", 'quote"line'] }], owner_result: { password: "SECRET", token: "TOKEN" } } });
    expect(csv).toContain('"0","Подтверждено"'); expect(csv).toContain("'\t=cmd()"); expect(csv).toContain('quote""line'); expect(csv).not.toContain("SECRET"); expect(csv).not.toContain("TOKEN");
  });
});


describe("actual Uploads owner formats", () => {
  it("creates validated Tests multipart with native OTP metadata and no second parsing", async () => {
    const validated={...type,type:"tests.json",owner:"tests",mode:"validated_input",formats:["json","js"]};
    state.domain.mockResolvedValueOnce({...session,type:validated.type,owner:"tests"});
    await createUpload(validated,new File(["var test = {unmodified: true}"],"export.js"),{direction_id:"19",title:"Импорт",published:"false",visible:"true",timeLimitMinutes:"0"});
    const body=state.domain.mock.calls[0][1].body as FormData;
    expect(body.get("direction_id")).toBe("19");expect(body.get("timeLimitMinutes")).toBe("0");expect(body.get("published")).toBe("false");
    expect(await (body.get("file") as File).text()).toBe("var test = {unmodified: true}");
    expect([...storage.values()].join()).not.toContain("unmodified");
  });
  it("downloads protected CSV and XLSX using real MIME, with a fixed exam target only for Exams", async () => {
    const csv=new Blob(["full_name,login,password"],{type:"text/csv; charset=utf-8"});state.blob.mockResolvedValueOnce(csv);
    expect(await downloadUploadTemplate(type)).toEqual({blob:csv,filename:"users-credentials-template.csv"});
    expect(state.blob.mock.calls[0][0]).toBe("/uploads/templates/users.credentials");
    const xlsx=new Blob(["xlsx"],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});state.blob.mockResolvedValueOnce(xlsx);
    expect(await downloadUploadTemplate({...type,type:"exams.outside"},{targetId:"41"})).toEqual({blob:xlsx,filename:"exams-outside-template.xlsx"});
    expect(state.blob.mock.calls[1][0]).toBe("/uploads/templates/exams.outside?target_id=41");
    await expect(downloadUploadTemplate({...type,type:"exams.questions"})).rejects.toThrow("Выберите экзамен");
    await expect(downloadUploadTemplate(type,{targetId:"41"})).rejects.toThrow("не задаётся");
    expect(state.blob).toHaveBeenCalledTimes(2);
  });
  it("localizes native unsupported templates and rejects wrong MIME or changed scope without saving a blob", async () => {
    state.blob.mockRejectedValueOnce(Object.assign(new Error("owner_template_pending"),{status:501,code:"owner_template_pending"}));
    await expect(downloadUploadTemplate({...type,type:"users.legacy"})).rejects.toThrow("шаблон пока не поддерживается");
    state.blob.mockResolvedValueOnce(new Blob(["json"],{type:"application/json"}));await expect(downloadUploadTemplate(type)).rejects.toThrow("неподдерживаемый формат");
    state.blob.mockImplementationOnce(async()=>{state.identity.user.division_id=12;return new Blob(["csv"],{type:"text/csv"});});
    await expect(downloadUploadTemplate(type)).rejects.toThrow("другому кабинету");
  });
  it("fetches all external targets directly in the current scope without toggling the Tests readiness flag", async () => {
    const items=Array.from({length:100},(_,i)=>({id:i.toString(16).padStart(24,"0"),name:`Test ${i}`,organization_id:7,division_id:11,is_deleted:false}));
    state.domain.mockResolvedValueOnce({items,total:101}).mockResolvedValueOnce({items:[{...items[0],id:"f".repeat(24),name:"Last"}],total:101});
    const values=await uploadExternalTargets();expect(values).toHaveLength(101);expect(values.at(-1)?.name).toBe("Last");
    expect(state.domain.mock.calls.map(call=>call[0])).toEqual(["/tests/external-tests?limit=100&offset=0","/tests/external-tests?limit=100&offset=100"]);
  });
  it("rejects foreign/partial external lists and context changes even for empty lists", async () => {
    state.domain.mockResolvedValueOnce({items:[{id:"a".repeat(24),name:"Other",organization_id:8,division_id:11,is_deleted:false}],total:1});await expect(uploadExternalTargets()).rejects.toThrow("другому кабинету");
    state.domain.mockResolvedValueOnce({items:[],total:1});await expect(uploadExternalTargets()).rejects.toThrow("неполный каталог");
    state.domain.mockImplementationOnce(async()=>{state.identity.user.division_id=12;return {items:[],total:0};});await expect(uploadExternalTargets()).rejects.toThrow("другому кабинету");
  });
  it("does not send revisions from a foreign session or retry a job under another actor", async () => {
    expect(()=>editUpload({...session,division_id:12},{rows:[]})).toThrow("другому кабинету");
    expect(()=>commitUpload({...session,organization_id:8}, true)).toThrow("другому кабинету");
    expect(()=>retryUpload({...job,actor_account_id:10})).toThrow("другому кабинету");expect(state.domain).not.toHaveBeenCalled();
  });
  it("reads Core's complete org direction array without unsupported paging or stale caching", async () => {
    const values=Array.from({length:201},(_,i)=>({id:i+1,name:`Direction ${i}`}));
    state.domain.mockResolvedValueOnce(values).mockResolvedValueOnce([{id:201,name:"Renamed"}]);expect(await uploadDirections()).toEqual(values);
    expect(await uploadDirections()).toEqual([{id:201,name:"Renamed"}]);
    expect(state.domain.mock.calls.map(call=>call[0])).toEqual(["/core/directions","/core/directions"]);
  });
  it("rejects malformed or duplicate native direction IDs without constructing scope overrides", async () => {
    for(const rows of [[{id:1,name:"A"},{id:1,name:"B"}],[{id:0,name:"A"}],[{id:1,name:null}],{items:[]}]){
      state.domain.mockResolvedValueOnce(rows);await expect(uploadDirections()).rejects.toThrow();
    }
    expect(state.domain.mock.calls.every(call=>call[0]==="/core/directions")).toBe(true);
  });
  it("never presents background authorization or expired source as retryable completed application", () => {
    expect(uploadCanRetry({...job,status:"failed"}, {...type,commit:false})).toBe(false);
    expect(uploadCanRetry({...job,status:"awaiting_authorization",error:"background_authorization_pending",capabilities:undefined},type)).toBe(false);
    expect(uploadCanRetry({...job,status:"failed",error:"source_expired",capabilities:undefined},type)).toBe(false);
    expect(uploadCanRetry({...job,status:"retry"},type)).toBe(true);
    expect(uploadError(Object.assign(new Error("background_authorization_pending"),{code:"background_authorization_pending"})).message).toContain("Данные ещё не импортированы");
  });
});


describe("protected owner template capabilities",()=>{
  it("never fetches a pending, missing or inapplicable template capability",async()=>{
    for(const template of [{...type,template:false,template_reason:"pending" as const},{...type,template:undefined},{...type,type:"cards.transform",template:false,template_reason:"not_applicable" as const}]) await expect(downloadUploadTemplate(template)).rejects.toThrow(/шаблон|Шаблон/);
    expect(state.blob).not.toHaveBeenCalled();
  });
  it("downloads exact native Core/Tests templates with pinned direction, format and external target",async()=>{
    const xlsx="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    state.blob.mockResolvedValueOnce(new Blob(["xlsx"],{type:xlsx}));expect((await downloadUploadTemplate({...type,type:"users.legacy"})).filename).toBe("users-legacy-template.xlsx");
    const blob=new Blob([JSON.stringify({native_contract:true})],{type:"application/json"});state.blob.mockResolvedValueOnce(blob);expect(await downloadUploadTemplate({...type,type:"tests.json"},{directionId:19})).toEqual({blob,filename:"tests-json-template.json"});
    expect(state.blob.mock.calls[1][0]).toBe("/uploads/templates/tests.json?direction_id=19&format=cpm_json");
    const source="var test = {}; window.__not_executed = true;";const javascript=new Blob([source],{type:"text/javascript; charset=utf-8"});state.blob.mockResolvedValueOnce(javascript);expect(await downloadUploadTemplate({...type,type:"tests.json"},{directionId:19,format:"online_test_pad"})).toEqual({blob:javascript,filename:"tests-json-template.js"});expect(await javascript.text()).toBe(source);
    state.blob.mockResolvedValueOnce(new Blob(["xlsx"],{type:xlsx}));expect((await downloadUploadTemplate({...type,type:"tests.external-results"},{targetId:"e".repeat(24)})).filename).toBe("tests-external-results-template.xlsx");expect(state.blob.mock.calls[3][0]).toBe(`/uploads/templates/tests.external-results?target_id=${"e".repeat(24)}`);
  });
  it("rejects missing/foreign selectors and mismatched subject/format MIME without a permissive fallback",async()=>{
    await expect(downloadUploadTemplate({...type,type:"tests.json"})).rejects.toThrow("Выберите направление");
    await expect(downloadUploadTemplate({...type,type:"tests.external-results"})).rejects.toThrow("Выберите внешний тест");
    await expect(downloadUploadTemplate(type,{directionId:19})).rejects.toThrow("только для шаблона");
    await expect(downloadUploadTemplate({...type,type:"tests.json"},{directionId:19,format:"invalid" as "cpm_json"})).rejects.toThrow("Недопустимый формат");expect(state.blob).not.toHaveBeenCalled();
    state.blob.mockResolvedValueOnce(new Blob(["not json"],{type:"application/json"}));await expect(downloadUploadTemplate({...type,type:"tests.json"},{directionId:19})).rejects.toThrow("JSON");
    for(const template of [{...type,type:"users.legacy"},{...type,type:"tests.external-results"}]){state.blob.mockResolvedValueOnce(new Blob(["csv"],{type:"text/csv"}));await expect(downloadUploadTemplate(template,template.type === "tests.external-results" ? {targetId:"e".repeat(24)} : {})).rejects.toThrow("неподдерживаемый формат");}
    state.blob.mockResolvedValueOnce(new Blob(["{}"],{type:"application/json"}));await expect(downloadUploadTemplate({...type,type:"tests.json"},{directionId:19,format:"online_test_pad"})).rejects.toThrow("неподдерживаемый формат");
  });
});

it("downloads the Excel question-table template as binary, preserving the selected direction",async()=>{
 const blob=new Blob(["PK workbook"],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});state.blob.mockResolvedValueOnce(blob);
 expect(await downloadUploadTemplate({...type,type:"tests.json",create:false,edit:false,commit:false},{directionId:19,format:"question_table"})).toEqual({blob,filename:"tests-json-template.xlsx"});
 expect(state.blob.mock.calls[0][0]).toBe("/uploads/templates/tests.json?direction_id=19&format=question_table");
 state.blob.mockResolvedValueOnce(new Blob(["{}"],{type:"application/json"}));await expect(downloadUploadTemplate({...type,type:"tests.json"},{directionId:19,format:"question_table"})).rejects.toThrow("неподдерживаемый формат");
});
