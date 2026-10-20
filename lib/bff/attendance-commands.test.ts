import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttendanceCommandRunner, attendanceCommandJournalKey, ATTENDANCE_JOURNAL_MAX_RECORDS, ATTENDANCE_JOURNAL_MAX_BYTES, type AttendanceCommandMetadata, type AttendanceCommandScope } from "./attendance-commands";
import type { Command } from "./attendance";

const scope:AttendanceCommandScope={account_id:33,organization_id:1,selected_division_id:2};
const key="fb802334-eedb-4b1b-9668-91bb6052b6cd", key2="ab802334-eedb-4b1b-9668-91bb6052b6cd";
const command=():Command=>({key,path:"/divisions/3/class-days/4/scan",method:"POST",revision:5,data:{qr:"PRIVATE_QR",comment:"PERSONAL_DETAIL",nested:{value:"frozen"}}});
const metadata=(c=command()):AttendanceCommandMetadata=>({version:1,...scope,key:c.key,path:c.path,method:c.method as "POST",revision:c.revision});
const committed=(c=command())=>({revision:6,value:{contract_version:1,command_id:c.key,state:"committed",organization_id:1,scope:"division",division_ids:[3],method:c.method,path:c.path}});
const rejected=(status:number,code="forbidden")=>Object.assign(new Error(code),{status,code});
function setup(){
  const values=new Map<string,string>();let current:AttendanceCommandScope|null=scope, broken=false;
  const storage={get length(){if(broken)throw new Error("storage private details");return values.size;},key:(index:number)=>[...values.keys()][index]??null,getItem:vi.fn((key:string)=>{if(broken)throw new Error("storage private details");return values.get(key)??null;}),setItem:vi.fn((key:string,value:string)=>{if(broken)throw new Error("quota");values.set(key,value);}),removeItem:vi.fn((key:string)=>{if(broken)throw new Error("quota");values.delete(key);})};
  const send=vi.fn(async(command:Command)=>{void command;return {revision:6,value:{id:8,full_name:"OWNER_PERSONAL_RESPONSE"}};}),receipt=vi.fn(async(key:string)=>{void key;return committed();}),refresh=vi.fn(async()=>{}),lock=vi.fn(async(_name:string,run:()=>Promise<unknown>)=>run());
  const dependencies={currentScope:()=>current,storage:()=>storage,send,receipt,refresh,lock:async<T>(name:string,run:()=>Promise<T>)=>await lock(name,run) as T};
  return {values,storage,send,receipt,refresh,lock,dependencies,runner:()=>new AttendanceCommandRunner(current,dependencies),setScope:(value:AttendanceCommandScope|null)=>{current=value;},breakStorage:()=>{broken=true;},fixStorage:()=>{broken=false;}};
}
beforeEach(()=>vi.clearAllMocks());
describe("Attendance durable command recovery",()=>{
  it("persists only bounded metadata before dispatch and freezes exact in-memory retries despite form edits",async()=>{
    const env=setup(),c=command();env.send.mockRejectedValueOnce(rejected(0,"transport_error"));
    const runner=env.runner();await runner.execute(c);
    const raw=env.values.get(attendanceCommandJournalKey(scope))!;
    expect(JSON.parse(raw)).toEqual(metadata(c));expect(raw).not.toMatch(/PRIVATE_QR|PERSONAL_DETAIL|nested|body|bearer|OWNER_PERSONAL_RESPONSE/);
    expect(raw.length).toBeLessThan(2048);expect(env.storage.setItem.mock.invocationCallOrder[0]).toBeLessThan(env.send.mock.invocationCallOrder[0]);
    (c.data as {qr:string;nested:{value:string}}).qr="NEW_QR";(c.data as {nested:{value:string}}).nested.value="changed";
    await runner.retry();expect(env.send.mock.calls[1]).toEqual(env.send.mock.calls[0]);
    expect(env.send.mock.calls[1]?.[0].data).toMatchObject({qr:"PRIVATE_QR",nested:{value:"frozen"}});expect(Object.isFrozen(env.send.mock.calls[1]?.[0].data)).toBe(true);
    expect(env.values.size).toBe(0);
  });
  it.each([401,403,404,409,503])("keeps a lost outcome through retry %i, relogin and only clears exact receipt proof",async status=>{
    const env=setup();env.send.mockRejectedValueOnce(rejected(0,"transport_error")).mockRejectedValueOnce(rejected(status));
    const runner=env.runner();await runner.execute(command());await runner.retry();expect(runner.getSnapshot().pending?.key).toBe(key);
    const restored=env.runner();expect(restored.getSnapshot().canRetry).toBe(false);await restored.retry();expect(env.send).toHaveBeenCalledTimes(2);
    expect(await restored.recover()).toBe(true);expect(env.receipt).toHaveBeenCalledWith(key);expect(env.send).toHaveBeenCalledTimes(2);expect(env.refresh).toHaveBeenCalledOnce();expect(env.values.size).toBe(0);
  });
  it("after reload recovers by GET and canonical refresh without old response callbacks, and requires explicit new intent",async()=>{
    const env=setup(),callback=vi.fn();env.send.mockRejectedValueOnce(rejected(0,"transport_error"));
    await env.runner().execute(command(),callback);const restored=env.runner();
    expect(await restored.recover()).toBe(true);expect(callback).not.toHaveBeenCalled();expect(restored.getSnapshot().recovery).toBe("committed");
    await restored.execute({...command(),key:key2});expect(env.send).toHaveBeenCalledOnce();expect(env.values.size).toBe(0);
    restored.acknowledgeRecovery();await restored.execute({...command(),key:key2});expect(env.send).toHaveBeenCalledTimes(2);
  });
  it.each([400,401,403,404,409,503])("keeps restored unknown metadata on receipt %i",async status=>{
    const env=setup();env.values.set(attendanceCommandJournalKey(scope),JSON.stringify(metadata()));env.receipt.mockRejectedValueOnce(rejected(status,status===409?"receipt_scope_unverifiable":"not_found"));
    const runner=env.runner();expect(await runner.recover()).toBe(false);expect(runner.getSnapshot().pending?.key).toBe(key);
    await runner.execute({...command(),key:key2});expect(env.send).not.toHaveBeenCalled();expect(env.values.get(attendanceCommandJournalKey(scope))).toBe(JSON.stringify(metadata()));
  });
  it("clears a known first direct denial, but a confirmed owner success followed by failed refresh is never unknown",async()=>{
    const env=setup();env.send.mockRejectedValueOnce(rejected(403));const runner=env.runner();await runner.execute(command());expect(env.values.size).toBe(0);expect(runner.getSnapshot().pending).toBeNull();
    env.refresh.mockRejectedValueOnce(new Error("refresh"));await runner.execute({...command(),key:key2});expect(env.values.size).toBe(0);expect(runner.getSnapshot().pending).toBeNull();expect(runner.getSnapshot().notice).toContain("подтверждено");
  });
  it("does not read, replay or clear a different actor, organization or originally selected division",async()=>{
    const env=setup();env.send.mockRejectedValueOnce(rejected(0,"transport_error"));const original=env.runner();await original.execute(command());
    for(const foreign of [{...scope,account_id:34},{...scope,organization_id:2},{...scope,selected_division_id:3}]){
      env.setScope(foreign);const other=env.runner();expect(other.getSnapshot().pending).toBeNull();await original.recover();await original.retry();expect(env.receipt).not.toHaveBeenCalled();expect(env.send).toHaveBeenCalledOnce();expect(env.values.has(attendanceCommandJournalKey(scope))).toBe(true);
    }
    env.setScope({...scope});await env.runner().recover();expect(env.values.size).toBe(0);
  });
  it("rejects wrong UUID/org/path/method/scope or leaked response bodies without clearing the original slot",async()=>{
    const env=setup();env.values.set(attendanceCommandJournalKey(scope),JSON.stringify(metadata()));
    for(const patch of [{command_id:key2},{organization_id:2},{path:"/v1/attendance"+command().path},{method:"DELETE"},{division_ids:[2]},{division_ids:[3,3]},{division_ids:Array.from({length:101},(_,i)=>i+1)},{scope:"organization"},{body:{qr:"PRIVATE"}},{contract_version:2}]){
      env.receipt.mockResolvedValueOnce({...committed(),value:{...committed().value,...patch}});expect(await env.runner().recover()).toBe(false);expect(env.values.size).toBe(1);
    }
    expect(env.refresh).not.toHaveBeenCalled();expect(env.send).not.toHaveBeenCalled();
  });
  it("serializes double execute and independent same-tab runners before a second command can dispatch",async()=>{
    const env=setup();let finish!:(value:{revision:number;value:{id:number;full_name:string}})=>void;
    env.send.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));const first=env.runner(),second=env.runner();const sending=first.execute(command());
    await first.execute({...command(),key:key2});await second.execute({...command(),key:key2});expect(env.send).toHaveBeenCalledOnce();finish({revision:6,value:{id:8,full_name:"Synthetic"}});await sending;
    env.send.mockRejectedValueOnce(rejected(0,"transport_error"));await first.execute(command());await second.execute({...command(),key:key2});expect(env.send).toHaveBeenCalledTimes(2);
  });
  it("honors cross-tab Web Lock rejection and an existing durable foreign-tab slot without dispatch",async()=>{
    const env=setup();env.lock.mockRejectedValueOnce(new Error("other tab"));await env.runner().execute(command());expect(env.send).not.toHaveBeenCalled();expect(env.values.size).toBe(0);
    env.values.set(attendanceCommandJournalKey(scope),JSON.stringify(metadata()));await env.runner().execute({...command(),key:key2});expect(env.send).not.toHaveBeenCalled();expect(env.values.size).toBe(1);
  });
  it("blocks explicit overlapping division and bulk writes from a different selected cabinet without reading its receipt",async()=>{
    const env=setup();env.send.mockRejectedValueOnce(rejected(0,"transport_error"));await env.runner().execute(command());
    env.setScope({...scope,selected_division_id:9});const other=env.runner();expect(other.getSnapshot().blocked).toBe(true);expect(other.getSnapshot().pending).toBeNull();
    await other.execute({...command(),key:key2});await other.execute({...command(),path:"/schedule/bulk",key:key2,data:{creates:[],updates:[],deletes:[{division_id:3,id:8}]}});await other.recover();
    expect(env.send).toHaveBeenCalledOnce();expect(env.receipt).not.toHaveBeenCalled();expect(env.values.size).toBe(1);
    expect(env.lock.mock.calls.every(call=>call[0]===`cpm-bff-attendance-command:v1:${scope.account_id}:${scope.organization_id}`)).toBe(true);
  });
  it("bounds the entire namespace by count and size without evicting any unknown command",async()=>{
    const env=setup();
    for(let i=0;i<ATTENDANCE_JOURNAL_MAX_RECORDS;i++)env.values.set(attendanceCommandJournalKey({...scope,account_id:100+i}),JSON.stringify({...metadata(),account_id:100+i}));
    const before=new Map(env.values);await env.runner().execute(command());expect(env.send).not.toHaveBeenCalled();expect(env.values).toEqual(before);expect(env.storage.removeItem).not.toHaveBeenCalled();
    env.values.clear();env.values.set(attendanceCommandJournalKey({...scope,account_id:99}),"x".repeat(ATTENDANCE_JOURNAL_MAX_BYTES));
    await env.runner().execute(command());expect(env.send).not.toHaveBeenCalled();expect(env.values.size).toBe(1);expect(env.storage.removeItem).not.toHaveBeenCalled();
  });
  it("requires the exact committed CAS revision and a nonempty original bulk target union",async()=>{
    const env=setup();env.values.set(attendanceCommandJournalKey(scope),JSON.stringify(metadata()));env.receipt.mockResolvedValueOnce({...committed(),revision:7});expect(await env.runner().recover()).toBe(false);expect(env.values.size).toBe(1);
    const bulk={...command(),path:"/schedule/bulk"};env.values.set(attendanceCommandJournalKey(scope),JSON.stringify(metadata(bulk)));env.receipt.mockResolvedValueOnce({...committed(bulk),value:{...committed(bulk).value,scope:"divisions",division_ids:[]}});expect(await env.runner().recover()).toBe(false);expect(env.values.size).toBe(1);
    env.receipt.mockResolvedValueOnce({...committed(bulk),value:{...committed(bulk).value,scope:"divisions",division_ids:[3,9]}});expect(await env.runner().recover()).toBe(true);expect(env.values.size).toBe(0);
  });
  it("blocks before dispatch on storage failure, malformed/oversized records and metadata containing private fields",async()=>{
    const env=setup();env.breakStorage();await env.runner().execute(command());expect(env.send).not.toHaveBeenCalled();env.fixStorage();
    for(const stored of ["invalid", "x".repeat(2049),JSON.stringify({...metadata(),qr:"PRIVATE"}),JSON.stringify({...metadata(),account_id:99})]){
      env.values.set(attendanceCommandJournalKey(scope),stored);await env.runner().execute({...command(),key:key2});expect(env.values.get(attendanceCommandJournalKey(scope))).toBe(stored);expect(env.send).not.toHaveBeenCalled();
    }
  });
  it("never clears replacement metadata if another tab changes the slot before the confirmed reply",async()=>{
    const env=setup();env.values.set(attendanceCommandJournalKey(scope),JSON.stringify(metadata()));env.receipt.mockImplementationOnce(async()=>{env.values.set(attendanceCommandJournalKey(scope),JSON.stringify(metadata({...command(),key:key2})));return committed();});
    expect(await env.runner().recover()).toBe(false);expect(JSON.parse(env.values.get(attendanceCommandJournalKey(scope))!).key).toBe(key2);expect(env.refresh).not.toHaveBeenCalled();
  });
});

it("restores a batch's metadata-only receipt without persisting or resending its cells",async()=>{
  const env=setup(),c:Command={...command(),path:"/divisions/3/attendance-cells/batch",data:{cells:[{class_day_id:4,account_id:987654321,attendance_type_id:8}]}};
  env.send.mockRejectedValueOnce(rejected(0,"transport_error"));await env.runner().execute(c);
  const raw=env.values.get(attendanceCommandJournalKey(scope))!;expect(JSON.parse(raw)).toEqual(metadata(c));expect(raw).not.toContain("987654321");expect(raw).not.toContain("class_day_id");
  env.receipt.mockResolvedValueOnce(committed(c));const restored=env.runner();expect(restored.getSnapshot().canRetry).toBe(false);expect(await restored.recover()).toBe(true);expect(env.send).toHaveBeenCalledOnce();expect(env.refresh).toHaveBeenCalledOnce();expect(env.values.size).toBe(0);
});
