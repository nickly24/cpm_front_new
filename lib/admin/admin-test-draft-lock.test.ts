import { describe, expect, it } from "vitest";
import { mergeDraftLockAcknowledgement } from "./admin-test-draft-lock";
import type { AdminTestDraft } from "./admin-test-drafts-types";
const initial:AdminTestDraft={id:"draft",title:"",direction:"",startDate:"",endDate:"",timeLimitMinutes:30,published:false,visible:false,canvas:{questions:[],layout:{}},status:"active",expectedRevision:1};
const locked={...initial,expectedRevision:2,lockedBy:17,lockedByRole:"admin",lockedUntil:"2026-10-08T13:00:00Z"};
describe("draft lock acknowledgement",()=>{
 it("preserves title, direction and questions entered before the first lock response",()=>{
  const edited={...initial,title:"Новый тест",direction:"Python",canvas:{questions:[{id:"new",type:"text" as const,text:"Вопрос",points:5,answers:[]}],layout:{new:{x:120,y:120}}}};
  const merged=mergeDraftLockAcknowledgement(edited,initial,locked);
  expect(merged.title).toBe("Новый тест");expect(merged.direction).toBe("Python");expect(merged.canvas).toEqual(edited.canvas);expect(merged.expectedRevision).toBe(2);expect(merged.lockedBy).toBe(17);
 });
 it("accepts the current server snapshot when no local input changed",()=>{
  const acknowledged={...locked,title:"Сохранённый серверный тест"};
  expect(mergeDraftLockAcknowledgement(initial,initial,acknowledged).title).toBe(acknowledged.title);
 });
});
