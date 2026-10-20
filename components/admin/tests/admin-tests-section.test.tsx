// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import type {TestsCatalogPage,TestsCatalogPageQuery} from "@/lib/bff/tests-admin";
const {fetchPage,action,fetchDrafts,immersive}=vi.hoisted(()=>({fetchPage:vi.fn(),action:vi.fn(),fetchDrafts:vi.fn(),immersive:vi.fn()}));
vi.mock("@/lib/config",()=>({BFF_DEV:true,BFF_EXTERNAL_TESTS_DEV:true}));
vi.mock("next/navigation",()=>({useSearchParams:()=>new URLSearchParams(),usePathname:()=>"/cabinet/admin/tests"}));
vi.mock("@/lib/bff/tests-admin",()=>({testsCatalogPage:fetchPage,testsAction:action}));
vi.mock("@/lib/bff/client",()=>({domain:async()=>[{id:11,name:"Основная"},{id:12,name:"Другая"}]}));
vi.mock("@/lib/bff/use-context-guard",()=>({useContextGuard:()=>{}}));
vi.mock("@/contexts/cabinet-chrome-context",()=>({useCabinetChrome:()=>({setImmersive:immersive})}));
vi.mock("@/components/admin/admin-section-access",()=>({useAdminSectionAccess:()=>({canEdit:true}),EditOnly:({children}:{children:React.ReactNode})=>children,ReadOnlyControl:({children}:{children:React.ReactNode})=>children}));
vi.mock("@/components/ui/filter-popover",()=>({FilterPopover:({children}:{children:React.ReactNode})=><div>{children}</div>}));
vi.mock("@/lib/admin/admin-tests-api",()=>({fetchAdminDirections:async()=>[{id:13,name:"Право"}],getAdminTestId:(t:{id:string})=>t.id,getAdminTestTitle:(t:{title:string})=>t.title,isAdminExternalTest:(t:{isExternal?:boolean})=>t.isExternal===true}));
vi.mock("@/lib/admin/admin-test-drafts-api",()=>({fetchAdminTestDrafts:fetchDrafts}));
vi.mock("@/components/admin/tests/admin-test-calculation-settings",()=>({AdminTestCalculationSettings:()=>null}));
vi.mock("@/components/admin/tests/admin-test-form",()=>({AdminTestForm:()=>null}));
vi.mock("@/components/admin/tests/admin-test-draft-editor",()=>({AdminTestDraftEditor:()=>null}));
vi.mock("@/components/admin/tests/admin-test-workspace",()=>({AdminTestWorkspace:()=>null}));
vi.mock("@/components/admin/tests/admin-external-test-workspace",()=>({AdminExternalTestWorkspace:()=>null}));
vi.mock("@/components/admin/tests/admin-external-test-form",()=>({AdminExternalTestForm:()=>null}));
vi.mock("@/components/admin/tests/admin-external-test-delete-dialog",()=>({AdminExternalTestDeleteDialog:()=>null}));
import {AdminTestsSection} from "./admin-tests-section";
function page(query:TestsCatalogPageQuery):TestsCatalogPage {
 const p=query.page||1;return {items:Array.from({length:6},(_,i)=>({id:`${p}-${i}`,title:`Карточка ${(p-1)*6+i+1}`,isAttached:true,isOwner:true,published:false,actions:{can_archive:true,can_edit_metadata:false,can_edit_settings:false,can_manage_bank:false,can_attach:false,can_detach:false,can_copy:false}})),total:300,limit:6,offset:(p-1)*6,statusCounts:{all:300,hidden:230,active:70}};
}
beforeEach(()=>{fetchPage.mockReset();action.mockReset();fetchDrafts.mockReset();fetchPage.mockImplementation(async q=>page(q));fetchDrafts.mockResolvedValue([]);vi.spyOn(window,"confirm").mockReturnValue(true);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe("administration catalogue remote pagination",()=>{
 it("loads six cards, uses server totals, and requests one next page in both tabs",async()=>{
  render(<AdminTestsSection/>);await screen.findByText("Карточка 1");expect(fetchPage).toHaveBeenCalledTimes(1);expect(screen.getAllByRole("article")).toHaveLength(6);expect(fetchDrafts).not.toHaveBeenCalled();
  expect(screen.getByRole("option",{name:"Скрытые · 230"})).toBeTruthy();expect(screen.getByText("300",{selector:"strong"})).toBeTruthy();expect(screen.getAllByRole("button",{name:/^\d+$/}).length).toBeLessThanOrEqual(7);
  fireEvent.click(screen.getByRole("button",{name:"Вперёд →"}));await screen.findByText("Карточка 7");expect(fetchPage).toHaveBeenCalledTimes(2);expect(fetchPage.mock.calls[1][0]).toMatchObject({page:2,limit:6,bank:false});
  fireEvent.click(screen.getByRole("button",{name:"Банк организации"}));await screen.findByText("Карточка 1");expect(fetchPage).toHaveBeenCalledTimes(3);expect(fetchPage.mock.calls[2][0]).toMatchObject({page:1,bank:true});
  fireEvent.click(screen.getByRole("button",{name:"Вперёд →"}));await screen.findByText("Карточка 7");expect(fetchPage).toHaveBeenCalledTimes(4);expect(fetchPage.mock.calls[3][0]).toMatchObject({page:2,bank:true});
 });
 it("debounces search, resets the page once and never filters server results locally",async()=>{
  render(<AdminTestsSection/>);await screen.findByText("Карточка 1");fireEvent.click(screen.getByRole("button",{name:"Вперёд →"}));await screen.findByText("Карточка 7");
  fireEvent.change(screen.getByRole("searchbox"),{target:{value:"Мос"}});fireEvent.change(screen.getByRole("searchbox"),{target:{value:"Москва"}});expect(fetchPage).toHaveBeenCalledTimes(2);
  await waitFor(()=>expect(fetchPage).toHaveBeenCalledTimes(3));expect(fetchPage.mock.calls[2][0]).toMatchObject({page:1,q:"Москва"});await screen.findByText("Карточка 1");expect(screen.queryByText("Карточка 7")).toBeNull();
 });
 it("sends combined status, dates, direction, owner, archive and relation to the server",async()=>{
  render(<AdminTestsSection/>);await screen.findByText("Карточка 1");
  const change=async(name:string,value:string,n:number)=>{fireEvent.change(screen.getByLabelText(name),{target:{value}});await waitFor(()=>expect(fetchPage).toHaveBeenCalledTimes(n));};
  await change("Статус","hidden",2);await change("С даты","2026-10-01",3);await change("По дату","2026-10-20",4);await change("Направление","Право",5);await change("Владелец","12",6);await change("Архив","all",7);await change("Связь с подразделением","attached",8);
  expect(fetchPage.mock.calls[7][0]).toMatchObject({page:1,status:"hidden",dateFrom:"2026-10-01",dateTo:"2026-10-20",directionId:13,ownerDivisionId:"12",archived:"all",relation:"attached"});
 });
 it("cancels old requests and ignores their late results",async()=>{
  const pending:((value:TestsCatalogPage)=>void)[]=[];fetchPage.mockImplementation(()=>new Promise(resolve=>pending.push(resolve)));render(<AdminTestsSection/>);
  await waitFor(()=>expect(fetchPage).toHaveBeenCalledTimes(1));fireEvent.click(screen.getByRole("button",{name:"Банк организации"}));await waitFor(()=>expect(fetchPage).toHaveBeenCalledTimes(2));expect(fetchPage.mock.calls[0][0].signal.aborted).toBe(true);
  await act(async()=>pending[1]({...page({}),items:[{id:"bank",title:"Актуальный банк"}]}));await screen.findByText("Актуальный банк");await act(async()=>pending[0](page({})));expect(screen.queryByText("Карточка 1")).toBeNull();expect(screen.getByText("Актуальный банк")).toBeTruthy();
 });
 it("refreshes after archive and uses the clamped page without another list request",async()=>{
  render(<AdminTestsSection/>);await screen.findByText("Карточка 1");fireEvent.click(screen.getByRole("button",{name:"3"}));await screen.findByText("Карточка 13");
  action.mockResolvedValue({});fetchPage.mockResolvedValueOnce({...page({page:2}),total:12,offset:6,statusCounts:{all:12,hidden:12}});fireEvent.click(screen.getAllByRole("button",{name:"Архивировать"})[0]);await screen.findByText("Карточка 7");
  expect(action).toHaveBeenCalledTimes(1);expect(fetchPage).toHaveBeenCalledTimes(3);expect(screen.getByRole("button",{name:"Вперёд →"}).hasAttribute("disabled")).toBe(true);
 });
 it("retries a failed page without downloading the whole catalogue",async()=>{
  fetchPage.mockRejectedValueOnce(new Error("Сервис недоступен"));render(<AdminTestsSection/>);await screen.findByText("Сервис недоступен");fireEvent.click(screen.getByRole("button",{name:"Повторить"}));await screen.findByText("Карточка 1");expect(fetchPage).toHaveBeenCalledTimes(2);
 });
 it("distinguishes an empty filtered result and resets the server query",async()=>{
  render(<AdminTestsSection/>);await screen.findByText("Карточка 1");
  fetchPage.mockResolvedValueOnce({items:[],total:0,limit:6,offset:0,statusCounts:{all:0}});
  fireEvent.change(screen.getByRole("searchbox"),{target:{value:"несуществующий"}});
  await screen.findByText("По фильтрам ничего не найдено");expect(screen.queryByText("Тестов пока нет")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Сбросить фильтры"}));await screen.findByText("Карточка 1");
  expect(fetchPage).toHaveBeenCalledTimes(3);expect(fetchPage.mock.calls[2][0]).toMatchObject({page:1,q:"",status:"all"});
 });

});
