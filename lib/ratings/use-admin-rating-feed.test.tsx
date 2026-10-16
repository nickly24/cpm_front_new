// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { page, freshness } = vi.hoisted(() => ({ page: vi.fn(), freshness: vi.fn() }));
vi.mock("@/lib/admin/admin-ratings-api", () => ({ fetchAdminRatingPage: page, fetchAdminRatingFreshness: freshness }));
import { useAdminRatingFeed } from "./use-admin-rating-feed";
const publication = { version_id: "12345678-abcd-4321-abcd-123456789abc", revision: 4, as_of: "2026-10-16T12:00:00Z", date_from: "2026-10-01", date_to: "2026-10-16" };
const rows = (offset: number, n = 50) => Array.from({length:n}, (_, i) => ({id:offset+i+1, student_id:offset+i+1, place:offset+i+1, version_id:publication.version_id, student_name:`Студент ${offset+i+1}`, student_class:null, group_name:null, homework:0, exams:0, tests:0, final:100-offset-i}));
function deferred<T>() { let resolve!: (value:T) => void; let reject!: (value:unknown) => void; const promise = new Promise<T>((r,j) => {resolve=r;reject=j;}); return {promise,resolve,reject}; }
beforeEach(() => { page.mockReset();freshness.mockReset();freshness.mockResolvedValue(null); page.mockImplementation(async ({offset}) => ({ratings:rows(offset,offset?13:50),total:63,publication})); });
afterEach(cleanup);
describe("progressive rating feed", () => {
 it("shows only the first 50 while freshness is pending and retains them if the check fails",async()=>{
  const check=deferred<null>();freshness.mockReturnValue(check.promise);const {result}=renderHook(()=>useAdminRatingFeed("scope","",""));await waitFor(()=>expect(result.current.rows).toHaveLength(50));expect(result.current.loading).toBe(false);expect(result.current.checking).toBe(true);expect(page).toHaveBeenCalledTimes(1);expect(page.mock.calls[0][0]).toEqual({version:undefined,q:undefined,limit:50,offset:0});await act(async()=>check.reject(new Error("source down")));expect(result.current.rows).toHaveLength(50);expect(result.current.freshness?.reason).toBe("source_unavailable");
 });
 it("pins subsequent pages and prevents duplicate concurrent loads, including when freshness finishes",async()=>{
  const check=deferred<null>();freshness.mockReturnValue(check.promise);const {result}=renderHook(()=>useAdminRatingFeed("scope","",""));await waitFor(()=>expect(result.current.rows).toHaveLength(50));const next=deferred<unknown>();page.mockReturnValueOnce(next.promise);let loading!:Promise<void>;act(()=>{loading=result.current.loadMore();void result.current.loadMore();});await act(async()=>check.resolve(null));await act(async()=>result.current.loadMore());expect(page).toHaveBeenCalledTimes(2);expect(result.current.rows).toHaveLength(50);expect(result.current.loadingMore).toBe(true);expect(page.mock.calls[1][0]).toEqual({version:publication.version_id,q:undefined,limit:50,offset:50});await act(async()=>{next.resolve({ratings:rows(50,13),total:63,publication});await loading;});expect(result.current.rows).toHaveLength(63);await act(async()=>result.current.loadMore());expect(page).toHaveBeenCalledTimes(2);
 });
 it("retries only the failed next page without clearing prior rows",async()=>{
  const {result}=renderHook(()=>useAdminRatingFeed("scope","",""));await waitFor(()=>expect(result.current.rows).toHaveLength(50));page.mockRejectedValueOnce(new Error("temporary"));await act(async()=>result.current.loadMore());expect(result.current.rows).toHaveLength(50);expect(result.current.moreError).toBe("temporary");await act(async()=>result.current.loadMore());expect(result.current.rows).toHaveLength(63);expect(page.mock.calls.slice(1).map(c=>c[0].offset)).toEqual([50,50]);
 });
 it.each(["duplicate","version","place","empty"])("refuses corrupt %s next pages",async defect=>{
  const {result}=renderHook(()=>useAdminRatingFeed("scope","",""));await waitFor(()=>expect(result.current.rows).toHaveLength(50));const data={ratings:rows(50,13),total:63,publication};if(defect==="duplicate")data.ratings[0]=rows(0,1)[0];if(defect==="version")data.publication={...publication,version_id:"other"};if(defect==="place")data.ratings[0].place=1;if(defect==="empty")data.ratings=[];page.mockResolvedValueOnce(data);await act(async()=>result.current.loadMore());expect(result.current.rows).toHaveLength(50);expect(result.current.moreError).toBeTruthy();
 });
 it("aborts scope/search/version changes and ignores a late response",async()=>{
  const old=deferred<unknown>();page.mockReturnValueOnce(old.promise);const {result,rerender,unmount}=renderHook(({scope,version,q})=>useAdminRatingFeed(scope,version,q),{initialProps:{scope:"A",version:"",q:""}});const signal=page.mock.calls[0][1] as AbortSignal;rerender({scope:"B",version:publication.version_id,q:"Ирина"});expect(signal.aborted).toBe(true);await waitFor(()=>expect(result.current.rows).toHaveLength(50));expect(page.mock.calls[1][0]).toMatchObject({version:publication.version_id,q:"Ирина",offset:0});await act(async()=>old.resolve({ratings:rows(900),total:1000,publication}));expect(result.current.rows[0].student_id).toBe(1);const active=page.mock.calls[1][1] as AbortSignal;unmount();expect(active.aborted).toBe(true);
 });
 it("reloads the first page instead of mixing another publication",async()=>{
  const {result}=renderHook(()=>useAdminRatingFeed("scope","",""));await waitFor(()=>expect(result.current.rows).toHaveLength(50));await act(async()=>result.current.loadMore());act(()=>result.current.reload());await waitFor(()=>expect(page).toHaveBeenCalledTimes(3));await waitFor(()=>expect(result.current.rows).toHaveLength(50));expect(page.mock.calls[2][0]).toMatchObject({version:undefined,offset:0});
 });
});
