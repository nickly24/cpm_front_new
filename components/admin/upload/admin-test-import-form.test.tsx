// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({ request:vi.fn().mockResolvedValue({}), catalog:{types:[{type:"tests.json",owner:"tests",formats:["json","js","xlsx"],mode:"validated_input",create:true,commit:true,edit:true,template:true,max_rows:200,max_bytes:8388608}]}}));
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:{account_id:9,organization_id:7,division_id:11,role:"admin",organization_admin:true,organizations:[{id:7,name:"Сборная",divisions:[{id:11,name:"Основная сборная"},{id:12,name:"Другое подразделение"}]}]}})}));
vi.mock("@/lib/bff/client",()=>({domain:vi.fn(),bffRequest:state.request,exclusiveContext:(fn:()=>Promise<void>)=>fn(),resetRequests:vi.fn(),announceSession:vi.fn()}));
vi.mock("@/lib/bff/use-context-guard",()=>({useContextGuard:vi.fn()}));
vi.mock("@/lib/bff/uploads",async(importOriginal)=>({
 ...await importOriginal<typeof import("@/lib/bff/uploads")>(),
 uploadCatalog:vi.fn(async()=>state.catalog),uploadSessions:vi.fn(async()=>[]),uploadJobs:vi.fn(async()=>[]),uploadDirections:vi.fn(async()=>[{id:19,name:"Трудовое право"}]),
 uploadCommandJournalState:()=>({pending:null,blocked:false,otherCabinet:false,error:""}), watchedUploadJobs:()=>[],
}));
import { AdminUploadsBffWorkspace } from "./admin-uploads-bff-workspace";
afterEach(()=>{cleanup();vi.clearAllMocks()});
it("offers actual subdivisions and Excel files with hidden defaults and dates",async()=>{
 render(<AdminUploadsBffWorkspace/>);
 const division=await screen.findByLabelText("Подразделение для теста");
 expect((division as HTMLSelectElement).value).toBe("11");expect(screen.getByRole("option",{name:"Другое подразделение"})).toBeTruthy();
 const input=screen.getByLabelText("Файл") as HTMLInputElement;expect(input.accept).toContain(".xlsx");
 fireEvent.change(input,{target:{files:[new File(["synthetic"],"questions.xlsx")]}});
 expect((screen.getByLabelText("Опубликовать") as HTMLSelectElement).value).toBe("false");expect((screen.getByLabelText("Показывать ответы") as HTMLSelectElement).value).toBe("false");
 expect((screen.getByLabelText("Начало") as HTMLInputElement).value).not.toBe("");expect((screen.getByLabelText("Окончание") as HTMLInputElement).value.slice(0,4)).toBe(String(new Date().getFullYear()+5));
 expect((division as HTMLSelectElement).disabled).toBe(true);
});
it("changes the authenticated context before selecting a source file",async()=>{
 render(<AdminUploadsBffWorkspace/>);const division=await screen.findByLabelText("Подразделение для теста");
 fireEvent.change(division,{target:{value:"12"}});
 await waitFor(()=>expect(state.request).toHaveBeenCalledWith("/auth/context",{method:"POST",body:JSON.stringify({organization_id:7,division_id:12})}));
});
