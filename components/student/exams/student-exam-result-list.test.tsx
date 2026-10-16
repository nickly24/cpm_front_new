// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {StudentExamResultList} from "./student-exam-result-list";
import type {useExamNavigation} from "@/lib/exams-v2/hooks";
const mocks=vi.hoisted(()=>({get:vi.fn(),desktop:false}));
const {get}=mocks;
vi.mock("@/lib/hooks/use-media-query",()=>({useMediaQuery:()=>mocks.desktop}));
vi.mock("@/lib/exams-v2/api",()=>({examGet:mocks.get,getExamDirections:async()=>[{id:1,name:"Математика"}],queryString:(values:Record<string,string|number>)=>`?${new URLSearchParams(Object.entries(values).map(([key,value])=>[key,String(value)]))}`}));
const row={examId:15,examName:"Итоговый экзамен",examType:"classic",directionId:1,directionName:"Математика",examDate:"2026-10-16",startAt:null,endAt:null,hasActiveRetake:true,retakeStatus:"in_progress",currentAttempt:{grade:0,roundedTotal:0,maxScore:20,attemptNo:1,hasAppeal:false}};
beforeEach(()=>{mocks.desktop=false;vi.spyOn(window,"scrollTo").mockImplementation(()=>{});get.mockReset().mockResolvedValue({items:[row],pagination:{page:1,limit:6,total:1,totalPages:1,hasNext:false,hasPrev:false}});HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const navigation=()=>({initialized:true,params:new URLSearchParams(),id:()=>null,navigate:vi.fn()}) as unknown as ReturnType<typeof useExamNavigation>;
it("shows a completed zero beside pending retake and preserves scroll after detail",async()=>{
 const nav=navigation();const view=render(<StudentExamResultList nav={nav} active training={<p>Карточки</p>}/>);
 const button=await screen.findByRole("button",{name:"Открыть результат: Итоговый экзамен"});expect(screen.getByLabelText("Оценка 0 из 5")).toBeTruthy();expect(screen.getByText("Пересдача в процессе")).toBeTruthy();
 const scroller=screen.getByRole("region");scroller.scrollTop=240;fireEvent.click(button);expect(nav.navigate).toHaveBeenCalledWith({examId:15});
 view.rerender(<StudentExamResultList nav={nav} active={false} training={null}/>);scroller.scrollTop=0;view.rerender(<StudentExamResultList nav={nav} active training={null}/>);await waitFor(()=>expect(scroller.scrollTop).toBe(240));expect(get).toHaveBeenCalledTimes(1);
});
it("applies direction and zero grade together from the search screen",async()=>{
 const nav=navigation();render(<StudentExamResultList nav={nav} active training={null}/>);await screen.findByText("Итоговый экзамен");
 fireEvent.click(screen.getByRole("button",{name:"Изменить поиск результатов"}));fireEvent.change(screen.getByRole("searchbox"),{target:{value:"Итоговый"}});
 fireEvent.click(screen.getByRole("button",{name:"Направление Все направления"}));fireEvent.click(screen.getByRole("button",{name:"Математика"}));
 fireEvent.click(screen.getByRole("button",{name:"Оценка Любая оценка"}));fireEvent.click(screen.getByRole("button",{name:"0 / 5"}));fireEvent.click(screen.getByRole("button",{name:"Найти результаты"}));
 expect(nav.navigate).toHaveBeenCalledWith({search:"Итоговый",directionId:"1",grade:"0",type:null,sort:null,page:null});expect(screen.queryByRole("dialog")).toBeNull();
});

it("shows desktop direction/type/grade filters and retains a published zero during retake",async()=>{
 mocks.desktop=true;const nav=navigation();render(<StudentExamResultList nav={nav} active training={null}/>);
 await screen.findByRole("button",{name:"Открыть результат: Итоговый экзамен"});expect(screen.queryByRole("button",{name:"Изменить поиск результатов"})).toBeNull();
 expect(screen.getByLabelText("Оценка 0 из 5")).toBeTruthy();expect(screen.getByText("Пересдача в процессе")).toBeTruthy();
 expect(get.mock.calls[0][0]).toContain("limit=12");fireEvent.change(screen.getByRole("combobox",{name:"Оценка"}),{target:{value:"0"}});
 expect(nav.navigate).toHaveBeenCalledWith({search:null,directionId:null,type:null,grade:"0",sort:null,page:null});
});
