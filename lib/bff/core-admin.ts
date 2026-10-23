import { domain, getIdentity } from "./client";
import type { User } from "@/lib/auth/types";
import type { AdminStudent, AdminStaffUser, AdminGroupItem } from "@/lib/admin/admin-users-types";
import type { AdminSchool } from "@/lib/admin/admin-schools-types";

export interface CoreUser { account_id:number; profile_id:number; role:string; full_name:string; class:number|null; tg_name:string; school_id:number|null; group_id:number|null; role_id:number|null; is_active:boolean|number; login:string }
export interface CoreGroup { id:number; name:string; student_count:number; proctor_account_id:number|null }
export interface CoreRole { id:number; name:string; permissions:{section:string;can_view:boolean|number;can_edit:boolean|number}[] }
export interface CoreDashboard { organization_id:number; division_id:number; division_name:string; role:string; totals:{students:number|null;staff:number|null;groups:number|null;schools:number|null}; capabilities:string[] }
export interface CoreCreateUser { role:string; full_name:string; class:number|null; tg_name:string; school_id:number|null; group_id:number|null; role_id:number|null; login:string; password:string }
export type CoreProfilePatch = Partial<Pick<CoreUser,"full_name"|"class"|"tg_name"|"school_id"|"group_id"|"role_id"|"login">> & {password?:string};

export function coreCan(section:string, edit=false, user:User|undefined|null=getIdentity()?.user):boolean {
  return user?.organization_admin===true || (user?.permissions?.[section]?.view===true && (!edit || user.permissions[section].edit===true));
}
export function coreFullAdmin(user:User|undefined|null=getIdentity()?.user):boolean { return user?.organization_admin===true; }
const active=(value:boolean|number) => value===true || value===1;
function id(value:number) { if(!Number.isSafeInteger(value)||value<1) throw new Error("Недопустимый ID учётной записи"); return value; }
function scope(requireDivision=true) { const identity=getIdentity(); if(!identity?.user.account_id || !identity.user.organization_id || (requireDivision && !identity.user.division_id)) throw new Error("Выберите подразделение"); return `${identity.user.account_id}:${identity.user.organization_id}:${identity.user.division_id??"org"}`; }
function assertScope(expected:string) { if(scope(false)!==expected) throw new Error("Кабинет изменился. Обновите список."); }
export async function coreAll<T>(path:string, params:Record<string,string>={}, signal?:AbortSignal):Promise<T[]> {
  const result:T[]=[];
  for(let offset=0;offset<=100000;offset+=200) {
    const query=new URLSearchParams({...params,limit:"200",offset:String(offset)});
    const rows=await domain<T[]>(`${path}?${query}`,{signal}).catch(error=>{throw coreError(error);});
    if(!Array.isArray(rows)) throw new Error("Сервис вернул неверный список");
    result.push(...rows); if(rows.length<200) return result;
  }
  throw new Error("Список слишком большой. Уточните фильтр.");
}
export const coreUsers=(role?:string,signal?:AbortSignal,unassigned=false) => coreAll<CoreUser>("/core/users",{...(role?{role}:{}),...(unassigned?{unassigned:"true"}:{})},signal);
export const coreStudents=(signal?:AbortSignal) => coreAll<CoreUser>("/core/students",{},signal);
export const coreUser=(accountId:number,signal?:AbortSignal) => domain<CoreUser>(`/core/users/${id(accountId)}`,{signal});
export const coreGroups=(signal?:AbortSignal) => coreAll<CoreGroup>("/core/groups",{},signal);
export const coreGroupMembers=(groupId:number,signal?:AbortSignal) => coreAll<CoreUser>(`/core/groups/${id(groupId)}/members`,{},signal);
export const coreRoles=async(signal?:AbortSignal) => (await domain<{roles:CoreRole[];sections:string[]}>("/core/roles",{signal})).roles;
export const coreDashboard=(signal?:AbortSignal) => domain<CoreDashboard>("/core/dashboard",{signal});
export function mapCoreStudent(row:CoreUser,schools:AdminSchool[]=[],groups:CoreGroup[]=[]):AdminStudent {
  const school=schools.find(s=>s.school_id===row.school_id);
  return {id:id(row.account_id),profile_id:row.profile_id,full_name:row.full_name,class:row.class,group_id:row.group_id,group_name:groups.find(g=>g.id===row.group_id)?.name??null,school_id:row.school_id,school_name:school?.name??null,school_short_name:school?.short_name??null,tg_name:row.tg_name,login:row.login,password:null,password_hidden:true,is_active:active(row.is_active),role_id:row.role_id};
}
export function mapCoreStaff(row:CoreUser,groups:CoreGroup[]=[]):AdminStaffUser {
  return {id:id(row.account_id),profile_id:row.profile_id,full_name:row.full_name,group_id:row.group_id,group_name:groups.find(g=>g.id===row.group_id)?.name??null,login:row.login,password:null,password_hidden:true,is_active:active(row.is_active),role_id:row.role_id};
}
export const mapCoreGroup=(g:CoreGroup):AdminGroupItem => ({group_id:g.id,group_name:g.name});
export function mapCoreSchool(s:{id:number;name:string;short_name?:string|null;notes?:string|null;is_active:boolean|number}):AdminSchool { return {school_id:s.id,name:s.name,short_name:s.short_name??null,notes:s.notes??null,is_active:active(s.is_active)}; }
export const coreSchools=async(signal?:AbortSignal) => (await coreAll<Parameters<typeof mapCoreSchool>[0]>("/core/schools",{},signal)).map(mapCoreSchool);
export const coreSchool=async(schoolId:number) => mapCoreSchool(await domain<Parameters<typeof mapCoreSchool>[0]>(`/core/schools/${id(schoolId)}`));

const labels:Record<string,string>={division_required:"Выберите подразделение в меню кабинетов",transport_error:"Не удалось получить ответ сервера. Обновите данные",login_exists:"Этот логин уже используется",invalid_user:"Проверьте ФИО, логин и пароль (не менее 8 символов)",invalid_profile:"Проверьте поля профиля",invalid_credentials:"Укажите логин и новый пароль (не менее 8 символов)",global_profile_requires_organization_admin:"Профиль используется в нескольких подразделениях. Его изменяет администратор организации",conflict:"Изменение конфликтует с текущими данными. Обновите список",cannot_disable_self:"Нельзя заблокировать свою учётную запись",inactive_user:"Сначала активируйте пользователя",dependency_unavailable:"Сервис временно недоступен"};
export function coreError(error:unknown):Error { const e=error as Error & {code?:string;status?:number}; return Object.assign(new Error(labels[e.code??""]??e.message??"Не удалось выполнить запрос"),{code:e.code,status:e.status}); }
export function coreUncertain(error:unknown):boolean { const status=(error as {status?:number})?.status; return status===0||status===502||status===503||status===504; }
interface PendingCreate {scope:string;role:string;full_name:string;class:number|null;login:string;school_id:number|null;group_id:number|null;role_id:number|null}
const journalKey=() => `cpm-core-create:${scope()}`;
export function pendingCoreCreate():PendingCreate|null { try { return JSON.parse(sessionStorage.getItem(journalKey())??"null"); } catch { return null; } }
export async function recoverCoreCreate():Promise<{account_id:number}> {
  const pending=pendingCoreCreate(); if(!pending) throw new Error("Нет запроса для проверки");
  const candidates=(await coreUsers(pending.role)).filter(u=>u.login===pending.login);
  const found=candidates.find(u=>u.full_name===pending.full_name&&(u.class??0)===(pending.class??0)&&u.school_id===pending.school_id&&u.group_id===pending.group_id&&u.role_id===pending.role_id);
  if(!found) throw new Error(candidates.length?"Логин занят другим профилем. Обновите список и проверьте данные.":"Учётная запись пока не найдена. Обновите список перед повторным созданием.");
  assertScope(pending.scope); sessionStorage.removeItem(journalKey()); return {account_id:found.account_id};
}
export function dismissCoreCreate() { try { sessionStorage.removeItem(journalKey()); } catch {} }
export async function createCoreUser(payload:CoreCreateUser):Promise<{account_id:number}> {
  const snapshot=scope(),key=journalKey(); if(pendingCoreCreate()) throw new Error("Сначала проверьте результат предыдущего создания");
  if(!payload.login.trim()||/\s/.test(payload.login)||payload.password.length<8||payload.password.length>1024) throw new Error("Укажите логин без пробелов и пароль не менее 8 символов");
  try { return await domain<{account_id:number}>("/core/users",{method:"POST",body:JSON.stringify(payload)}); }
  catch(error) {
    if(coreUncertain(error)) { const {password: omitted,...safe}=payload; void omitted; sessionStorage.setItem(key,JSON.stringify({...safe,scope:snapshot})); throw Object.assign(new Error("Ответ не получен. Проверьте создание, прежде чем отправлять новый запрос."),{status:(error as {status:number}).status,code:"core_create_uncertain"}); }
    throw coreError(error);
  }
}
export async function changeCoreGroup(accountId:number,groupId:number|null,currentGroupId?:number):Promise<void> {
  const snapshot=scope();
  if(!coreCan("users") && coreCan("groups")) {
    try {
      if(groupId!==null) await domain(`/core/groups/${id(groupId)}/members`,{method:"POST",body:JSON.stringify({account_id:id(accountId)})});
      else {if(currentGroupId===undefined)throw new Error("Откройте состав группы перед удалением участника");assertScope(snapshot);await domain(`/core/groups/${id(currentGroupId)}/members/${id(accountId)}`,{method:"DELETE"});}
      return;
    }catch(error){throw coreError(error);}
  }
  const row=await coreUser(accountId); assertScope(snapshot);
  if(groupId===row.group_id) return;
  try {if(groupId!==null) await domain(`/core/groups/${id(groupId)}/members`,{method:"POST",body:JSON.stringify({account_id:id(accountId)})});
  else if(row.group_id!==null) await domain(`/core/groups/${id(row.group_id)}/members/${id(accountId)}`,{method:"DELETE"});}
  catch(error){const e=coreError(error);if(coreUncertain(error))e.message="Ответ не получен. Обновите состав группы и проверьте назначение.";throw e;}
}
export async function updateCoreUser(accountId:number,patch:CoreProfilePatch):Promise<void> {
  const snapshot=scope(); const row=await coreUser(accountId); assertScope(snapshot);
  if(patch.login!==undefined || patch.password!==undefined) {
    if(!coreFullAdmin()) throw new Error("Учётные данные изменяет администратор организации");
    if(!patch.password || patch.password.length<8) throw new Error("Для смены логина или пароля укажите новый пароль не менее 8 символов");
  }
  try {
    if(["full_name","class","tg_name","school_id"].some(key=>Object.prototype.hasOwnProperty.call(patch,key))) {
      await domain(`/core/users/${id(accountId)}`,{method:"PUT",body:JSON.stringify({full_name:patch.full_name??row.full_name,class:patch.class===undefined?row.class:patch.class,tg_name:patch.tg_name??row.tg_name??"",school_id:patch.school_id===undefined?row.school_id:patch.school_id})});
    }
    assertScope(snapshot);
    if(patch.login!==undefined||patch.password!==undefined) await domain(`/core/users/${id(accountId)}/credentials`,{method:"PUT",body:JSON.stringify({login:patch.login??row.login,password:patch.password})});
    assertScope(snapshot);
    if(patch.role_id!==undefined&&patch.role_id!==row.role_id) await domain(`/core/memberships/${id(accountId)}`,{method:"PUT",body:JSON.stringify({role_id:patch.role_id})});
    assertScope(snapshot);
    if(patch.group_id!==undefined) await changeCoreGroup(accountId,patch.group_id);
  } catch(error) { const e=coreError(error); e.message+= " Обновите профиль: часть изменений могла сохраниться."; throw e; }
}
export async function activateCoreUser(accountId:number,isActive:boolean):Promise<void> { try { await domain(`/core/users/${id(accountId)}/active`,{method:"PUT",body:JSON.stringify({is_active:isActive})}); } catch(e) {throw coreError(e);} }
export function generatedCorePassword():string { return `${crypto.randomUUID().replaceAll("-","")}Aa7!`; }
interface PendingCatalog {scope:string;kind:"group"|"school";name:string;before:number[]}
const catalogJournalKey=()=>`cpm-core-catalog-create:${scope(false)}`;
export function pendingCoreCatalog():PendingCatalog|null {try{return JSON.parse(sessionStorage.getItem(catalogJournalKey())??"null");}catch{return null;}}
export function dismissCoreCatalog(){try{sessionStorage.removeItem(catalogJournalKey());}catch{}}
export async function recoverCoreCatalog():Promise<void>{
  const pending=pendingCoreCatalog();if(!pending)throw new Error("Нет запроса для проверки");
  const rows=pending.kind==="school"?(await coreSchools()).map(s=>({id:s.school_id,name:s.name})):(await coreGroups()).map(g=>({id:g.id,name:g.name}));
  const matches=rows.filter(r=>r.name===pending.name&&!pending.before.includes(r.id));assertScope(pending.scope);
  if(matches.length!==1)throw new Error(matches.length?"Найдено несколько новых записей. Проверьте список.":"Новая запись пока не найдена. Обновите список перед повторным созданием.");
  sessionStorage.removeItem(catalogJournalKey());
}
export async function saveCoreSchool(schoolId:number|null,patch:Partial<AdminSchool>):Promise<AdminSchool> {
  const snapshot=scope(false),key=catalogJournalKey();
  if(!schoolId&&pendingCoreCatalog())throw new Error("Сначала проверьте результат предыдущего создания");
  const before=schoolId?[]:(await coreSchools()).map(s=>s.school_id);
  const previous=schoolId?await coreSchool(schoolId):null;
  assertScope(snapshot);
  const payload={name:patch.name??previous?.name??"",short_name:patch.short_name??previous?.short_name??"",notes:patch.notes??previous?.notes??"",is_active:patch.is_active??previous?.is_active??true};
  try { const result=await domain<{id:number}>(`/core/schools${schoolId?`/${id(schoolId)}`:""}`,{method:schoolId?"PUT":"POST",body:JSON.stringify(payload)}); return {...payload,school_id:result.id}; }
  catch(error) {const e=coreError(error); if(coreUncertain(error)){if(!schoolId)sessionStorage.setItem(key,JSON.stringify({scope:snapshot,kind:"school",name:payload.name,before}));e.message="Ответ не получен. Обновите справочник и проверьте школу перед повторным созданием.";} throw e;}
}
export async function saveCoreGroup(groupId:number|null,name:string):Promise<AdminGroupItem> {
  const snapshot=scope(),key=catalogJournalKey();
  if(!groupId&&pendingCoreCatalog())throw new Error("Сначала проверьте результат предыдущего создания");
  const before=groupId?[]:(await coreGroups()).map(g=>g.id);assertScope(snapshot);
  try {const result=await domain<{id:number}>(`/core/groups${groupId?`/${id(groupId)}`:""}`,{method:groupId?"PUT":"POST",body:JSON.stringify({name:name.trim()})});return {group_id:result.id,group_name:name.trim()};}
  catch(error) {const e=coreError(error); if(coreUncertain(error)){if(!groupId)sessionStorage.setItem(key,JSON.stringify({scope:snapshot,kind:"group",name:name.trim(),before}));e.message="Ответ не получен. Обновите список и проверьте группу перед повторным созданием.";} throw e;}
}
