// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({kind:"tests.json",download:vi.fn(),mutate:vi.fn()}));
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:{id:9,role:"staff_admin",organization_id:7,division_id:11,permissions:{upload:{view:true},tests:{view:true}},organizations:[{id:7,name:"QA",divisions:[{id:11,name:"Основная"}]}]}})}));
vi.mock("@/lib/bff/client",()=>({domain:async()=>({directions:[]})}));
vi.mock("@/lib/bff/use-context-guard",()=>({useContextGuard:()=>{}}));
vi.mock("@/lib/bff/exams-shared",()=>({examsAllPages:async()=>[{id:41,name:"Экзамен QA"}],string:(v:unknown)=>String(v),number:(v:unknown)=>Number(v)}));
vi.mock("@/lib/bff/uploads",async importOriginal=>({...await importOriginal<typeof import("@/lib/bff/uploads")>(),
 uploadCatalog:async()=>({types:[{type:state.kind,owner:"tests",formats:["xlsx"],mode:"validated_input",create:false,commit:false,edit:false,template:true}]}),
 uploadSessions:async()=>[],uploadJobs:async()=>[],uploadDirections:async()=>[{id:19,name:"Право"}],uploadExternalTargets:async()=>[{id:"a".repeat(24),name:"Внешний QA"}],
 downloadUploadTemplate:state.download,createUpload:state.mutate,uploadCommandJournalState:()=>({pending:null,blocked:false,otherCabinet:false,error:""}),watchedUploadJobs:()=>[],
}));
import {AdminUploadsBffWorkspace} from "./admin-uploads-bff-workspace";
beforeEach(()=>{
 state.kind="tests.json";state.download.mockReset().mockResolvedValue({blob:new Blob(["QA"]),filename:"template.xlsx"});state.mutate.mockReset();
 vi.stubGlobal("URL",{createObjectURL:vi.fn(()=>"blob:qa"),revokeObjectURL:vi.fn()});
 vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(function(this:HTMLAnchorElement){expect(this.isConnected).toBe(true);expect(this.download).toBe("template.xlsx");});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe("templates with view-only rights",()=>{
 it("allows choosing a direction and downloading Excel, JSON and JS without enabling import",async()=>{
  render(<AdminUploadsBffWorkspace/>);const select=await screen.findByLabelText("Направление");await screen.findByRole("option",{name:"Право"});
  expect((select as HTMLSelectElement).disabled).toBe(false);expect((screen.getByLabelText("Файл") as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByLabelText("Формат шаблона") as HTMLSelectElement).value).toBe("question_table");
  expect((screen.getByRole("button",{name:"Скачать шаблон"}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(select,{target:{value:"19"}});
  for(const format of ["question_table","cpm_json","online_test_pad"]){fireEvent.change(screen.getByLabelText("Формат шаблона"),{target:{value:format}});fireEvent.click(screen.getByRole("button",{name:"Скачать шаблон"}));await waitFor(()=>expect(state.download).toHaveBeenCalledWith(expect.objectContaining({create:false}),{directionId:19,format}));await waitFor(()=>expect((screen.getByRole("button",{name:"Скачать шаблон"}) as HTMLButtonElement).disabled).toBe(false));}
  expect(state.download).toHaveBeenCalledTimes(3);expect(state.mutate).not.toHaveBeenCalled();expect(document.querySelector('a[download]')).toBeNull();
 });
 it.each(["exams.questions","exams.assignments","exams.outside","tests.external-results"])("allows selecting the target for %s while keeping file input disabled",async kind=>{
  state.kind=kind;render(<AdminUploadsBffWorkspace/>);const select=await screen.findByLabelText(kind.startsWith("exams.")?"Экзамен":"Внешний тест");await screen.findByRole("option",{name:kind.startsWith("exams.")?"Экзамен QA · 41":"Внешний QA"});
  expect((select as HTMLSelectElement).disabled).toBe(false);expect((screen.getByLabelText("Файл") as HTMLInputElement).disabled).toBe(true);
  const targetId=kind.startsWith("exams.")?"41":"a".repeat(24);fireEvent.change(select,{target:{value:targetId}});fireEvent.click(screen.getByRole("button",{name:"Скачать шаблон"}));await waitFor(()=>expect(state.download).toHaveBeenCalledWith(expect.objectContaining({type:kind}),{targetId}));expect(state.mutate).not.toHaveBeenCalled();
 });
 it("shows an actionable download error and lets the user retry",async()=>{
  state.download.mockRejectedValueOnce(new Error("Источник временно недоступен"));render(<AdminUploadsBffWorkspace/>);await screen.findByRole("option",{name:"Право"});fireEvent.change(screen.getByLabelText("Направление"),{target:{value:"19"}});fireEvent.click(screen.getByRole("button",{name:"Скачать шаблон"}));await screen.findByText("Источник временно недоступен");fireEvent.click(screen.getByRole("button",{name:"Скачать шаблон"}));await waitFor(()=>expect(state.download).toHaveBeenCalledTimes(2));expect(state.mutate).not.toHaveBeenCalled();
 });
});
