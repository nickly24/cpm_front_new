// @vitest-environment jsdom
import {act,cleanup,renderHook,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {useExamResultsFeed} from "./use-exam-results-feed";
const {get}=vi.hoisted(()=>({get:vi.fn()}));
vi.mock("@/lib/exams-v2/api",()=>({examGet:get,queryString:(values:Record<string,string|number>)=>`?${new URLSearchParams(Object.entries(values).map(([key,value])=>[key,String(value)]))}`}));
const page=(n:number)=>({items:Array.from({length:6},(_,i)=>({examId:(n-1)*6+i+1})),pagination:{page:n,limit:6,total:18,totalPages:3,hasNext:n<3,hasPrev:n>1}});
beforeEach(()=>get.mockReset().mockImplementation(async(path:string)=>page(Number(new URL(path,"http://localhost").searchParams.get("page")))));
afterEach(cleanup);
it("retains loaded results when returning from detail and restores a cached filter",async()=>{
 const {result,rerender}=renderHook(({active,search})=>useExamResultsFeed({search},active),{initialProps:{active:true,search:""}});
 await waitFor(()=>expect(result.current.items).toHaveLength(6));
 act(()=>result.current.next());await waitFor(()=>expect(result.current.items).toHaveLength(12));
 rerender({active:false,search:""});rerender({active:true,search:""});await waitFor(()=>expect(result.current.loading).toBe(false));expect(get).toHaveBeenCalledTimes(2);
 rerender({active:true,search:"право"});await waitFor(()=>expect(result.current.items).toHaveLength(6));
 rerender({active:true,search:""});await waitFor(()=>expect(result.current.items).toHaveLength(12));expect(get).toHaveBeenCalledTimes(3);
});
it("keeps earlier pages on failure and retries the failed page once",async()=>{
 const {result}=renderHook(()=>useExamResultsFeed({},true));await waitFor(()=>expect(result.current.items).toHaveLength(6));
 get.mockRejectedValueOnce(new Error("Нет сети"));act(()=>{result.current.next();result.current.next();});await waitFor(()=>expect(result.current.error).toBe("Нет сети"));expect(result.current.items).toHaveLength(6);
 act(()=>result.current.retry());await waitFor(()=>expect(result.current.items).toHaveLength(12));expect(get.mock.calls.map(call=>new URL(call[0],"http://localhost").searchParams.get("page"))).toEqual(["1","2","2"]);
});
it("ignores an aborted stale filter response",async()=>{
 let stale:(value:ReturnType<typeof page>)=>void=()=>{};get.mockImplementationOnce(()=>new Promise(resolve=>{stale=resolve;}));
 const {result,rerender}=renderHook(({search})=>useExamResultsFeed({search},true),{initialProps:{search:"old"}});await waitFor(()=>expect(get).toHaveBeenCalledTimes(1));const signal=get.mock.calls[0][2];
 rerender({search:"new"});await waitFor(()=>expect(result.current.items).toHaveLength(6));expect(signal.aborted).toBe(true);
 await act(async()=>stale(page(3)));expect(result.current.items[0].examId).toBe(1);
});
