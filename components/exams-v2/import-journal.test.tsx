// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
const state=vi.hoisted(()=>({execute:vi.fn()}));
vi.mock("@/lib/exams-v2/hooks",()=>({
 useExamResource:()=>({data:{session:{id:"session",previewVersion:1,status:"editable",rows:[1,2].map(i=>({rowId:`r${i}`,sourceRow:i+1,input:{studentLogin:`learner${i}`,commissionMemberIds:[30]},excluded:false,errors:[],warnings:[]})),summary:{total:40,included:40,excluded:0,errors:0,conflicts:0},pagination:{page:1,limit:20,total:40,totalPages:2,hasPrev:false,hasNext:true}}},loading:false,error:null,reload:vi.fn()}),
 useExamMutation:()=>({busy:false,uncertain:false,error:null,execute:state.execute,retry:vi.fn(),dismiss:vi.fn()})
}));
import { PreviewEditor } from "./import";
afterEach(cleanup);
describe("compact import journal",()=>{
 it("opens one row editor, retains edits across expansion and blocks pagination and commit until save",()=>{
  render(<PreviewEditor sessionId="session" prefix="/api/exams/31/imports/assignments" storageKey="test" reset={()=>{}} actor="9" examId={31} canEdit onChanged={()=>{}}/>);
  expect(screen.getAllByRole("textbox")).toHaveLength(2);
  fireEvent.change(screen.getByLabelText("Логин студента"),{target:{value:"corrected"}});
  expect((screen.getByRole("button",{name:"Далее"}) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button",{name:"Применить импорт целиком"}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:"Открыть строку"}));
  expect((screen.getByLabelText("Логин студента") as HTMLInputElement).value).toBe("learner2");expect(screen.getAllByRole("textbox")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button",{name:"Открыть строку"}));
  expect((screen.getByLabelText("Логин студента") as HTMLInputElement).value).toBe("corrected");
  fireEvent.click(screen.getByRole("button",{name:"Сохранить исправления"}));
  expect(state.execute).toHaveBeenCalledWith(expect.objectContaining({method:"PUT",body:{expectedPreviewVersion:1,changes:[{rowId:"r1",input:{studentLogin:"corrected",commissionMemberIds:[30]},excluded:false}]}}));
 });
});
