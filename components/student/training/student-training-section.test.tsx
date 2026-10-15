// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { StudentTrainingSection } from "./student-training-section";
const { fetchTrainingTree, identity, push, replace } = vi.hoisted(() => ({ fetchTrainingTree: vi.fn(), identity: { user: { id: 999, account_id: 71, organization_id: 2, role: "student" } }, push: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/bff/cards", () => ({cardsCatalogDirections:fetchTrainingTree}));
vi.mock("@/lib/config", () => ({ BFF_DEV: true }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => identity }));
vi.mock("next/navigation", () => ({ useRouter: () => ({push,replace}), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/training/training-api", () => ({ fetchTrainingTree }));
vi.mock("@/components/training/cards-command-recovery", () => ({ CardsCommandRecovery: () => null }));
vi.mock("./exam-training", () => ({ StudentExamTraining: () => null }));
vi.mock("./training-flashcards", () => ({ TrainingFlashcards: () => <p>Колода</p> }));
vi.mock("./training-section-detail", () => ({ TrainingSectionDetail: () => <p>Содержимое раздела</p> }));
vi.mock("./training-topics-view", () => ({ TrainingSectionsListView: ({directions, direction, onSelectDirection}: {directions: {id:number;name:string}[]; direction:{name:string};onSelectDirection:(id:number)=>void}) => <div><p>Темы: {direction.name}</p>{directions.map(d => <button key={d.id} onClick={() => onSelectDirection(d.id)}>{d.name}</button>)}</div> }));
const section = { kind: "manual", refId: "15", name: "Тема", stats: {total:1,learned:1}, total_cards:1,learned_cards:1,progress_percent:100 };
const tree = [{id:4,name:"Право",sections:[section],total_cards:1,learned_cards:1,progress_percent:100},{id:5,name:"Пустое направление",sections:[],total_cards:0,learned_cards:0,progress_percent:0}];
beforeEach(() => { vi.clearAllMocks(); fetchTrainingTree.mockResolvedValue(tree); });
afterEach(cleanup);
describe("student cards catalog visibility", () => {
 it("shows a loading indicator until the tree resolves, then selects the first direction", async () => {
  let resolve!: (value: unknown) => void;
  fetchTrainingTree.mockImplementation(() => new Promise(r => {resolve=r;}));
  render(<StudentTrainingSection role="student" pathSegments={[]} />);
  expect(screen.getByText("Загрузка направлений…")).toBeTruthy();
  resolve(tree);
  expect(await screen.findByText("Темы: Право")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Пустое направление"}));
  expect(push).toHaveBeenCalledWith(`/cabinet/student/train/${encodeURIComponent("Пустое направление")}`);
 });
 it("displays an actual empty tree explicitly", async () => {
  fetchTrainingTree.mockResolvedValue([]);
  render(<StudentTrainingSection role="student" pathSegments={[]} />);
  expect(await screen.findByText("Пока нет доступных направлений")).toBeTruthy();
 });
 it.each([403,503])("keeps failure %s visible and permits explicit retry", async status => {
  fetchTrainingTree.mockRejectedValueOnce(new ApiError("Карточки недоступны",status)).mockResolvedValue(tree);
  render(<StudentTrainingSection role="student" pathSegments={[]} />);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent","Карточки недоступны");
  expect(screen.queryByText("Пока нет доступных направлений")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Повторить загрузку"}));
  expect(await screen.findByText("Темы: Право")).toBeTruthy();
 });
});

it("discards the old organization's catalog immediately when context changes",async()=>{
 identity.user.organization_id=2;
 fetchTrainingTree.mockResolvedValueOnce(tree);
 const rendered=render(<StudentTrainingSection role="student" pathSegments={[]}/>);
 expect(await screen.findByText("Темы: Право")).toBeTruthy();
 let resolve!: (value:unknown)=>void;fetchTrainingTree.mockImplementation(()=>new Promise(r=>{resolve=r}));
 identity.user.organization_id=3;rendered.rerender(<StudentTrainingSection role="student" pathSegments={[]}/>);
 expect(screen.queryByText("Темы: Право")).toBeNull();expect(screen.getByText("Загрузка направлений…")).toBeTruthy();
 resolve([{...tree[0],name:"Другая организация"}]);expect(await screen.findByText("Темы: Другая организация")).toBeTruthy();identity.user.organization_id=2;
});
