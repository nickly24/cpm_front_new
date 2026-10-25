// @vitest-environment jsdom
import { it,expect,vi } from "vitest";
import { render,screen,fireEvent,waitFor,cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import type { UploadSession } from "@/lib/bff/uploads";
import { AdminUploadsBffPreview,uploadPreviewCanCommit,uploadPreviewEditPayload } from "./admin-uploads-bff-preview";
import { nativeUploadView } from "./admin-uploads-bff-model";
afterEach(cleanup);
interface TableOwner { source_table:{ rows:Record<string,unknown>[] }; preview:{ errors:{path:string;message:string}[]; preview:{ questions:{question_id:number}[] } } }
const fixture=(valid=false):UploadSession=>({id:"a".repeat(32),organization_id:1,division_id:2,actor_account_id:3,type:"tests.json",owner:"tests",revision:2,owner_revision:4,state:"preview",expires_at:"2099-01-01T00:00:00Z",created_at:"2026-10-25T00:00:00Z",preview:{state:"preview",source_table:{importFormat:"question_table",metadata:{timeLimitMinutes:30,published:false},rows:[{row:8,title:"Пример",number:"7",question:"Первый?",options:"А. Да\nБ. Нет",answer:valid?"А. Да":"Д. Другой"},{row:12,title:"Пример",number:"9",question:"Второй?",answer:"Ответ"}]},preview:{organization_id:1,division_id:2,direction_id:5,valid,errors:valid?[]:[{path:"rows[0].answer",message:"Строка 8: неизвестная метка правильного ответа Д"}],warnings:[],summary:{questions_total:2,errors_count:valid?0:1},preview:{title:"Пример",questions:[{question_id:7},{question_id:9}]}}}});
it("shows bad and good questions, physical rows and cell errors; saves full edited source and rechecks before commit",async()=>{
 const before=fixture(),saved=vi.fn().mockResolvedValue(undefined);
 const {rerender}=render(<AdminUploadsBffPreview session={before} editable busy={false} onSave={saved}/>);
 fireEvent.click(screen.getByRole("button",{name:"Изменить вопрос 7"}));
 expect(screen.getByText("Строка Excel 8")).toBeTruthy();expect(screen.getByRole("button",{name:"Изменить вопрос 9"})).toBeTruthy();
 expect(screen.getByLabelText("Правильный ответ, строка 8").getAttribute("aria-invalid")).toBe("true");
 expect(uploadPreviewCanCommit(before)).toBe(false);
 fireEvent.click(screen.getByLabelText("Только строки с ошибками"));
 expect(screen.queryByRole("button",{name:"Изменить вопрос 9"})).toBeNull();
 fireEvent.change(screen.getByLabelText("Правильный ответ, строка 8"),{target:{value:"А. Да"}});
 fireEvent.click(screen.getByText("Сохранить правки"));
 await waitFor(()=>expect(saved).toHaveBeenCalledTimes(1));
 const payload=saved.mock.calls[0][0];expect(payload.payload.rows).toHaveLength(2);expect(payload.payload.rows[0].answer).toBe("А. Да");expect(payload.payload.rows[1].row).toBe(12);
 expect(uploadPreviewCanCommit(before)).toBe(false);
 const after=fixture(true);rerender(<AdminUploadsBffPreview key="new-revision" session={{...after,revision:3}} editable busy={false} onSave={saved}/>);
 fireEvent.click(screen.getByRole("button",{name:"Изменить вопрос 7"}));
 expect(screen.getByLabelText("Правильный ответ, строка 8").getAttribute("aria-invalid")).toBe("false");expect(uploadPreviewCanCommit(after)).toBe(true);
});
it("retains unedited source errors and every off-page row, without forwarding credentials or scope",()=>{
 const ss=fixture(),owner=ss.preview as TableOwner;
 owner.source_table.rows[0].cell_errors={answer:"Excel error",question:"Excel error"};
 for(let i=0;i<55;i++) {owner.source_table.rows.push({row:i+20,number:String(i+20),question:`Q${i}`,answer:"A"});owner.preview.preview.questions.push({question_id:i+20});}
 const view=nativeUploadView(ss)!;
 const payload=uploadPreviewEditPayload(ss,{"source-0":{input:{...view.rows[0].input,answer:"А. Да",token:"private"},excluded:false}}) as {payload:{rows:Record<string,unknown>[]}};
 expect(payload.payload.rows).toHaveLength(57);expect(payload.payload.rows[0].cell_errors).toEqual({question:"Excel error"});expect(JSON.stringify(payload)).not.toMatch(/private|organization_id|expected_revision/);
 expect(()=>uploadPreviewEditPayload(ss,{missing:{input:{},excluded:false}})).toThrow();
});
it("maps normalized question validation to the physical field and blocks invalid or partial snapshots",()=>{
 const ss=fixture();const owner=ss.preview as TableOwner;
 owner.preview.errors=[{path:"questions[1].text",message:"Текст обязателен"}];
 expect(nativeUploadView(ss)!.rows[1].fieldErrors?.question).toEqual(["Текст обязателен"]);
 owner.preview.preview.questions.pop();expect(()=>uploadPreviewEditPayload(ss,{})).toThrow();expect(uploadPreviewCanCommit(ss)).toBe(false);
});
it("keeps the edited file open and blocked when saving cannot be confirmed",async()=>{
 const ss=fixture(),save=vi.fn().mockRejectedValue(new Error("offline"));
 render(<AdminUploadsBffPreview session={ss} editable busy={false} onSave={save}/>);
 fireEvent.click(screen.getByRole("button",{name:"Изменить вопрос 7"}));
 fireEvent.change(screen.getByLabelText("Правильный ответ, строка 8"),{target:{value:"А. Да"}});
 fireEvent.click(screen.getByText("Сохранить правки"));
 await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("Изменения не подтверждены"));
 expect((screen.getByLabelText("Правильный ответ, строка 8") as HTMLTextAreaElement).value).toBe("А. Да");
 expect(screen.getByRole("button",{name:"Изменить вопрос 9"})).toBeTruthy();expect(uploadPreviewCanCommit(ss)).toBe(false);
});

it("shows 50 compact questions with just one editor open and excludes notes from edits",()=>{
 const ss=fixture(true),owner=ss.preview as TableOwner;
 owner.source_table.rows=Array.from({length:50},(_,i)=>({row:i+2,number:String(i+1),title:"Тест",question:`Вопрос ${i+1}`,answer:"Ответ",note:"Допустимо: «лишний»"}));
 owner.preview.preview.questions=Array.from({length:50},(_,i)=>({question_id:i+1}));
 render(<AdminUploadsBffPreview session={ss} editable busy={false} onSave={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText("Строк на странице"),{target:{value:"50"}});
 expect(screen.getAllByRole("button",{name:/Изменить вопрос/})).toHaveLength(50);
 expect(screen.queryAllByRole("textbox")).toHaveLength(0);
 fireEvent.click(screen.getByRole("button",{name:"Изменить вопрос 1"}));
 expect(screen.getAllByRole("textbox")).toHaveLength(6);
 expect(screen.queryByText("Примечание")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Изменить вопрос 50"}));
 expect(screen.getAllByRole("textbox")).toHaveLength(6);
 expect(screen.queryByLabelText("Вопрос, строка 2")).toBeNull();
 const payload=uploadPreviewEditPayload(ss,{}) as {payload:{rows:Record<string,unknown>[]}};
 expect(payload.payload.rows).toHaveLength(50);expect(JSON.stringify(payload)).not.toContain("лишний");
});
