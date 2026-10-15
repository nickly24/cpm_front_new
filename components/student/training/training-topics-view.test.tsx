// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {TrainingSectionsListView} from "./training-topics-view";
const state=vi.hoisted(()=>({query:"page=2&kind=test",replace:vi.fn(),fetch:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({replace:state.replace}),usePathname:()=>"/cabinet/student/train/Право",useSearchParams:()=>new URLSearchParams(state.query)}));
vi.mock("@/lib/training/training-api",()=>({fetchTrainingSectionsByDirection:state.fetch}));
vi.mock("@/lib/config",()=>({BFF_DEV:true}));
const direction={id:4,name:"Право",sections:[],total_cards:0,learned_cards:0,progress_percent:0};
const props={directions:[direction],direction,selectedDirectionId:4,studentId:71,loading:false,error:null,onSelectDirection:vi.fn(),onSelectSection:vi.fn()};
beforeEach(()=>{vi.clearAllMocks();state.query="page=2&kind=test";state.fetch.mockResolvedValue({sections:[],pagination:{page:2,pages:3,total:25}})});afterEach(cleanup);
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
