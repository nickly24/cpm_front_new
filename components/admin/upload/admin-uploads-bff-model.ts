import type { UploadSession } from "@/lib/bff/uploads";

export type PreviewValue = string | number | null;
export type PreviewInput = Record<string, PreviewValue>;
export interface PreviewRow {
  id:string; source:number; input:PreviewInput; excluded:boolean; errors:string[]; warnings:string[];
  literalErrors?:boolean; caption?:string; candidates?:{account_id:number; full_name:string}[];
  unavailableFields?:string[];
}
export interface PreviewView {
  kind:"core"|"legacy"|"cards"|"transform"|"exams"|"tests"|"external"|"unsupported";
  rows:PreviewRow[]; total:number; partial:boolean; collision:boolean; target:string; ownerState:string; valid:boolean;
  nativeCanCommit?:boolean; fields?:string[]; summary?:{label:string; value:PreviewValue}[]; issues?:string[];
  editBlockedReason?:string;
}
export const legacyFields = ["full_name", "class_raw", "school_name", "proctor_name", "tg_name"];
export const externalFields = ["full_name", "account_id", "legacy_student_id", "percent", "correct_count", "completed_at", "time_spent", "login"];
const externalIdFields = ["account_id", "legacy_student_id"];
const externalIdEditNotice = "ID вне поддерживаемого диапазона редактирования; используйте исходный XLSX с текстовыми IDs";
const unsupportedExternalId = (value:unknown) => typeof value === "number" && !Number.isSafeInteger(value) || typeof value === "string" && /^[0-9]+$/.test(value.trim()) && !Number.isSafeInteger(Number(value));
const record = (value:unknown):Record<string,unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
const text = (value:unknown) => typeof value === "string" ? value : "";
const count = (value:unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
const input = (value:unknown, fields:string[]):PreviewInput => {
  const row=record(value), result:PreviewInput={};
  for (const field of fields) if (row[field] === null || typeof row[field] === "string" || typeof row[field] === "number") result[field]=row[field] as PreviewValue;
  return result;
};
const summary = (raw:unknown, fields:Record<string,string>) => {
  const values=record(raw);
  return Object.entries(fields).flatMap(([field,label]) => count(values[field]) === null ? [] : [{label,value:values[field] as number}]);
};
const distinct = (rows:PreviewRow[]) => rows.every(row => !!row.id && row.source > 0) && new Set(rows.map(row => row.id)).size === rows.length;
const scoped = (raw:Record<string,unknown>, session:UploadSession) => raw.organization_id === session.organization_id && raw.division_id === session.division_id;

/** Native owners supply matching, grading, errors and confirmation decisions. No domain revalidation here. */
export function nativeUploadView(session:UploadSession):PreviewView|null {
  const owner=record(session.preview), preview=record(owner.preview);
  const base={rows:[] as PreviewRow[],total:0,partial:false,collision:false,target:"",ownerState:text(owner.state || owner.status),valid:false};
  if (session.type === "users.legacy") {
    const students=Array.isArray(preview.students)?preview.students:[];
    const rows:PreviewRow[]=students.map(value=>{
      const row=record(value);
      return {id:String(row.row),source:count(row.row)??0,input:input(row,legacyFields),excluded:row.action === "skip",errors:Array.isArray(row.errors)?row.errors.map(value=>text(value)||"Источник не подтвердил строку"): ["Источник не подтвердил строку"],warnings:[],literalErrors:true,caption:row.action === "skip" ? "Ученик уже существует: будет пропущен" : row.action === "create" ? "Создание ученика" : "Нужно исправить строку"};
    });
    const total=count(record(preview.summary).total_rows)??0, max=count(owner.max_rows)??0;
    return {...base,kind:"legacy",rows,total,partial:total!==rows.length,fields:legacyFields,nativeCanCommit:preview.can_commit === true,
      valid:scoped(owner,session) && owner.actor_id === session.actor_account_id && typeof preview.can_commit === "boolean" && Array.isArray(preview.students) && max>0 && max<=100 && total<=max && distinct(rows) && students.every(value=>legacyFields.every(field=>typeof record(value)[field] === "string")),
      summary:summary(preview.summary,{students_create:"Ученики: создать",students_skip:"Ученики: пропустить",row_errors:"Строк с ошибками",schools_create:"Школы: создать",schools_existing:"Школы: использовать",proctors_create:"Прокторы: создать",proctors_existing:"Прокторы: использовать",groups_create:"Группы: создать",groups_existing:"Группы: использовать",students_without_group:"Ученики без группы"})};
  }
  if (session.type === "tests.external-results") {
    const values=Array.isArray(preview.rows)?preview.rows:[];
    const rows:PreviewRow[]=values.map(value=>{
      const row=record(value);
      const fields=input(row,externalFields), unavailableFields=externalIdFields.filter(field=>typeof row[field] === "number" && !Number.isSafeInteger(row[field]));
      // The original exact value cannot be recovered from an unsafe JSON number.
      // Keep exact textual IDs visible, and never render a rounded number as an ID.
      for (const field of unavailableFields) delete fields[field];
      return {id:text(row.row_id),source:count(row.row)??0,input:fields,unavailableFields,excluded:false,
        errors:Array.isArray(row.errors)?row.errors.map(value=>text(record(value).code)||"unknown_owner_issue"): ["unknown_owner_issue"],warnings:[],
        caption:text(row.student_full_name) ? `Сопоставлен: ${text(row.student_full_name)}` : "Сопоставление выполняет источник",
        candidates:Array.isArray(row.candidates)?row.candidates.flatMap(value=>{const candidate=record(value);return count(candidate.account_id) && text(candidate.full_name)?[{account_id:candidate.account_id as number,full_name:text(candidate.full_name)}]:[];}):[]};
    });
    const total=count(record(preview.summary).total_rows)??0;
    return {...base,kind:"external",rows,total,partial:total!==rows.length,fields:externalFields,target:`Внешний тест: ${session.target_id??"—"}`,nativeCanCommit:preview.can_commit === true,
      editBlockedReason:values.some(value=>externalIdFields.some(field=>unsupportedExternalId(record(value)[field])))?externalIdEditNotice:undefined,
      valid:scoped(preview,session) && preview.test_id === session.target_id && typeof preview.can_commit === "boolean" && Array.isArray(preview.rows) && total<=5000 && distinct(rows),
      summary:summary(preview.summary,{import_rows:"Результаты к импорту",row_errors:"Строк с ошибками",matched_students:"Сопоставлено учеников",duplicate_rows:"Повторов",existing_results:"Существующих результатов"})};
  }
  if (session.type === "tests.json") {
    const test=record(preview.preview), questions=Array.isArray(test.questions)?test.questions:[];
    const rows:PreviewRow[]=questions.map((value,index)=>{
      const question=record(value), values=input(question,["question_id","type","text","points"]);
      values.answers=Array.isArray(question.answers)?question.answers.map(value=>{const answer=record(value);return `${answer.is_correct === true?"✓ ":""}${text(answer.text)}`;}).join("\n"):"";
      values.correct_answers=Array.isArray(question.correct_answers)?question.correct_answers.filter(value=>typeof value === "string").join("\n"):"";
      return {id:String(question.question_id || index+1),source:index+1,input:values,excluded:false,errors:[],warnings:[]};
    });
    const total=count(record(preview.summary).questions_total)??0;
    const issues=Array.isArray(preview.errors)?preview.errors.map(value=>{const error=record(value);return `${text(error.path)}: ${text(error.message)||"Источник не подтвердил данные"}`;}):[];
    const settings=record(test.settings);
    return {...base,kind:"tests",rows,total,partial:total!==rows.length,fields:["question_id","type","text","points","answers","correct_answers"],nativeCanCommit:preview.valid === true,
      target:[text(test.title)||text(preview.source_title),text(test.direction_name)].filter(Boolean).join(" · "),
      valid:scoped(preview,session) && typeof preview.valid === "boolean" && Array.isArray(test.questions) && Array.isArray(preview.errors) && Array.isArray(preview.warnings),
      summary:[...summary(preview.summary,{total_points:"Баллов по источнику",single_count:"Один ответ",multiple_count:"Несколько ответов",text_count:"Текстовый ответ",errors_count:"Ошибок"}),{label:"Публикация",value:settings.published === true?"Да":"Нет"},{label:"Показывать ответы",value:settings.answers_visible === true?"Да":"Нет"},...summary(settings,{time_limit_minutes:"Лимит, минут"})],
      issues:[...issues,...(Array.isArray(preview.warnings)?preview.warnings.map(value=>text(value)).filter(Boolean):[])]};
  }
  return null;
}

/** Whole native snapshot, including untouched rows on other pages; no scope or coordinator revision. */
export function nativeUploadEditPayload(session:UploadSession, changes:Record<string,{input:PreviewInput;excluded:boolean}>):Record<string,unknown>|null {
  const current=nativeUploadView(session);
  if (!current || !["legacy","external"].includes(current.kind)) return null;
  if (current.editBlockedReason) throw new Error(current.editBlockedReason);
  if (!current.valid || current.partial) throw new Error("Нужен полный предпросмотр источника");
  if (Object.keys(changes).some(id=>!current.rows.some(row=>row.id === id))) throw new Error("Строка больше не существует. Обновите предпросмотр.");
  const rows=current.rows.map(row=>{
    const values=changes[row.id]?.input??row.input;
    if (current.kind === "legacy") return {row:row.source,...Object.fromEntries(legacyFields.map(field=>[field,text(values[field])]))};
    const result:Record<string,unknown>={row_id:row.id,row:row.source};
    for (const field of externalFields) {
      const value=values[field];
      if (["account_id","legacy_student_id","percent","correct_count"].includes(field)) {
        if (value===null || value===undefined || typeof value === "string" && !value.trim()) {if(field === "percent")result.percent=null;continue;}
        const numeric=typeof value === "number"?value:Number(value);
        if (!Number.isFinite(numeric) || field!=="percent" && !Number.isSafeInteger(numeric)) throw new Error("Числовое поле нельзя передать источнику. Исправьте формат значения.");
        result[field]=numeric;
      } else if (value!==undefined) result[field]=text(value);
    }
    return result;
  });
  return {rows};
}
