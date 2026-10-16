// @vitest-environment jsdom
import { cleanup,render,screen } from "@testing-library/react";
import { afterEach,expect,it } from "vitest";
import { getCatalogTestScore,TestsDesktopList } from "./tests-desktop-list";
import type { StudentTestItem,TestSession } from "@/lib/student/tests-types";
afterEach(cleanup);
const test:StudentTestItem={id:"1",title:"Право",status:"completed"};
const session:TestSession={id:"s",testId:"1",score:0,calculationStatus:"ready"};
it("shows a published zero from the list and never exposes a pending or failed calculation",()=>{
 expect(getCatalogTestScore(test,session)).toBe(0);
 expect(getCatalogTestScore({...test,status:"checking"},{...session,score:100,calculationStatus:"queued"})).toBeNull();
 expect(getCatalogTestScore(test,{...session,score:100,calculationStatus:"failed"})).toBeNull();
 expect(getCatalogTestScore({...test,status:"external",isExternal:true,hasResult:true,rate:0})).toBe(0);
 expect(getCatalogTestScore({...test,status:"external",isExternal:true,hasResult:false,rate:100})).toBeNull();
 render(<TestsDesktopList tests={[test]} sessions={new Map([["1",session]])} onSelect={()=>{}}/>);expect(screen.getByText("0")).toBeTruthy();expect(screen.getByText("/ 100")).toBeTruthy();
});
