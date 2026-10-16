// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SectionStudyViewResponse, TrainingSectionNode } from "@/lib/training/training-types";
const api=vi.hoisted(()=>({read:vi.fn(),mark:vi.fn(),unmark:vi.fn(),settings:vi.fn()}));
vi.mock("@/lib/config",()=>({BFF_DEV:true}));
vi.mock("@/lib/bff/use-context-guard",()=>({useContextGuard:vi.fn()}));
vi.mock("@/lib/training/training-api",()=>({fetchSectionStudyView:api.read,markCardLearned:api.mark,unmarkCardLearned:api.unmark,updateSectionStudySettings:api.settings}));
import { TrainingSectionDetail } from "./training-section-detail";
function fixture():SectionStudyViewResponse {return {success:true,student_id:7,section_kind:"manual",section_ref_id:"4",section_name:"Право",settings:{batch_size:10,last_batch_index:0,study_mode:"unlearned"},stats:{total:2,learned:0,unlearned:2,answer_changed:0,progress_percent:0},cards:[{card_ref:"a",question:"Первый вопрос",answer:"Первый ответ",status:"unlearned",content_fingerprint:"v1"},{card_ref:"b",question:"Второй вопрос",answer:"Второй ответ",status:"unlearned",content_fingerprint:"v2"}],batches:[{index:0,from:1,to:2,size:2,stats:{total:2,learned:0,unlearned:2,answer_changed:0,progress_percent:0}}]};}
const section:TrainingSectionNode={kind:"manual",refId:"4",name:"Право",stats:fixture().stats,total_cards:2,learned_cards:0,progress_percent:0};
const props={section,studentId:7,onBack:vi.fn(),onStartFlashcards:vi.fn()};
beforeEach(()=>{vi.clearAllMocks();api.read.mockResolvedValue(fixture());api.mark.mockResolvedValue({success:true});api.unmark.mockResolvedValue({success:true});api.settings.mockImplementation(async(_id,_kind,_ref,values)=>({success:true,settings:values}));HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};});
afterEach(cleanup);
const open=async()=>{render(<TrainingSectionDetail {...props}/>);fireEvent.click(await screen.findByRole("button",{name:/Все карточки раздела/}));return screen.getByRole("dialog",{name:"Карточки раздела"});};
it("keeps the review mounted and scrolled during mark + background refresh, then uses authoritative progress",async()=>{
 const dialog=await open();const scroller=screen.getByTestId("training-card-scroll");scroller.scrollTop=120;
 let done!:(value:SectionStudyViewResponse)=>void;api.read.mockImplementationOnce(()=>new Promise(resolve=>{done=resolve;}));
 fireEvent.click(within(dialog).getAllByRole("button",{name:"Пометить как выученное"})[0]);
 await waitFor(()=>expect(api.read).toHaveBeenCalledTimes(2));
 expect(screen.queryByText("Загрузка раздела…")).toBeNull();expect(screen.getByTestId("training-card-scroll")).toBe(scroller);expect(scroller.scrollTop).toBe(120);
 const result=fixture();result.cards[0].status="learned";result.stats={...result.stats,learned:1,unlearned:1,progress_percent:50};result.batches[0].stats=result.stats;
 await act(async()=>done(result));await within(dialog).findByRole("button",{name:"Пометить как невыученное"});
 expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");expect(api.mark).toHaveBeenCalledWith({student_id:7,section_kind:"manual",section_ref_id:"4",card_ref:"a",content_fingerprint:"v1"});
 expect(screen.getByTestId("training-card-scroll")).toBe(scroller);expect(scroller.scrollTop).toBe(120);
});
it("keeps cards and the previous mark visible when a command fails",async()=>{
 const dialog=await open();api.mark.mockRejectedValueOnce(new Error("Сеть недоступна"));fireEvent.click(within(dialog).getAllByRole("button",{name:"Пометить как выученное"})[0]);
 expect(await screen.findByRole("alert")).toHaveProperty("textContent",expect.stringContaining("Сеть недоступна"));expect(screen.getByText("Первый вопрос")).toBeTruthy();expect(api.read).toHaveBeenCalledTimes(1);expect(within(dialog).getAllByRole("button",{name:"Пометить как выученное"})).toHaveLength(2);
});
it("retries a failed background read without replaying the successful mark",async()=>{
 const dialog=await open();api.read.mockRejectedValueOnce(new Error("Обновление недоступно"));fireEvent.click(within(dialog).getAllByRole("button",{name:"Пометить как выученное"})[0]);
 await screen.findByRole("alert");expect(screen.getByText("Второй вопрос")).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Обновить данные"}));await waitFor(()=>expect(api.read).toHaveBeenCalledTimes(3));expect(api.mark).toHaveBeenCalledTimes(1);
});
it("applies size and mode together through the existing settings endpoint without a full loading screen",async()=>{
 render(<TrainingSectionDetail {...props}/>);fireEvent.click(await screen.findByRole("button",{name:"Настройки"}));const dialog=screen.getByRole("dialog",{name:"Настройки обучения"});
 fireEvent.click(within(dialog).getByRole("button",{name:"20 карточек"}));fireEvent.click(within(dialog).getByRole("button",{name:"Все карточки"}));
 const result=fixture();result.settings={batch_size:20,study_mode:"all",last_batch_index:0};api.read.mockResolvedValueOnce(result);
 fireEvent.click(within(dialog).getByRole("button",{name:"Сохранить настройки"}));await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
 expect(api.settings).toHaveBeenCalledWith(7,"manual","4",{batch_size:20,study_mode:"all",last_batch_index:-1});expect(screen.queryByText("Загрузка раздела…")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Учить все карточки"}));expect(props.onStartFlashcards).toHaveBeenCalledWith(-1,"all");
});
it("aborts a pending view request on unmount",async()=>{
 api.read.mockImplementationOnce(()=>new Promise(()=>{}));const view=render(<TrainingSectionDetail {...props}/>);await waitFor(()=>expect(api.read).toHaveBeenCalledTimes(1));const signal=api.read.mock.calls[0][3] as AbortSignal;view.unmount();expect(signal.aborted).toBe(true);
});

it("defaults to all cards and selects a batch through the custom picker",async()=>{
 render(<TrainingSectionDetail {...props}/>);fireEvent.click(await screen.findByRole("button",{name:"Учить все карточки"}));expect(props.onStartFlashcards).toHaveBeenCalledWith(-1,"unlearned");expect(api.settings).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:/Набор карточек Все карточки/}));const dialog=screen.getByRole("dialog",{name:"Выбрать набор"});expect(within(dialog).getByRole("button",{name:"Все карточки Весь раздел · карточек: 2"}).getAttribute("aria-pressed")).toBe("true");
 fireEvent.click(within(dialog).getByRole("button",{name:"Набор 1 Карточки 1–2"}));await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());fireEvent.click(screen.getByRole("button",{name:"Учить набор"}));expect(props.onStartFlashcards).toHaveBeenLastCalledWith(0,"unlearned");expect(api.settings).toHaveBeenCalledWith(7,"manual","4",{batch_size:10,study_mode:"unlearned",last_batch_index:0});
});
