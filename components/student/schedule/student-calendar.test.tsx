// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AvailableCalendar, Event, Schedule } from "@/lib/bff/attendance";
import { monthDays, offsetMonth, timelineLayout, weekDays } from "./calendar-utils";
const { read }=vi.hoisted(()=>({read:vi.fn()}));
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:{role:"student",organization_id:10}})}));
vi.mock("@/lib/bff/attendance",async original=>({...await original<object>(),readAttendance:read}));
import { StudentCalendar } from "./student-calendar";
const calendars: AvailableCalendar[]=[{division_id:1,division_name:"Право",is_member:true,timezone:"Europe/Moscow",can_edit:false,visibility:"closed"},{division_id:2,division_name:"Практикум",is_member:true,timezone:"Europe/Moscow",can_edit:false,visibility:"closed"}];
const event=(id:number,start="09:00",end="10:30"):Event=>({id,division_id:id===1?1:2,organization_id:10,division_name:id===1?"Право":"Практикум",date:"2026-10-16",start_time:start,end_time:end,starts_at:`2026-10-16T${start}:00+03:00`,ends_at:`2026-10-16T${end}:00+03:00`,lesson_name:`Занятие ${id}`,teacher_name:"Демо-преподаватель",location:"Учебный центр",classroom:"204",is_changed:false,is_in_person:true,is_for_all:true,is_public:true,school_id:null,target_group_ids:[],teacher_account_id:null,room_resource_id:null,color:"#ff8059",timezone:"Europe/Moscow"});
function result(path:string):{value:unknown;revision:number}{return {revision:1,value:path==="/calendars"?calendars:{organization_id:10,calendars,events:path.includes("division_ids=2")?[event(2,"10:00","11:30")]:path.includes("division_ids=1")?[event(1)]:[event(1),event(2,"10:00","11:30")],overlap_clusters:[] } satisfies Schedule};}
beforeEach(()=>{vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date(2026,9,16,12));read.mockReset().mockImplementation(async(path:string)=>result(path));HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};});
afterEach(()=>{cleanup();vi.useRealTimers();});
async function loaded(){await screen.findByRole("button",{name:/09:00.*Занятие 1/});}

describe("calendar dates and overlaps",()=>{
  it("keeps civil dates across year/leap boundaries and starts grids on Monday",()=>{expect(offsetMonth("2026-01-31",1)).toBe("2026-02-28");expect(offsetMonth("2024-01-31",1)).toBe("2024-02-29");expect(offsetMonth("2026-01-01",-1)).toBe("2025-12-01");const days=monthDays("2026-10-16");expect(days).toHaveLength(42);expect(days[0]).toBe("2026-09-28");expect(days[41]).toBe("2026-11-08");expect(weekDays("2026-11-01")[0]).toBe("2026-10-26");});
  it("allocates simultaneous lessons to columns and reuses columns for touching intervals",()=>{const layout=timelineLayout([event(1),event(2,"10:00","11:30"),event(3,"10:30","12:00"),event(4,"13:00","14:00")]);expect(layout.map(item=>[item.column,item.columns])).toEqual([[0,2],[1,2],[0,2],[0,1]]);});
});
describe("student calendar",()=>{
  it("starts in the current month with a personal schedule, then opens day and event detail",async()=>{
    render(<StudentCalendar/>);await loaded();expect(screen.getByRole("button",{name:"Месяц"}).getAttribute("aria-pressed")).toBe("true");
    expect(read).toHaveBeenCalledWith("/me/schedule?date_from=2026-09-28&date_to=2026-11-08",expect.any(AbortSignal));
    fireEvent.click(screen.getByRole("button",{name:/пятница, 16 октября, сегодня/}));expect(screen.getByRole("group",{name:"Дни недели"})).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:/09:00–10:30, Занятие 1/}));expect(screen.getByRole("dialog",{name:"Занятие"})).toBeTruthy();expect(screen.getByText("Демо-преподаватель")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Закрыть окно"}));expect(screen.queryByRole("dialog")).toBeNull();expect(read).toHaveBeenCalledTimes(2);
  });
  it("navigates periods, returns to today and uses the existing overlay query",async()=>{
    render(<StudentCalendar/>);await loaded();fireEvent.click(screen.getByRole("button",{name:"Следующий месяц"}));await waitFor(()=>expect(read).toHaveBeenCalledWith("/me/schedule?date_from=2026-10-26&date_to=2026-12-06",expect.any(AbortSignal)));
    fireEvent.click(screen.getByRole("button",{name:"Сегодня"}));await loaded();fireEvent.click(screen.getByRole("button",{name:"Выбрать календари"}));
    fireEvent.click(screen.getByRole("button",{name:/Выбрать календари Показать/}));const dialog=screen.getByRole("dialog");fireEvent.click(within(dialog).getByRole("checkbox",{name:/Практикум/}));
    await waitFor(()=>expect(read).toHaveBeenCalledWith("/schedule?division_ids=1&date_from=2026-09-28&date_to=2026-11-08",expect.any(AbortSignal)));
    fireEvent.click(screen.getByRole("button",{name:"Готово"}));await loaded();expect(screen.queryByRole("button",{name:/10:00.*Занятие 2/})).toBeNull();
  });
  it("supports swipes and pinch zoom while ignoring vertical and cancelled drags",async()=>{
    render(<StudentCalendar/>);await loaded();const region=screen.getByRole("group",{name:"Дни месяца"}).parentElement!;
    const touches=(...points:number[][])=>points.map(([clientX,clientY])=>({clientX,clientY}));
    fireEvent.touchStart(region,{touches:touches([200,100])});fireEvent.touchEnd(region,{touches:[],changedTouches:touches([190,250])});expect(screen.getByText("октябрь 2026")).toBeTruthy();
    fireEvent.touchStart(region,{touches:touches([200,100])});fireEvent.touchCancel(region);fireEvent.touchEnd(region,{touches:[],changedTouches:touches([0,100])});expect(screen.getByText("октябрь 2026")).toBeTruthy();
    fireEvent.touchStart(region,{touches:touches([100,100],[200,100])});fireEvent.touchMove(region,{touches:touches([60,100],[240,100])});expect(screen.getByRole("group",{name:"Дни недели"})).toBeTruthy();
    fireEvent.touchEnd(region,{touches:[],changedTouches:touches([60,100],[240,100])});
    fireEvent.touchStart(region,{touches:touches([60,100],[240,100])});fireEvent.touchMove(region,{touches:touches([100,100],[200,100])});expect(screen.getByRole("group",{name:"Дни месяца"})).toBeTruthy();
    fireEvent.touchEnd(region,{touches:[],changedTouches:touches([100,100],[200,100])});
    fireEvent.touchStart(region,{touches:touches([250,100])});fireEvent.touchEnd(region,{touches:[],changedTouches:touches([40,110])});await waitFor(()=>expect(screen.getByText("ноябрь 2026")).toBeTruthy());
  });
  it("aborts a stale range and prevents late data replacing the latest month",async()=>{
    let finish!:(value:unknown)=>void;read.mockImplementation((path:string)=>path.startsWith("/me/")&&path.includes("2026-09-28")?new Promise(resolve=>{finish=resolve;}):Promise.resolve(result(path)));
    render(<StudentCalendar/>);await waitFor(()=>expect(finish).toBeTypeOf("function"));const oldSignal=read.mock.calls[1][1] as AbortSignal;
    fireEvent.click(screen.getByRole("button",{name:"Следующий месяц"}));await waitFor(()=>expect(read).toHaveBeenCalledTimes(4));expect(oldSignal.aborted).toBe(true);
    await act(async()=>finish({value:{organization_id:10,calendars:[],events:[],overlap_clusters:[]},revision:2}));expect(screen.getByText("ноябрь 2026")).toBeTruthy();
  });
});
