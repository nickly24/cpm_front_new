import { getIdentity } from "./client";
import { attendanceError, readAttendance, sendAttendance, type Command, type Revision } from "./attendance";

export interface AttendanceCommandScope { account_id:number; organization_id:number; selected_division_id:number|null }
export interface AttendanceCommandMetadata extends AttendanceCommandScope {
  version:1; key:string; path:string; method:"POST"|"PUT"|"DELETE"; revision:number;
}
export interface AttendanceCommandState {
  pending:AttendanceCommandMetadata|null; busy:boolean; error:string; notice:string;
  canRetry:boolean; blocked:boolean; recovery:"idle"|"unknown"|"committed";
}
interface MemoryCommand { command:Command; onSuccess?: (result:Revision<unknown>)=>void }
interface JournalStorage { readonly length:number; key(index:number):string|null; getItem(key:string):string|null; setItem(key:string,value:string):void; removeItem(key:string):void }
export interface AttendanceCommandDependencies {
  currentScope:()=>AttendanceCommandScope|null;
  storage:()=>JournalStorage;
  send:(command:Command)=>Promise<Revision<unknown>>;
  receipt:(key:string)=>Promise<unknown>;
  refresh:()=>Promise<void>;
  lock:<T>(name:string,run:()=>Promise<T>)=>Promise<T>;
  changed?:(key:string)=>void;
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const id="[1-9][0-9]*", division=`divisions/${id}`, date="[0-9]{4}-[0-9]{2}-[0-9]{2}";
const routes:Record<string,RegExp>={
  POST:new RegExp(`^/(schedule/bulk|resources/rooms|${division}/(schedule|attendance-types|class-days|zaps|class-days/${id}/(attendance|scan)|zaps/${id}/process|zaps/${id}/dates/${date}/retry))$`),
  PUT:new RegExp(`^/${division}/(calendar|schedule/${id}|attendance-types/${id}|class-days/${id})$`),
  DELETE:new RegExp(`^/${division}/(schedule/${id}|attendance-types/${id}|class-days/${id}|class-days/${id}/attendance/${id}|zaps/${id}/dates/${date})$`),
};
const metadataFields=["version","key","path","method","revision","account_id","organization_id","selected_division_id"];
const sameMetadata=(left:AttendanceCommandMetadata,right:AttendanceCommandMetadata)=>metadataFields.every(field=>left[field as keyof AttendanceCommandMetadata]===right[field as keyof AttendanceCommandMetadata]);
const sameScope=(left:AttendanceCommandScope|null,right:AttendanceCommandScope|null)=>!!left&&!!right&&left.account_id===right.account_id&&left.organization_id===right.organization_id&&left.selected_division_id===right.selected_division_id;
const positive=(value:unknown)=>typeof value==="number"&&Number.isSafeInteger(value)&&value>0;
const object=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
const initial:AttendanceCommandState={pending:null,busy:false,error:"",notice:"",canRetry:false,blocked:false,recovery:"idle"};
const journalPrefix="cpm-bff-attendance-command:v1:";
export const ATTENDANCE_JOURNAL_MAX_RECORDS=32;
export const ATTENDANCE_JOURNAL_MAX_BYTES=64*1024;
const mutex=new Set<string>();
const eventName="cpm-attendance-command-journal";
function freezeSnapshot(value:unknown){
  const stack=[value];
  while(stack.length){const current=stack.pop();if(current&&typeof current==="object"){stack.push(...Object.values(current));Object.freeze(current);}}
}
const unknownNotice="Исход команды пока не подтверждён. Новое действие не будет отправлено автоматически. Проверьте исход в исходном кабинете.";
const otherCabinetNotice="В другом кабинете этой организации есть команда с неподтверждённым исходом. Вернитесь в исходный кабинет и проверьте её; новое действие не отправлено.";
const committedNotice="Действие выполнено. Закройте прежнюю форму перед новым действием; сохранённые данные обновлены.";
class JournalError extends Error {}
export function attendanceCommandScope():AttendanceCommandScope|null {
  const user=getIdentity()?.user;
  if(!positive(user?.account_id)||!positive(user?.organization_id)||user?.division_id!=null&&!positive(user.division_id))return null;
  return {account_id:user!.account_id!,organization_id:user!.organization_id!,selected_division_id:user!.division_id??null};
}
export function attendanceCommandJournalKey(scope:AttendanceCommandScope):string {
  return `${journalPrefix}${scope.account_id}:${scope.organization_id}:${scope.selected_division_id??"none"}`;
}
function validMetadata(value:unknown,scope:AttendanceCommandScope):value is AttendanceCommandMetadata {
  const row=object(value);
  return Object.keys(row).length===metadataFields.length&&Object.keys(row).every(key=>metadataFields.includes(key))&&row.version===1&&typeof row.key==="string"&&uuid.test(row.key)&&typeof row.method==="string"&&typeof row.path==="string"&&row.path.length<=512&&routes[row.method]?.test(row.path)===true&&typeof row.revision==="number"&&Number.isSafeInteger(row.revision)&&row.revision>=0&&sameScope(row as unknown as AttendanceCommandScope,scope);
}
function receiptMatches(raw:unknown,saved:AttendanceCommandMetadata):boolean {
  const response=object(raw), value=object(response.value), ids=value.division_ids;
  const allowed=["contract_version","command_id","state","organization_id","scope","division_ids","method","path"];
  if(Object.keys(value).length!==allowed.length||!Object.keys(value).every(key=>allowed.includes(key))||!positive(response.revision)||response.revision!==saved.revision+1||value.contract_version!==1||value.command_id!==saved.key||value.state!=="committed"||value.organization_id!==saved.organization_id||value.method!==saved.method||value.path!==saved.path||!Array.isArray(ids)||ids.length>100||ids.some((item,i)=>!positive(item)||i>0&&ids[i-1]>=item))return false;
  const match=saved.path.match(/^\/divisions\/([1-9][0-9]*)\//);
  if(match)return value.scope==="division"&&ids.length===1&&ids[0]===Number(match[1]);
  return saved.path==="/schedule/bulk"?value.scope==="divisions"&&ids.length>0:saved.path==="/resources/rooms"&&value.scope==="organization"&&ids.length===0;
}
function commandError(error:unknown):string {
  if(error instanceof JournalError)return error.message;
  const code=object(error).code;
  if(code==="receipt_scope_unverifiable"||code==="not_found")return "Исход команды пока невозможно подтвердить. Команда сохранена; новая отправка заблокирована.";
  return attendanceError(error);
}

/** One metadata-only durable slot per original actor/cabinet. Full inputs exist only in RAM. */
export class AttendanceCommandRunner {
  private state:AttendanceCommandState={...initial};
  private listeners=new Set<()=>void>();
  private memory:MemoryCommand|null=null;
  readonly journalKey:string|null;
  readonly lockKey:string|null;
  constructor(readonly scope:AttendanceCommandScope|null,private dependencies:AttendanceCommandDependencies){
    this.journalKey=scope?attendanceCommandJournalKey(scope):null;
    this.lockKey=scope?`${journalPrefix}${scope.account_id}:${scope.organization_id}`:null;
    this.restore();
  }
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  getSnapshot=()=>this.state;
  getServerSnapshot=()=>initial;
  private update(patch:Partial<AttendanceCommandState>){
    this.state={...this.state,...patch};
    this.state.canRetry=!!this.memory&&this.memory.command.key===this.state.pending?.key;
    for(const listener of this.listeners)listener();
  }
  private assertScope(){if(!sameScope(this.scope,this.dependencies.currentScope()))throw new JournalError("Войдите тем же пользователем и вернитесь в исходный кабинет, чтобы проверить команду.");}
  private scan(){
    const keys:string[]=[], accountPrefix=this.scope?`${journalPrefix}${this.scope.account_id}:${this.scope.organization_id}:`:"";let bytes=0;
    try{
      const storage=this.dependencies.storage();
      for(let i=0;i<storage.length;i++){
        const key=storage.key(i);if(!key?.startsWith(journalPrefix))continue;
        keys.push(key);const raw=storage.getItem(key);bytes+=(key.length+(raw?.length??0))*2;
      }
    }catch{throw new JournalError("Журнал команд недоступен. Новое действие не отправлено; восстановите доступ к хранилищу браузера.");}
    return {keys,bytes,foreignPending:keys.some(key=>key!==this.journalKey&&key.startsWith(accountPrefix))};
  }
  private read():AttendanceCommandMetadata|null {
    if(!this.scope||!this.journalKey)return null;
    let raw:string|null;
    try{raw=this.dependencies.storage().getItem(this.journalKey);}catch{throw new JournalError("Журнал команд недоступен. Новое действие не отправлено; восстановите доступ к хранилищу браузера.");}
    if(raw===null)return null;
    let parsed:unknown;
    try{if(raw.length>2048)throw new Error();parsed=JSON.parse(raw);}catch{throw new JournalError("Сохранённую команду нельзя проверить. Новые действия заблокированы; журнал не удалён.");}
    if(!validMetadata(parsed,this.scope))throw new JournalError("Сохранённая команда не соответствует исходному кабинету. Журнал не удалён; новые действия заблокированы.");
    return parsed;
  }
  restore=()=>{
    try{
      const pending=this.read();
      const blocked=this.scope?this.scan().foreignPending:false;
      if(this.memory?.command.key!==pending?.key)this.memory=null;
      this.update({pending,blocked,...(pending?{recovery:"unknown",notice:unknownNotice}:blocked?{recovery:"unknown",notice:otherCabinetNotice}:this.state.recovery!=="committed"?{recovery:"idle",notice:""}:{})});
    }catch(error){this.update({error:commandError(error)});}
  };
  private persist(saved:AttendanceCommandMetadata){
    const raw=JSON.stringify(saved), scanned=this.scan();
    if(scanned.foreignPending){this.restore();throw new JournalError(otherCabinetNotice);}
    if(scanned.keys.length>=ATTENDANCE_JOURNAL_MAX_RECORDS||scanned.bytes+(this.journalKey!.length+raw.length)*2>ATTENDANCE_JOURNAL_MAX_BYTES)throw new JournalError("Журнал команд заполнен. Проверьте сохранённые исходы в исходных кабинетах; неизвестные команды не удалены, новое действие не отправлено.");
    try{this.dependencies.storage().setItem(this.journalKey!,raw);}
    catch{throw new JournalError("Не удалось сохранить журнал команды. Действие не отправлено; восстановите хранилище браузера.");}
    this.update({pending:saved,recovery:"unknown",notice:unknownNotice});
    this.dependencies.changed?.(this.journalKey!);
  }
  private clear(saved:AttendanceCommandMetadata){
    this.assertScope();
    const current=this.read();
    if(current&&!sameMetadata(current,saved))throw new JournalError("В журнале другая команда. Её исход не изменён; обновите страницу.");
    try{if(current)this.dependencies.storage().removeItem(this.journalKey!);}catch{throw new JournalError("Действие подтверждено, но журнал пока не очищен. Повторите проверку исхода; новую команду не отправляйте.");}
    this.memory=null;this.update({pending:null});this.dependencies.changed?.(this.journalKey!);
  }
  private async exclusive<T>(run:()=>Promise<T>,fallback:T):Promise<T>{
    const lockKey=this.lockKey;
    if(this.state.busy||!lockKey||mutex.has(lockKey))return fallback;
    mutex.add(lockKey);this.update({busy:true,error:""});
    try{this.assertScope();return await this.dependencies.lock(lockKey,run);}
    catch(error){this.update({error:commandError(error)});return fallback;}
    finally{mutex.delete(lockKey);this.update({busy:false});}
  }
  async execute<T>(command:Command,onSuccess?:(result:Revision<T>)=>void):Promise<Revision<T>|null>{
    if(this.state.recovery==="committed"){this.update({error:"Действие уже выполнено. Закройте прежнюю форму и подтвердите намерение начать новое действие."});return null;}
    return this.exclusive(async()=>{
      this.restore();
      const existing=this.read();
      if(existing||this.state.blocked)throw new JournalError(this.state.blocked?otherCabinetNotice:"Сначала проверьте исход сохранённой команды. Новое действие не отправлено.");
      if(!this.scope)throw new JournalError("Выберите исходный кабинет.");
      const saved:AttendanceCommandMetadata={version:1,...this.scope,key:command.key,path:command.path,method:command.method as AttendanceCommandMetadata["method"],revision:command.revision};
      if(!validMetadata(saved,this.scope))throw new JournalError("Команду нельзя безопасно сохранить. Обновите страницу и проверьте действие.");
      // Clone the generated JSON snapshot. Later form changes cannot alter an exact retry.
      let data:unknown;
      try{data=JSON.parse(JSON.stringify(command.data));}catch{throw new JournalError("Данные команды нельзя отправить. Проверьте форму.");}
      const snapshot:Command={...command,data};
      freezeSnapshot(snapshot);
      this.memory={command:snapshot,onSuccess:onSuccess as MemoryCommand["onSuccess"]};
      try{this.persist(saved);}catch(error){this.memory=null;throw error;}
      return await this.dispatch(saved,false) as Revision<T>|null;
    },null);
  }
  private async dispatch(saved:AttendanceCommandMetadata,wasUnknown:boolean):Promise<Revision<unknown>|null>{
    const memory=this.memory;
    if(!memory||memory.command.key!==saved.key)throw new JournalError("После перезагрузки доступна только проверка исхода; тело команды не сохранено.");
    this.assertScope();
    let result:Revision<unknown>;
    try{result=await this.dependencies.send(memory.command);}
    catch(error){
      // A denied retry says nothing about the earlier unknown command.
      const status=object(error).status;
      if(!wasUnknown&&typeof status==="number"&&status>=400&&status<500){this.clear(saved);this.update({recovery:"idle",notice:""});}
      this.update({error:commandError(error)});return null;
    }
    this.clear(saved);this.update({recovery:"idle",notice:"Сохранение подтверждено."});
    try{memory.onSuccess?.(result);await this.dependencies.refresh();}
    catch{this.update({error:"Сохранение подтверждено, но данные не обновились. Обновите список перед следующим действием."});}
    return result;
  }
  retry=async()=>this.exclusive(async()=>{
    const saved=this.read();if(!saved){this.restore();return null;}
    return this.dispatch(saved,true);
  },null);
  recover=async()=>this.exclusive(async()=>{
    const saved=this.read();if(!saved){this.restore();return false;}
    const raw=await this.dependencies.receipt(saved.key);this.assertScope();
    if(!receiptMatches(raw,saved))throw new JournalError("Ответ не подтверждает исход сохранённой команды. Журнал сохранён; новые действия заблокированы.");
    this.clear(saved);this.update({recovery:"committed",notice:committedNotice});
    try{await this.dependencies.refresh();}catch{this.update({error:"Действие подтверждено, но данные не обновились. Обновите список; повторная отправка не нужна."});}
    return true;
  },false);
  acknowledgeRecovery=()=>{if(this.state.recovery==="committed")this.update({recovery:"idle",notice:"",error:""});};
  setError=(error:string)=>this.update({error});
  setRefresh=(refresh:()=>Promise<void>)=>{this.dependencies.refresh=refresh;};
  connect=()=>{
    if(typeof window==="undefined")return()=>{};
    const changed=(event:Event)=>{const key=event instanceof StorageEvent?event.key:(event as CustomEvent<string>).detail;if(key?.startsWith(`${this.lockKey}:`))this.restore();};
    window.addEventListener("storage",changed);window.addEventListener(eventName,changed);
    return()=>{window.removeEventListener("storage",changed);window.removeEventListener(eventName,changed);};
  };
}

export function browserAttendanceCommands(scope:AttendanceCommandScope|null,refresh:()=>Promise<void>){
  return new AttendanceCommandRunner(scope,{
    currentScope:attendanceCommandScope,storage:()=>window.localStorage,send:sendAttendance,
    receipt:key=>readAttendance(`/command-receipts/${key}`),refresh,
    lock:async(name,run)=>{
      if(!navigator.locks)throw new JournalError("Для безопасного сохранения нужен браузер с поддержкой Web Locks. Команда не отправлена.");
      return navigator.locks.request(name,{mode:"exclusive",ifAvailable:true},lock=>{
        if(!lock)throw new JournalError("Команда уже проверяется в другой вкладке. Дождитесь её результата.");
        return run();
      });
    },changed:key=>window.dispatchEvent(new CustomEvent(eventName,{detail:key})),
  });
}
