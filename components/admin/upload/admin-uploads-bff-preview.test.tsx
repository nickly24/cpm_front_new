import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { UploadSession } from "@/lib/bff/uploads";
import { AdminUploadsBffPreview, uploadPreviewCanCommit, uploadPreviewEditPayload } from "./admin-uploads-bff-preview";

const session = (type: string, preview: unknown, patch: Partial<UploadSession> = {}): UploadSession => ({
  id: "a".repeat(32), organization_id: 1, division_id: 2, actor_account_id: 3, type, owner: type.split(".")[0],
  revision: 2, owner_revision: 4, state: "preview", preview, expires_at: "2099-01-01T00:00:00Z", created_at: "2026-10-09T00:00:00Z", ...patch,
});
const cards = (extra: Record<string, unknown> = {}) => session("cards.xlsx", { state: "preview", preview: { direction_id: 5, theme_id: 6, cards: [
  { row: 2, question: "Вопрос\nсо второй строкой", answer: "Ответ\nещё строка", action: "create", errors: [], warnings: [] },
  { row: 7, question: "Другой вопрос", answer: "Другой ответ", action: "warning", errors: [], warnings: ["duplicate_in_file"] },
], ...extra } });
const exam = (rows: unknown[], extra: Record<string, unknown> = {}) => session("exams.outside", { state: "editable", rows, ...extra });

describe("owner upload preview boundary", () => {
  it("sends every cards row in source order, keeping multiline answers and excluded edits without a revision", () => {
    const original = cards();
    const payload = uploadPreviewEditPayload(original, { "2": { input: { question: "Исправлено\nполностью", answer: "Сохранить\nпереносы", password: "never-forward" }, excluded: false }, "7": { input: { question: "Второй", answer: "" }, excluded: true } });
    expect(payload).toEqual({ cards: [{ row: 2, question: "Исправлено\nполностью", answer: "Сохранить\nпереносы", skip: false }, { row: 7, question: "Второй", answer: "", skip: true }] });
    expect(JSON.stringify(payload)).not.toContain("expected_revision");
    expect(JSON.stringify(original)).toContain("Другой ответ");
  });
  it("keeps rows outside the visible page when one card is edited", () => {
    const rows = Array.from({ length: 55 }, (_, i) => ({ row: i + 2, question: `Q${i}`, answer: `A${i}`, action: "create", errors: [], warnings: [] }));
    const payload = uploadPreviewEditPayload(cards({ cards: rows }), { "2": { input: { question: "Edited", answer: "A0" }, excluded: false } });
    expect((payload.cards as unknown[])).toHaveLength(55);
    expect((payload.cards as unknown[]).at(-1)).toEqual({ row: 56, question: "Q54", answer: "A54", skip: false });
  });
  it("distinguishes blocking errors from warnings and explicit skipped rows", () => {
    expect(uploadPreviewCanCommit(cards())).toBe(true);
    const rows = [{ row: 2, question: "Q", answer: "A", action: "error", errors: ["invalid_answer"], warnings: [] }];
    expect(uploadPreviewCanCommit(cards({ cards: rows }))).toBe(false);
    expect(uploadPreviewCanCommit(cards({ cards: [{ ...rows[0], action: "skip" }] }))).toBe(false);
    expect(uploadPreviewCanCommit(cards({ cards: [...rows.map(row => ({ ...row, action: "skip" })), { row: 3, question: "Q2", answer: "A2", action: "create", errors: [], warnings: [] }] }))).toBe(true);
    expect(uploadPreviewCanCommit(cards({ cards: [{ ...rows[0], errors: [], answer: "" }] }))).toBe(false);
  });
  it("reports a theme name collision as append to a verified existing target", () => {
    expect(uploadPreviewCanCommit(cards({ create_new_theme: true, new_theme_name: "Существующая", theme_name_collision: true }))).toBe(true);
    expect(uploadPreviewCanCommit(cards({ create_new_theme: true, new_theme_name: "Существующая", theme_name_collision: true, theme_id: 0 }))).toBe(false);
  });
  it("preserves a genuine zero grade and points, sends only changed exam rows and strips unknown/secret fields", () => {
    const rows = [{ row_id: "row-2", source_row: 2, input: { studentId: 33, points: 2, grade: 2, examinator: "Экзаменатор" }, errors: [], excluded: false }, { row_id: "row-3", source_row: 3, input: { studentId: 34, points: 1, grade: 1, examinator: "Экзаменатор" }, errors: [], excluded: false }];
    const payload = uploadPreviewEditPayload(exam(rows), { "row-2": { input: { studentId: "33", points: "0", grade: "0", examinator: "Экзаменатор", token: "never-forward", expected_revision: 99 }, excluded: false } });
    expect(payload).toEqual({ changes: [{ row_id: "row-2", input: { studentId: 33, points: 0, grade: 0, examinator: "Экзаменатор" }, excluded: false }] });
  });
  it("rejects invalid numeric input before it can become JSON null or a rounded account ID", () => {
    const original = exam([{ row_id: "row-2", source_row: 2, input: {}, errors: ["invalid_grade"], excluded: false }]);
    for (const value of ["not a number", "6", "1.5"]) expect(() => uploadPreviewEditPayload(original, { "row-2": { input: { grade: value }, excluded: false } })).toThrow();
    expect(() => uploadPreviewEditPayload(original, { "row-2": { input: { studentId: "9007199254740993" }, excluded: false } })).toThrow();
  });
  it("allows excluding invalid numeric input without sending unknown fields or authorizing its inclusion", () => {
    const original = exam([{ row_id: "row-2", source_row: 2, input: { grade: "invalid" }, errors: ["invalid_grade"], excluded: false }]);
    expect(uploadPreviewEditPayload(original, { "row-2": { input: { grade: "invalid", password: "never-forward" }, excluded: true } })).toEqual({ changes: [{ row_id: "row-2", input: { grade: "invalid" }, excluded: true }] });
    expect(uploadPreviewCanCommit(original)).toBe(false);
  });
  it("does not discard unknown diagnostics or an owner error action with an empty errors array", () => {
    for (const errors of [[{ message: "secret diagnostic" }], "secret diagnostic", []]) expect(uploadPreviewCanCommit(cards({ cards: [{ row: 2, question: "Q", answer: "A", action: "error", errors }] }))).toBe(false);
  });
  it("does not authorize a commit from the first server page of a larger exam preview", () => {
    const partial = exam([{ row_id: "row-2", source_row: 2, input: {}, errors: [], excluded: false }], { total: 150 });
    expect(uploadPreviewCanCommit(partial)).toBe(false);
    expect(() => uploadPreviewEditPayload(partial, {})).toThrow();
    expect(uploadPreviewCanCommit(exam([{ row_id: "row-2", source_row: 2, input: {}, errors: ["student_not_found"], excluded: false }]))).toBe(false);
  });
  it("allows Core's validated creation count while rejecting an empty actual users list", () => {
    expect(uploadPreviewCanCommit(session("users.credentials", { id: 1, rows: 3 }))).toBe(true);
    expect(uploadPreviewCanCommit(session("users.credentials", { id: 1, users: [], rows: 3 }))).toBe(false);
    expect(uploadPreviewCanCommit(session("users.credentials", { id: 1, rows: 101 }))).toBe(false);
    expect(() => uploadPreviewEditPayload(session("users.credentials", { users: [{ full_name: "Ученик" }] }), {})).toThrow();
  });
  it("never permits editing/committing expired, completed, unknown or malformed snapshots", () => {
    const original = cards();
    for (const patch of [{ expires_at: "2020-01-01T00:00:00Z" }, { expires_at: "invalid" }, { state: "completed" }, { state: "edit_unknown" }]) expect(uploadPreviewCanCommit({ ...original, ...patch })).toBe(false);
    expect(uploadPreviewCanCommit({ ...original, preview: { ...original.preview as Record<string, unknown>, state: "completed" } })).toBe(false);
    expect(uploadPreviewCanCommit(cards({ cards: [] }))).toBe(false);
    expect(uploadPreviewCanCommit(cards({ cards: [{ row: 2, question: "Q", answer: "A" }, { row: 2, question: "Q2", answer: "A2" }] }))).toBe(false);
    expect(() => uploadPreviewEditPayload(original, { unknown: { input: {}, excluded: false } })).toThrow();
  });
  it("renders only documented Core columns and masks unknown owner diagnostics", () => {
    const data = session("users.credentials", { users: [{ full_name: "Ученик", role: "student", class: 0, login: "learner", password: "TOP_SECRET", secret: "TOKEN_SECRET", errors: ["password=PRIVATE_ERROR"] }] });
    const html = renderToStaticMarkup(createElement(AdminUploadsBffPreview, { session: data, editable: true, busy: false, onSave: async () => {} }));
    expect(html).toContain("Ученик");
    expect(html).not.toContain("TOP_SECRET"); expect(html).not.toContain("TOKEN_SECRET"); expect(html).not.toContain("PRIVATE_ERROR");
    expect(html).not.toContain("textarea");
  });
  it("renders completed transformation content in its saved order without edit controls", () => {
    const data = session("cards.transform", { state: "completed", preview: { draft_title: "Снимок темы", selected_cards: [{ id: 7, question: "Сначала", answer: "Один\nДва" }, { id: 3, question: "Потом", answer: "Ответ" }] } }, { state: "completed" });
    const html = renderToStaticMarkup(createElement(AdminUploadsBffPreview, { session: data, editable: true, busy: false, onSave: async () => {} }));
    expect(html.indexOf("Сначала")).toBeLessThan(html.indexOf("Потом"));
    expect(html).toContain("Один\nДва"); expect(html).toContain("Снимок темы"); expect(html).not.toContain("textarea");
    expect(uploadPreviewCanCommit(data)).toBe(false);
  });
});

const rawLegacyRow = (row:number) => ({row,full_name:`Ученик ${row}`,class_raw:" 7,5 ",school_name:"Школа",proctor_name:"Проктор Один",tg_name:"",action:"create",errors:[]});
const legacy = (rows:unknown[], extra:Record<string,unknown>={}) => session("users.legacy",{id:17,organization_id:1,division_id:2,actor_id:3,revision:4,max_rows:100,status:"preview",preview:{students:rows,summary:{total_rows:rows.length,students_create:rows.length,students_skip:0,row_errors:0,schools_create:1,groups_create:1,proctors_create:1},can_commit:true,...extra}});
const external = (rows:unknown[], extra:Record<string,unknown>={}) => session("tests.external-results",{state:"preview",preview:{organization_id:1,division_id:2,test_id:"e".repeat(24),revision:8,rows,summary:{total_rows:rows.length,import_rows:rows.length,row_errors:0,matched_students:rows.length,duplicate_rows:0,existing_results:0},can_commit:true,...extra}},{target_id:"e".repeat(24)});
const externalRow = {row_id:"source-7",row:7,full_name:"Ученик Один",percent:0,correct_count:60,account_id:33,student_full_name:"Ученик Один",action:"import",errors:[],candidates:[]};

describe("native legacy and Tests Uploads previews",()=>{
  it("edits a whole legacy snapshot across pages, preserving raw class/name/multiline without generated IDs or revisions",()=>{
    const rows=Array.from({length:55},(_,i)=>rawLegacyRow(i+2)), current=legacy(rows);
    const payload=uploadPreviewEditPayload(current,{"2":{input:{full_name:" Исправленное ФИО ",class_raw:"7,5",school_name:"Первая\nВторая",proctor_name:"",tg_name:"",password:"SECRET",organization_id:9},excluded:false}});
    expect((payload.rows as unknown[])).toHaveLength(55);
    expect((payload.rows as unknown[])[0]).toEqual({row:2,full_name:" Исправленное ФИО ",class_raw:"7,5",school_name:"Первая\nВторая",proctor_name:"",tg_name:""});
    expect((payload.rows as unknown[]).at(-1)).toEqual({row:56,full_name:"Ученик 56",class_raw:" 7,5 ",school_name:"Школа",proctor_name:"Проктор Один",tg_name:""});
    expect(JSON.stringify(payload)).not.toMatch(/expected_revision|SECRET|organization_id|action/);
  });
  it("uses Core can_commit instead of recomputing matching or treating existing skipped students as new",()=>{
    expect(uploadPreviewCanCommit(legacy([rawLegacyRow(2)],{can_commit:false}))).toBe(false);
    expect(uploadPreviewCanCommit(legacy([{...rawLegacyRow(2),action:"skip"}],{can_commit:false,summary:{total_rows:1,students_create:0,students_skip:1}}))).toBe(false);
    expect(uploadPreviewCanCommit(legacy([rawLegacyRow(2)]))).toBe(true);
    const partial=legacy([rawLegacyRow(2)],{summary:{total_rows:55},can_commit:true});
    expect(uploadPreviewCanCommit(partial)).toBe(false);expect(()=>uploadPreviewEditPayload(partial,{})).toThrow();
    expect(uploadPreviewCanCommit(legacy(Array.from({length:101},(_,i)=>rawLegacyRow(i+2))))).toBe(false);
  });
  it("renders Core summary, public validation and reset-required policy without secrets or skip overrides",()=>{
    const current=legacy([{...rawLegacyRow(2),action:"error",errors:["Создание школы требует полного администратора организации"],password:"SECRET"}],{can_commit:false});
    const html=renderToStaticMarkup(createElement(AdminUploadsBffPreview,{session:current,editable:true,busy:false,onSave:async()=>{}}));
    expect(html).toContain("Школы: создать");expect(html).toContain("Создание школы требует полного администратора организации");expect(html).toContain("сброса пароля");expect(html).toContain("textarea");expect(html).not.toContain("SECRET");expect(html).not.toContain("Исключить строку");
  });
  it("roundtrips external raw percentage zero and decimal, optional null and explicit account matching without owner diagnostics",()=>{
    const current=external([externalRow,{...externalRow,row_id:"source-9",row:9,percent:null,account_id:null,errors:[{code:"student_ambiguous",field:"full_name",message:"opaque PRIVATE"}],candidates:[{account_id:34,legacy_student_id:7,full_name:"Ученик Два"}]}],{can_commit:false});
    const payload=uploadPreviewEditPayload(current,{"source-9":{input:{full_name:"Ученик Два",percent:"17.75",correct_count:"60",account_id:"34",password:"SECRET"},excluded:false}});
    expect(payload).toEqual({rows:[{row_id:"source-7",row:7,full_name:"Ученик Один",account_id:33,percent:0,correct_count:60},{row_id:"source-9",row:9,full_name:"Ученик Два",account_id:34,percent:17.75,correct_count:60}]});
    const html=renderToStaticMarkup(createElement(AdminUploadsBffPreview,{session:current,editable:true,busy:false,onSave:async()=>{}}));
    expect(html).toContain("Ученик Два · 34");expect(html).not.toContain("PRIVATE");expect(html).not.toContain("SECRET");expect(uploadPreviewCanCommit(current)).toBe(false);
    const nullPayload=uploadPreviewEditPayload(external([{...externalRow,percent:null}]),{});
    expect((nullPayload.rows as {percent:number|null}[])[0].percent).toBeNull();
  });
  it("never displays an unsafe numeric account/profile ID as exact or permits editing other rows around it",()=>{
    const unsafe=JSON.parse('{"account_id":9007199254740993,"legacy_student_id":9223372036854775807}') as Record<string,number>;
    for(const field of ["account_id","legacy_student_id"]){
      const current=external([{...externalRow,[field]:unsafe[field]},{...externalRow,row_id:"source-9",row:9,account_id:34,percent:null}],{can_commit:false});
      const html=renderToStaticMarkup(createElement(AdminUploadsBffPreview,{session:current,editable:true,busy:false,onSave:async()=>{}}));
      expect(html).toContain("ID вне поддерживаемого диапазона редактирования");
      expect(html).toContain("используйте исходный XLSX с текстовыми IDs");
      expect(html).toContain("ID не отображается: точное значение недоступно");
      expect(html).not.toContain(String(unsafe[field]));expect(html).not.toContain("textarea");
      expect(()=>uploadPreviewEditPayload(current,{"source-9":{input:{full_name:"Другой ученик",account_id:34,percent:"0"},excluded:false}})).toThrow("ID вне поддерживаемого диапазона редактирования");
    }
  });
  it("keeps an exact textual int64 ID readonly and blocks a whole-snapshot edit even beyond the visible page",()=>{
    const exact="9223372036854775807", current=external([{...externalRow,legacy_student_id:exact}],{can_commit:false});
    const html=renderToStaticMarkup(createElement(AdminUploadsBffPreview,{session:current,editable:true,busy:false,onSave:async()=>{}}));
    expect(html).toContain(exact);expect(html).not.toContain("textarea");
    expect(()=>uploadPreviewEditPayload(current,{})).toThrow("исходный XLSX с текстовыми IDs");
    const rows=Array.from({length:55},(_,i)=>({...externalRow,row_id:`row-${i+2}`,row:i+2,account_id:i===54?Number.MAX_SAFE_INTEGER+1:33}));
    const paged=external(rows,{can_commit:false});
    const pagedHtml=renderToStaticMarkup(createElement(AdminUploadsBffPreview,{session:paged,editable:true,busy:false,onSave:async()=>{}}));
    expect(pagedHtml).toContain("ID вне поддерживаемого диапазона редактирования");expect(pagedHtml).not.toContain("textarea");
    expect(()=>uploadPreviewEditPayload(paged,{"row-2":{input:{account_id:33,percent:"17.75"},excluded:false}})).toThrow();
  });
  it("keeps safe textual account IDs editable and genuine percentage zero/null unchanged",()=>{
    const current=external([{...externalRow,account_id:"33",legacy_student_id:null,percent:0},{...externalRow,row_id:"source-9",row:9,account_id:34,percent:null}],{can_commit:false});
    const html=renderToStaticMarkup(createElement(AdminUploadsBffPreview,{session:current,editable:true,busy:false,onSave:async()=>{}}));
    expect(html).toContain("textarea");expect(html).not.toContain("диапазона редактирования");
    const payload=uploadPreviewEditPayload(current,{}) as {rows:{account_id:number;percent:number|null}[]};
    expect(payload.rows.map(row=>[row.account_id,row.percent])).toEqual([[33,0],[34,null]]);
  });
  it("leaves external grading entirely to Tests and requires its exact pinned preview scope and full rows",()=>{
    expect(uploadPreviewCanCommit(external([{...externalRow,percent:0,correct_count:999}]))).toBe(true);
    expect(uploadPreviewCanCommit(external([externalRow],{can_commit:false}))).toBe(false);
    for(const patch of [{organization_id:8},{division_id:8},{test_id:"f".repeat(24)},{summary:{total_rows:2}},{rows:[]}])expect(uploadPreviewCanCommit(external([externalRow],patch))).toBe(false);
    const foreign={...legacy([rawLegacyRow(2)]),actor_account_id:4};expect(uploadPreviewCanCommit(foreign)).toBe(false);
  });
  it("renders normalized JSON/OTP questions, keys, owner summary and warnings without evaluating source or inventing an editable payload",()=>{
    const current=session("tests.json",{state:"preview",preview:{valid:true,organization_id:1,division_id:2,direction_id:5,source:"online_test_pad",source_title:"Источник",preview:{title:"Нормализованный тест",direction_name:"Математика",questions:[{question_id:7,type:"single",text:"Вопрос\nпродолжение",points:5,answers:[{id:"a",text:"Правильно",is_correct:true},{id:"b",text:"Иное",is_correct:false}],correct_answers:[]}],settings:{published:false,answers_visible:false,time_limit_minutes:0}},summary:{questions_total:1,total_points:5,single_count:1,multiple_count:0,text_count:0,errors_count:0},errors:[],warnings:["Публикация проверена источником"],sourceText:"EVIL_SECRET",password:"SECRET"}});
    expect(uploadPreviewCanCommit(current)).toBe(true);expect(()=>uploadPreviewEditPayload(current,{})).toThrow();
    const html=renderToStaticMarkup(createElement(AdminUploadsBffPreview,{session:current,editable:true,busy:false,onSave:async()=>{}}));
    expect(html).toContain("Нормализованный тест");expect(html).toContain("Вопрос\nпродолжение");expect(html).toContain("✓ Правильно");expect(html).toContain("Баллов по источнику");expect(html).toContain("Публикация проверена источником");expect(html).not.toContain("textarea");expect(html).not.toContain("SECRET");
    const owner=current.preview as {preview:Record<string,unknown>};
    expect(uploadPreviewCanCommit({...current,preview:{...owner,preview:{...owner.preview,valid:false,errors:[{path:"Questions[0]",message:"Не подтверждено"}]}}})).toBe(false);
  });
});
