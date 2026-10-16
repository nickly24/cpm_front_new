// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {TrainingSectionsListView} from "./training-topics-view";
const state=vi.hoisted(()=>({query:"page=2&kind=test",replace:vi.fn(),fetch:vi.fn(),desktop:false}));
vi.mock("next/navigation",()=>({useRouter:()=>({replace:state.replace}),usePathname:()=>"/cabinet/student/train/Право",useSearchParams:()=>new URLSearchParams(state.query)}));
vi.mock("@/lib/training/training-api",()=>({fetchTrainingSectionsByDirection:state.fetch}));
vi.mock("@/lib/hooks/use-media-query",()=>({useMediaQuery:()=>state.desktop}));
vi.mock("@/lib/config",()=>({BFF_DEV:true}));
const direction={id:4,name:"Право",sections:[],total_cards:0,learned_cards:0,progress_percent:0};
const props={directions:[direction],direction,selectedDirectionId:4,studentId:71,loading:false,error:null,onSelectDirection:vi.fn(),onSelectSection:vi.fn()};
beforeEach(()=>{vi.clearAllMocks();state.desktop=false;state.query="page=2&kind=test";state.fetch.mockResolvedValue({sections:[],pagination:{page:2,pages:3,total:25}})});afterEach(cleanup);
it("restores server page and filters from URL and cancels requests when scope unmounts",async()=>{
 const rendered=render(<TrainingSectionsListView {...props}/>);
 await waitFor(()=>expect(state.fetch).toHaveBeenCalledTimes(1));expect(state.fetch.mock.calls[0][2]).toMatchObject({page:2,limit:12,kind:"test"});
 fireEvent.click(await screen.findByRole("button",{name:"Далее"}));expect(state.replace).toHaveBeenCalledWith("/cabinet/student/train/Право?page=3&kind=test",{scroll:false});
 const signal=state.fetch.mock.calls[0][3] as AbortSignal;rendered.unmount();expect(signal.aborted).toBe(true);
});
it("shows failure without claiming empty results and permits explicit retry",async()=>{
 state.fetch.mockResolvedValue({sections:[],pagination:{page:1,pages:1,total:0}}).mockRejectedValueOnce(new Error("dependency_unavailable"));render(<TrainingSectionsListView {...props}/>);
 expect(await screen.findByRole("alert")).toHaveProperty("textContent","dependency_unavailable");expect(screen.queryByText("Разделы не найдены")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Повторить загрузку"}));expect(await screen.findByText("Разделы не найдены")).toBeTruthy();
});

it("uses desktop shared filters and applies direction plus the drafted search atomically",async()=>{
 state.desktop=true;render(<TrainingSectionsListView {...props} directions={[direction,{...direction,id:5,name:"Практикум"}]}/>);
 await waitFor(()=>expect(state.fetch).toHaveBeenCalledTimes(1));
 expect(screen.queryByRole("group",{name:"Направление"})).toBeNull();
 fireEvent.change(screen.getByRole("searchbox",{name:"Найти раздел"}),{target:{value:"основы"}});
 fireEvent.change(screen.getByRole("combobox",{name:"Направление"}),{target:{value:"5"}});
 expect(props.onSelectDirection).toHaveBeenCalledWith(5,{search:"основы",kind:"test",progress:"all",page:null});
 fireEvent.click(screen.getByRole("button",{name:"Сбросить"}));expect(state.replace).toHaveBeenCalledWith("/cabinet/student/train/Право",{scroll:false});
});
it("opens mobile search with direction, kind and progress in one screen",async()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};
 render(<TrainingSectionsListView {...props} directions={[direction,{...direction,id:5,name:"Практикум"}]}/>);
 fireEvent.click(screen.getByRole("button",{name:"Изменить поиск карточек"}));
 expect(screen.getByRole("dialog",{name:"Поиск карточек"})).toBeTruthy();
 fireEvent.change(screen.getByRole("searchbox",{name:"Найти раздел"}),{target:{value:"новое"}});
 fireEvent.click(screen.getByRole("button",{name:/^Направление/}));fireEvent.click(screen.getByRole("button",{name:"Практикум"}));
 fireEvent.click(screen.getByRole("button",{name:/^Тип раздела/}));fireEvent.click(screen.getByRole("button",{name:"Свои карточки"}));
 fireEvent.click(screen.getByRole("button",{name:/^Прогресс/}));fireEvent.click(screen.getByRole("button",{name:"Есть что учить"}));
 fireEvent.click(screen.getByRole("button",{name:"Найти карточки"}));expect(props.onSelectDirection).toHaveBeenCalledWith(5,{search:"новое",kind:"manual",progress:"in_progress",page:null});
 expect(screen.queryByRole("dialog")).toBeNull();expect(document.body.style.overflow).not.toBe("hidden");
});
