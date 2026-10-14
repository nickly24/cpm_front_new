import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
const request = vi.fn();
vi.mock("./client", () => ({ domain: (...args: unknown[]) => request(...args), getIdentity: () => ({ user: { organization_id: 1, division_id: 2 } }) }));
import { coreReport, coreReportCellLabel, coreReportColumns, coreReportRows, coreReportItemKindLabel, coreReportWorkbook, type CoreReport } from "./core-reports";
const period = { dateFrom: "2026-10-01", dateTo: "2026-10-15" };
const report: CoreReport = { source: "tests", organization_id: 1, division_id: 2, date_from: period.dateFrom, date_to: period.dateTo, as_of: "2026-10-08T00:00:00Z", limitations: [], students: [{account_id: 10,profile_id: 999,full_name: "Иван",class: 7,group_id: 3,group_name: "А",school_id: null,school_name: null},{account_id: 11,profile_id: 22,full_name: "Пётр",class: 8,group_id: null,group_name: null,school_id: null,school_name: null}], items: [{id:"x",name:"Тест",date:"2026-10-01",kind:"test",direction_id:9},{id:"y",name:"Тест 2",date:"2026-10-02",kind:"test",direction_id:8}],cells:[{account_id:10,item_id:"x",status:"ready",score:0},{account_id:10,item_id:"y",status:"queued",score:null},{account_id:11,item_id:"x",status:"missing",score:null},{account_id:11,item_id:"y",status:"processing",score:null}] };
beforeEach(() => { request.mockReset(); });
describe("Core independent supervisor reports", () => {
  it("requests new Core source reports by period without rating publication or claimed scope", async () => { request.mockResolvedValue(report); expect(await coreReport("tests", period)).toEqual(report); expect(request.mock.calls[0][0]).toBe("/core/reports/tests?date_from=2026-10-01&date_to=2026-10-15"); });
  it.each([{division_id:3},{source:"exams"},{date_from:"2026-10-02"},{cells:[]},{cells:report.cells.map((cell)=>({...cell,score:100,status:"processing"}))}])("rejects foreign, partial and unfinished-score reports %j", async (patch) => {request.mockResolvedValue({...report,...patch});await expect(coreReport("tests",period)).rejects.toThrow();});
  it("preserves official zero, queued work and missing independently in UI and workbook", () => {expect(coreReportCellLabel(report.cells[0],"tests")).toBe("0");expect(coreReportCellLabel(report.cells[1],"tests")).toBe("В очереди");expect(coreReportCellLabel(report.cells[2],"tests")).toBe("Нет результата");expect(coreReportCellLabel(report.cells[2],"attendance")).toBe("Не отмечено");const wb=coreReportWorkbook(report,report.students,report.items);const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});expect(rows[2]).toEqual(["Иван",7,"А","Без школы",0,"В очереди"]);expect(rows[3]).toEqual(["Пётр",8,"Без группы","Без школы","Нет результата","В процессе"]);});
  it("filters account rows and source columns with distinct profile identities", () => {expect(coreReportRows(report,{group:"3",class:"7"})[0].account_id).toBe(10);expect(coreReportRows(report,{group:"none"})[0].account_id).toBe(11);expect(coreReportRows(report,{search:"иван"})).toHaveLength(1);expect(coreReportColumns(report,"9").map((item)=>item.id)).toEqual(["x"]);});
  it("requires the current attendance owner to preserve unmarked semantics", async () => {request.mockResolvedValue({...report,source:"attendance",unmarked_is_absent:true});await expect(coreReport("attendance",period)).rejects.toThrow();});
  it("explains source outages without presenting empty or zero reports", async () => {request.mockRejectedValue(Object.assign(new Error("tests_report_unavailable"),{code:"tests_report_unavailable"}));await expect(coreReport("tests",period)).rejects.toThrow("временно недоступен");});
  it("preserves external zero, a recorded null score and an absent result separately", async () => {
    const external:CoreReport={...report,items:report.items.map(item=>({...item,kind:"external_test"})),cells:[
      {account_id:10,item_id:"x",status:"ready",score:0,recorded:true,external_result_id:"a".repeat(24),result_version:2},
      {account_id:10,item_id:"y",status:"missing",score:null,recorded:true,external_result_id:"b".repeat(24),result_version:3},
      {account_id:11,item_id:"x",status:"missing",score:null},
      {account_id:11,item_id:"y",status:"ready",score:87.5,recorded:true,external_result_id:"c".repeat(24),result_version:1},
    ]};
    request.mockResolvedValue(external);expect(await coreReport("tests",period)).toEqual(external);
    expect(external.cells.map(cell=>coreReportCellLabel(cell,"tests"))).toEqual(["0","Без оценки","Нет результата","87.5"]);
    const wb=coreReportWorkbook(external,external.students,external.items);
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});
    expect(rows[2]).toEqual(["Иван",7,"А","Без школы",0,"Без оценки"]);
    expect(rows[3]).toEqual(["Пётр",8,"Без группы","Без школы","Нет результата",87.5]);
    expect((rows[1] as string[]).slice(4).every(value=>value.endsWith(" · Внешний тест"))).toBe(true);
  });
  it("labels external test and outside-LMS exam columns in the same UI/export mapping",()=>{
    expect(coreReportItemKindLabel({...report.items[0],kind:"external_test"})).toBe("Внешний тест");
    expect(coreReportItemKindLabel({...report.items[0],kind:"outside_lms"})).toBe("Вне системы");
    expect(coreReportItemKindLabel(report.items[0])).toBe("");
  });
  it("keeps an unknown class distinct from all numeric classes in filtering and export",()=>{
    const unknown={...report,students:report.students.map((student,index)=>({...student,class:index===0?null:student.class}))};
    expect(coreReportRows(unknown,{class:"none"}).map(student=>student.account_id)).toEqual([10]);
    expect(coreReportRows(unknown,{class:"8"}).map(student=>student.account_id)).toEqual([11]);
    const wb=coreReportWorkbook(unknown,unknown.students,unknown.items);
    expect((XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1})[2] as unknown[])[1]).toBe("Без класса");
  });
});
