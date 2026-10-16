// @vitest-environment jsdom
import {act,cleanup,renderHook,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
const {load}=vi.hoisted(()=>({load:vi.fn()}));
vi.mock("@/lib/config",()=>({BFF_DEV:true}));
vi.mock("./homework",()=>({homeworkTypes:load}));
import {useHomeworkTypes} from "./use-homework-types";
beforeEach(()=>load.mockReset());afterEach(cleanup);
it("retries a failed type catalog and clears the visible error",async()=>{
 load.mockRejectedValueOnce(new Error("signal is aborted without reason"));
 const {result}=renderHook(()=>useHomeworkTypes());await waitFor(()=>expect(result.current.error).toBe("Не удалось загрузить типы заданий."));
 load.mockResolvedValueOnce([{id:1,name:"Право"}]);act(()=>result.current.reload());await waitFor(()=>expect(result.current.names).toEqual(["Право"]));expect(result.current.error).toBe("");
});
it("ignores an older catalog arriving after the update event",async()=>{
 let old:(rows:{name:string}[])=>void=()=>{};load.mockImplementationOnce(()=>new Promise(resolve=>{old=resolve;}));
 const {result}=renderHook(()=>useHomeworkTypes());await waitFor(()=>expect(load).toHaveBeenCalledOnce());
 load.mockResolvedValueOnce([{name:"Новый"}]);act(()=>window.dispatchEvent(new Event("bff-types-updated")));await waitFor(()=>expect(result.current.names).toEqual(["Новый"]));
 await act(async()=>old([{name:"Старый"}]));expect(result.current.names).toEqual(["Новый"]);
});
