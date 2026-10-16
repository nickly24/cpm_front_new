// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceType, Entry, Journal } from "@/lib/bff/attendance";
import { attendanceKind, monthRange, monthlyAttendance } from "./monthly-attendance";
const mocks=vi.hoisted(()=>({read:vi.fn(),desktop:false}));
const {read}=mocks;
vi.mock("@/lib/hooks/use-media-query",()=>({useMediaQuery:()=>mocks.desktop}));
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:{account_id:7,organization_id:10}})}));
vi.mock("@/lib/bff/attendance",async original=>({...await original<object>(),readAttendance:mocks.read,ownDivisions:()=>[{id:1,name:"Право"},{id:2,name:"Практикум"}]}));
import { StudentMonthlyAttendance } from "./student-monthly-attendance";
const type=(kind:"present"|"absent"|"excused"|"other"):AttendanceType=>({id:1,division_id:1,version:1,code:kind,name:{present:"Пришёл",absent:"Нет без причины",excused:"Отгул",other:"Особая отметка"}[kind],color:"#000",mark:"",sort_order:10,is_active:false,counts_as_present:kind==="present",counts_as_absent:kind==="absent"||kind==="excused",is_excused:kind==="excused",scan_default:false,zap_default:false});
const entry=(id:number,day:number,kind:"present"|"absent"|"excused"|"other",account=7,division=1):Entry=>({id,class_day_id:day,account_id:account,division_id:division,group_id:null,full_name:"Демо",type:type(kind),zap_id:null,is_deleted:false,updated_at:"2026-10-16T09:00:00Z"});
function journals():Journal[]{return [{organization_id:10,division_id:1,days:[{id:1,division_id:1,date:"2026-10-13",comment:"Утреннее занятие",lesson_ids:[],has_history:true},{id:2,division_id:1,date:"2026-10-14",comment:"",lesson_ids:[],has_history:true},{id:3,division_id:1,date:"2026-10-15",comment:"",lesson_ids:[],has_history:false}],entries:[entry(1,1,"present"),entry(2,2,"absent")],counts_by_type_code:{},unmarked_is_absent:false},{organization_id:10,division_id:2,days:[{id:4,division_id:2,date:"2026-10-13",comment:"",lesson_ids:[],has_history:true}],entries:[{...entry(3,4,"excused",7,2),zap_id:20}],counts_by_type_code:{},unmarked_is_absent:false}];}
beforeEach(()=>{mocks.desktop=false;vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date(2026,9,16,12));read.mockReset().mockResolvedValue({value:journals(),revision:1});});
afterEach(()=>{cleanup();vi.useRealTimers();});
describe("monthly attendance semantics",()=>{
  it("uses snapshotted flags, ignores foreign/deleted marks and never treats an unmarked day as absent",()=>{
    const data=journals();data[0].entries.push(entry(9,3,"absent",9),{...entry(8,3,"absent"),is_deleted:true});
    const model=monthlyAttendance(data,7,"2026-10-01","2026-10-31");
    expect(model.counts).toEqual({present:1,absent:1,excused:1,other:0});expect(model.total).toBe(3);expect(model.unmarked).toBe(1);expect(model.presentPercent).toBe(33);expect(model.absentPercent).toBe(33);expect(model.days).toHaveLength(3);expect(model.days[2].rows).toHaveLength(2);
    expect(attendanceKind({...type("other"),is_excused:true})).toBe("other");
    const filtered=monthlyAttendance(data,7,"2026-10-01","2026-10-31",2);expect(filtered.total).toBe(1);expect(filtered.absentPercent).toBe(0);
  });
  it("keeps zero denominators, leap years and date bounds correct",()=>{expect(monthRange("2024-02-15")).toEqual({from:"2024-02-01",to:"2024-02-29"});const model=monthlyAttendance(journals(),7,"2026-11-01","2026-11-30");expect(model.total).toBe(0);expect(model.presentPercent).toBeNull();expect(model.absentPercent).toBeNull();expect(model.days).toHaveLength(0);});
});
describe("student monthly view",()=>{
  it("uses a desktop department select, keeps filtering local and restores document scroll after a day",async()=>{
    mocks.desktop=true;
    const scroll=vi.spyOn(window,"scrollTo").mockImplementation(()=>{});
    const position=vi.spyOn(window,"scrollY","get").mockReturnValue(280);
    render(<StudentMonthlyAttendance/>);await screen.findByRole("img");
    expect(screen.queryByRole("group",{name:"Подразделения"})).toBeNull();
    fireEvent.change(screen.getByRole("combobox",{name:"Подразделение"}),{target:{value:"1"}});
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");
    fireEvent.click(screen.getByRole("button",{name:"Посмотреть 13 октября"}));
    await waitFor(()=>expect(scroll).toHaveBeenLastCalledWith({top:0,behavior:"instant"}));
    fireEvent.click(screen.getByRole("button",{name:"К посещаемости за месяц"}));
    await waitFor(()=>expect(scroll).toHaveBeenLastCalledWith({top:280,behavior:"instant"}));
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("1");
    expect(read).toHaveBeenCalledTimes(1);scroll.mockRestore();position.mockRestore();
  });
  it("opens current month, computes the circle/bar and expands a day without additional requests",async()=>{
    render(<StudentMonthlyAttendance/>);await screen.findByRole("img",{name:/Присутствие: 33%/});expect(read).toHaveBeenCalledWith("/me/attendance?date_from=2026-10-01&date_to=2026-10-31",expect.any(AbortSignal));
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("33");expect(screen.getByText(/Не отмечено: 1/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Посмотреть 13 октября"}));expect(screen.getByText("Право")).toBeTruthy();expect(screen.getByText("Практикум")).toBeTruthy();expect(screen.getByText("Утреннее занятие")).toBeTruthy();expect(screen.getByRole("link",{name:"Заявка на отгул"}).getAttribute("href")).toBe("/cabinet/student/zaps?request=20");
    fireEvent.click(screen.getByRole("button",{name:"К посещаемости за месяц"}));await screen.findByRole("img");expect(read).toHaveBeenCalledTimes(1);
  });
  it("filters departments locally and switches full calendar months using the existing own report",async()=>{
    render(<StudentMonthlyAttendance/>);await screen.findByRole("img");fireEvent.click(screen.getByRole("button",{name:/^Право$/}));expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");expect(read).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button",{name:"Следующий месяц"}));await waitFor(()=>expect(read).toHaveBeenCalledWith("/me/attendance?date_from=2026-11-01&date_to=2026-11-30",expect.any(AbortSignal)));await screen.findByText("За этот месяц записей пока нет");expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("Нет отметок для расчёта");
  });
  it("does not display stale data after a failed month request and retries the same period",async()=>{
    render(<StudentMonthlyAttendance/>);await screen.findByRole("img");read.mockRejectedValueOnce(new Error("Не удалось загрузить месяц"));fireEvent.click(screen.getByRole("button",{name:"Следующий месяц"}));await screen.findByRole("alert");expect(screen.queryByRole("img")).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Повторить"}));await screen.findByRole("img");expect(read.mock.calls.at(-1)?.[0]).toContain("date_from=2026-11-01&date_to=2026-11-30");
  });
  it("aborts previous requests and ignores their late responses",async()=>{
    let resolve!:(value:unknown)=>void;read.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));render(<StudentMonthlyAttendance/>);await waitFor(()=>expect(resolve).toBeTypeOf("function"));const previous=read.mock.calls[0][1] as AbortSignal;fireEvent.click(screen.getByRole("button",{name:"Следующий месяц"}));await screen.findByRole("img");expect(previous.aborted).toBe(true);await act(async()=>resolve({value:journals(),revision:1}));expect(screen.getByRole("heading",{name:"ноябрь 2026"})).toBeTruthy();expect(screen.queryByRole("button",{name:"Посмотреть 13 октября"})).toBeNull();
  });
});
