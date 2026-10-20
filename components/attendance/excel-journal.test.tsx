// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import type {AttendanceType,Command,Entry,Journal,Student} from "@/lib/bff/attendance";
const m=vi.hoisted(()=>({read:vi.fn(),execute:vi.fn(),recover:vi.fn(),recovery:"idle",user:{role:"admin",organization_admin:true,organization_id:1001,account_id:9,division_id:2},refresh:null as null|(()=>Promise<void>),immersive:vi.fn(),pending:null as null|{blocked?:boolean;key?:string}}));
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:m.user})}));
vi.mock("@/contexts/cabinet-chrome-context",()=>({useCabinetChrome:()=>({setImmersive:m.immersive})}));
vi.mock("@/lib/bff/use-context-guard",()=>({useContextGuard:vi.fn()}));
vi.mock("@/lib/bff/attendance",async original=>({...await original<typeof import("@/lib/bff/attendance")>(),readAttendance:m.read}));
vi.mock("./shared",()=>({useAction:(refresh:()=>Promise<void>)=>{m.refresh=refresh;return{busy:false,pending:m.pending,execute:m.execute,recover:m.recover,recovery:m.recovery};},ActionNotice:({action}:{action:{recover:()=>Promise<boolean>}})=><button onClick={()=>void action.recover()}>Проверить исход команды</button>}));
vi.mock("@tanstack/react-virtual",()=>({useVirtualizer:({count}:{count:number})=>({getVirtualItems:()=>Array.from({length:count},(_,index)=>({index,key:index,start:index*40,end:(index+1)*40})),getTotalSize:()=>count*40})}));
import {ExcelAttendanceJournal} from "./excel-journal";
import {excelReport} from "@/lib/attendance/excel-report";
const type:AttendanceType={id:88,division_id:2,code:"custom_excused",name:"Особая причина",color:"#abcdef",mark:"УП",version:3,is_active:true,sort_order:1,counts_as_present:false,counts_as_absent:true,is_excused:true,scan_default:false,zap_default:true};
const student:Student={account_id:7,profile_id:700,role:"student",full_name:"Synthetic student",class:11,group_id:null,group_name:null,school_id:8,school_name:"Synthetic school",school_short_name:"School"};
let revision:number,journal:Journal,students:Student[];
const period={dateFrom:"2026-06-01",dateTo:"2026-06-30"};
function mount(prepared=false){return render(<ExcelAttendanceJournal division={2} divisionName="Synthetic division" period={period} onBack={vi.fn()} initialData={prepared?{revision,value:{journal,students,types:[type]},report:excelReport(journal,students,period.dateFrom,period.dateTo)}:undefined}/>);}
const loaded=()=>screen.findAllByRole("button",{name:"Пусто"});
function entry(day=1,account=7):Entry{return{id:45+day+account*100,division_id:2,class_day_id:day,account_id:account,group_id:null,full_name:student.full_name,type:{...type},zap_id:null,is_deleted:false,updated_at:"2026-06-01T12:00:00Z"};}
async function save(command:Command,onSuccess?:(r:unknown)=>void){revision++;const edits=(command.data as {cells?:{class_day_id:number;account_id:number;attendance_type_id:number}[]}).cells;const result={revision,value:edits?{cells:edits.map(c=>({...entry(c.class_day_id,c.account_id),is_deleted:c.attendance_type_id===0}))}:command.method==="DELETE"?{deleted:true}:entry(Number(command.path.split('/')[4]))};onSuccess?.(result);await m.refresh?.();return result;}
describe("confirmed attendance editing",()=>{
 beforeEach(()=>{vi.clearAllMocks();revision=3;students=[student];m.recovery="idle";m.recover.mockReset();m.user.role="admin";m.pending=null;journal={organization_id:1001,division_id:2,days:[1,2].map(id=>({id,division_id:2,date:`2026-06-0${id}`,comment:"",lesson_ids:[],has_history:false})),entries:[],counts_by_type_code:{},unmarked_is_absent:false};m.read.mockImplementation(async()=>({revision,value:{journal:structuredClone(journal),students,types:[type]}}));m.execute.mockImplementation(save);});
 afterEach(cleanup);
 it("loads one coherent workspace and commits an account ID without any full readback",async()=>{mount();const cells=await loaded();expect(m.read).toHaveBeenCalledTimes(1);expect(m.read.mock.calls[0][0]).toBe("/divisions/2/journal-workspace?date_from=2026-06-01&date_to=2026-06-30");fireEvent.mouseDown(cells[0],{button:0});fireEvent.click(screen.getByRole("button",{name:"Сохранить"}));await screen.findByRole("button",{name:type.name});expect(m.read).toHaveBeenCalledTimes(1);expect(m.execute.mock.calls[0][0]).toMatchObject({revision:3,data:{account_id:7,attendance_type_id:88}});expect(screen.queryByLabelText("Обновление журнала")).toBeNull();});
 it("keeps the journal ready for a second separate edit after confirmed saving",async()=>{mount();const cells=await loaded();fireEvent.mouseDown(cells[0],{button:0});fireEvent.click(screen.getByRole("button",{name:"Сохранить"}));await screen.findByRole("button",{name:type.name});fireEvent.mouseDown(screen.getByRole("button",{name:"Пусто"}),{button:0});const saveButton=screen.getByRole("button",{name:"Сохранить"}) as HTMLButtonElement;expect(saveButton.disabled).toBe(false);fireEvent.click(saveButton);await waitFor(()=>expect(m.execute).toHaveBeenCalledTimes(2));expect(m.execute.mock.calls.map(c=>c[0].revision)).toEqual([3,4]);expect(m.read).toHaveBeenCalledTimes(1);});
 it("mounts an already prepared report without fetching it again",async()=>{mount(true);await loaded();expect(m.read).not.toHaveBeenCalled();expect(m.immersive).toHaveBeenCalledWith(true);});
 it("does not render empty results or enter immersive mode while loading",async()=>{let resolve!:(value:unknown)=>void;m.read.mockImplementation(()=>new Promise(r=>{resolve=r;}));mount();await screen.findByLabelText("Подготовка журнала");expect(screen.queryByText(/нет дней занятий/)).toBeNull();expect(m.immersive).not.toHaveBeenCalledWith(true);await act(async()=>resolve({revision,value:{journal,students,types:[type]}}));await loaded();});
 it("serializes consecutive brush cells with committed revisions and no further reads",async()=>{let release!:()=>void;m.execute.mockImplementationOnce(async(c,onSuccess)=>{await new Promise<void>(r=>{release=r;});return save(c,onSuccess);});mount();const cells=await loaded();fireEvent.click(screen.getByRole("button",{name:"Кисть"}));fireEvent.mouseDown(cells[0],{button:0});fireEvent.mouseEnter(cells[1]);fireEvent.mouseEnter(cells[1]);expect(m.execute).toHaveBeenCalledTimes(1);await act(async()=>release());await waitFor(()=>expect(m.execute).toHaveBeenCalledTimes(2));expect(m.execute.mock.calls.map(c=>c[0].revision)).toEqual([3,4]);expect(m.read).toHaveBeenCalledTimes(1);expect(screen.getAllByRole("button",{name:type.name})).toHaveLength(2);});
 it("retains queued intents after an UNKNOWN and never resends them automatically",async()=>{let release!:()=>void;m.execute.mockImplementationOnce(async()=>{await new Promise<void>(r=>{release=r;});m.pending={blocked:true};return null;});mount();const cells=await loaded();fireEvent.click(screen.getByRole("button",{name:"Кисть"}));fireEvent.mouseDown(cells[0],{button:0});fireEvent.mouseEnter(cells[1]);await act(async()=>release());expect(m.execute).toHaveBeenCalledTimes(1);expect(screen.getByText("Очередь приостановлена: 2")).toBeTruthy();expect((screen.getByRole("button",{name:"Продолжить очередь"}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole("button",{name:"Отменить неотправленные"}) as HTMLButtonElement).disabled).toBe(true);});
 it("keeps the unsent tail when a committed response has an unexpected revision",async()=>{let release!:()=>void;m.execute.mockImplementationOnce(async(c,onSuccess)=>{await new Promise<void>(r=>{release=r;});revision++;const result={revision:revision+1,value:entry()};try{onSuccess(result);}catch{}return result;});mount();const cells=await loaded();fireEvent.click(screen.getByRole("button",{name:"Кисть"}));fireEvent.mouseDown(cells[0],{button:0});fireEvent.mouseEnter(cells[1]);await act(async()=>release());expect(m.execute).toHaveBeenCalledTimes(1);expect(screen.getByRole("alert").textContent).toContain("не соответствует ячейке");expect(screen.getByText("Очередь приостановлена: 1")).toBeTruthy();});
 it("uses the immutable owner snapshot and protects a zap-linked entry",async()=>{journal.entries=[{...entry(),type:{...type,is_active:false},zap_id:12}];mount();const cell=await screen.findByRole("button",{name:type.name});expect(cell.style.backgroundColor).toBe("rgb(171, 205, 239)");fireEvent.mouseDown(cell,{button:0});expect(screen.getByText(/связана с отгулом №12/)).toBeTruthy();expect(screen.queryByRole("button",{name:"Сохранить"})).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Закрыть"}));fireEvent.click(screen.getByRole("button",{name:"Ластик"}));fireEvent.mouseDown(cell,{button:0});expect(m.execute).not.toHaveBeenCalled();});
 it("applies a confirmed DELETE to the account's cell without reloading",async()=>{journal.entries=[entry()];mount();const cell=await screen.findByRole("button",{name:type.name});fireEvent.click(screen.getByRole("button",{name:"Ластик"}));fireEvent.mouseDown(cell,{button:0});await waitFor(()=>expect(screen.queryByRole("button",{name:type.name})).toBeNull());expect(m.execute.mock.calls[0][0]).toMatchObject({method:"DELETE",path:"/divisions/2/class-days/1/attendance/7",revision:3});expect(m.read).toHaveBeenCalledTimes(1);});
 it("saves a large brush in bounded batches instead of one request per cell",async()=>{
   students=Array.from({length:51},(_,i)=>({...student,account_id:7+i,profile_id:700+i,full_name:`Student ${i}`}));
   journal.days=Array.from({length:4},(_,i)=>({...journal.days[0],id:i+1,date:`2026-06-0${i+1}`}));
   let release!:()=>void;m.execute.mockImplementationOnce(async(c,onSuccess)=>{await new Promise<void>(r=>{release=r;});return save(c,onSuccess);});
   mount();const cells=await loaded();fireEvent.click(screen.getByRole("button",{name:"Кисть"}));fireEvent.mouseDown(cells[0],{button:0});for(const cell of cells.slice(1))fireEvent.mouseEnter(cell);fireEvent.mouseUp(window);
   await act(async()=>release());await waitFor(()=>expect(m.execute).toHaveBeenCalledTimes(4));
   expect(m.execute.mock.calls.map(c=>c[0].revision)).toEqual([3,4,5,6]);
   expect(m.execute.mock.calls.slice(1).map(c=>(c[0].data as {cells:unknown[]}).cells.length)).toEqual([100,100,3]);
   expect(m.execute.mock.calls.slice(1).every(c=>c[0].path==="/divisions/2/attendance-cells/batch")).toBe(true);
   expect(screen.getAllByRole("button",{name:type.name})).toHaveLength(204);expect(m.read).toHaveBeenCalledTimes(1);
 });
 it("recovers the whole UNKNOWN batch once and retains its unsent tail",async()=>{
   students=Array.from({length:52},(_,i)=>({...student,account_id:7+i,profile_id:700+i,full_name:`Student ${i}`}));
   let releaseFirst!:()=>void,releaseBatch!:()=>void;
   m.execute.mockImplementationOnce(async(c,onSuccess)=>{await new Promise<void>(r=>{releaseFirst=r;});return save(c,onSuccess);}).mockImplementationOnce(async(c)=>{await new Promise<void>(r=>{releaseBatch=r;});m.pending={key:c.key};return null;});
   mount();const cells=await loaded();fireEvent.click(screen.getByRole("button",{name:"Кисть"}));fireEvent.mouseDown(cells[0],{button:0});for(const cell of cells.slice(1))fireEvent.mouseEnter(cell);
   await act(async()=>releaseFirst());await waitFor(()=>expect(m.execute).toHaveBeenCalledTimes(2));await act(async()=>releaseBatch());
   expect(screen.getByText("Очередь приостановлена: 103")).toBeTruthy();
   const batch=m.execute.mock.calls[1][0] as Command;
   m.recover.mockImplementation(async()=>{revision++;journal.entries=(batch.data as {cells:{class_day_id:number;account_id:number}[]}).cells.map(c=>entry(c.class_day_id,c.account_id));m.pending=null;m.recovery="committed";await m.refresh?.();return true;});
   fireEvent.click(screen.getByRole("button",{name:"Проверить исход команды"}));await waitFor(()=>expect(screen.getByText("Очередь приостановлена: 3")).toBeTruthy());
   expect(m.execute).toHaveBeenCalledTimes(2);expect((screen.getByRole("button",{name:"Продолжить очередь"}) as HTMLButtonElement).disabled).toBe(true);
 });
 it("never consumes queued cells when recovering another tab's command",async()=>{
   m.execute.mockImplementationOnce(async()=>{m.pending={key:"another-command-uuid"};return null;});
   mount();const cells=await loaded();fireEvent.click(screen.getByRole("button",{name:"Кисть"}));fireEvent.mouseDown(cells[0],{button:0});
   await screen.findByText("Очередь приостановлена: 1");
   m.recover.mockImplementation(async()=>{m.pending=null;m.recovery="committed";await m.refresh?.();return true;});
   fireEvent.click(screen.getByRole("button",{name:"Проверить исход команды"}));await waitFor(()=>expect(m.read).toHaveBeenCalledTimes(2));
   expect(screen.getByText("Очередь приостановлена: 1")).toBeTruthy();expect(m.execute).toHaveBeenCalledTimes(1);
 });
 it("keeps a read-only journal inspectable",async()=>{m.user.role="supervisor";mount();const cells=await loaded();expect(screen.queryByRole("button",{name:"Карандаш"})).toBeNull();fireEvent.mouseDown(cells[0],{button:0});expect(screen.getByRole("dialog")).toBeTruthy();expect(m.execute).not.toHaveBeenCalled();});
});
