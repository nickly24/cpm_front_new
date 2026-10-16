import { beforeEach, describe, expect, it, vi } from "vitest";
const config=vi.hoisted(() => ({enabled:true}));
const domainMock=vi.hoisted(() => vi.fn());
const legacyMock=vi.hoisted(() => vi.fn());
vi.mock("@/lib/config",()=>({get BFF_DEV(){return config.enabled;}}));
vi.mock("@/lib/bff/client",()=>({domain:domainMock,getIdentity:()=>({user:{account_id:9,organization_id:1001,division_id:12}})}));
vi.mock("@/lib/api/client",()=>({apiRequest:legacyMock}));
import { fetchAdminRatings, fetchRatingDetails, startRatingRecalc, cancelRatingRecalcJob } from "./admin-ratings-api";
import { fetchRatingsReport } from "./ratings-report-api";
const id="314b2194-1372-43df-a370-7a1b5f307422";
const job={id,revision:4,status:"completed",date_from:"2026-01-01",date_to:"2026-12-31",total_count:1,processed_count:1,created_by:9,created_at:"2026-10-08T00:00:00Z",completed_at:"2026-10-08T00:00:01Z",error_code:"",as_of:"2026-10-08T00:00:00Z"};
const row={profile:{account_id:9,profile_id:199,full_name:"Ученик",class:null,group_name:null},place:6,rating:{account_id:9,organization_id:1001,division_id:12,job_id:id,revision:4,status:"ready",final_rating:0,homework:{rating:0,details:[]},exams:{rating:0,details:[]},tests:{rating:0,directions:{},details:[]}}};
beforeEach(()=>{config.enabled=true;domainMock.mockReset();legacyMock.mockReset();});
describe("ratings API mode boundary",()=>{
 it("preserves legacy ratings/details/recalc/report endpoints outside BFF mode",async()=>{
  config.enabled=false;legacyMock.mockResolvedValue({status:true});
  await fetchAdminRatings();await fetchRatingDetails(199);await startRatingRecalc({date_from:"2026-01-01",date_to:"2026-12-31"});await fetchRatingsReport();
  expect(legacyMock.mock.calls.map(c=>c[0])).toEqual(["/get-all-ratings","/get-rating-details","/calculate-all-ratings","/ratings-report"]);
  expect(JSON.parse(legacyMock.mock.calls[1][1].body)).toEqual({rating_id:199});expect(domainMock).not.toHaveBeenCalled();
 });
 it("uses BFF published account identity and owner place instead of legacy rating/profile IDs",async()=>{
  domainMock.mockResolvedValue({ratings:[row],total:1,freshness:{is_stale:false,reason:"",version_id:id}});
  expect(await fetchAdminRatings()).toMatchObject({ratings:[{id:9,student_id:9,place:6,final:0}]});expect(legacyMock).not.toHaveBeenCalled();
 });
 it("loads details by account and resolves period from the exact flat publication job",async()=>{
  domainMock.mockResolvedValueOnce({rating:row,freshness:{is_stale:false,reason:"",version_id:id}}).mockResolvedValueOnce(job);
  expect(await fetchRatingDetails(9,id)).toMatchObject({details:{student_id:9,date_from:"2026-01-01",date_to:"2026-12-31",final_rating:0}});
  expect(domainMock.mock.calls.map(c=>c[0])).toEqual([`/ratings/accounts/9?version=${id}`,`/ratings/jobs/${id}`]);
 });
 it("keeps never-calculated reports empty with null period",async()=>{
  domainMock.mockResolvedValue({period:null,students:[],freshness:{is_stale:true,reason:"never_calculated"}});
  expect(await fetchRatingsReport()).toMatchObject({status:true,period:null,students:[],columns:[],values:[],ratingFreshness:{reason:"never_calculated"}});
 });
 it("preserves a selected version in report query without org/division override",async()=>{
  domainMock.mockResolvedValue({period:{date_from:"2026-01-01",date_to:"2026-12-31"},students:[row],freshness:{is_stale:false,reason:"",version_id:id}});
  await fetchRatingsReport(id);expect(domainMock.mock.calls[0][0]).toBe(`/ratings/report?version=${id}`);expect(legacyMock).not.toHaveBeenCalled();
 });
 it("does not fall back after a BFF authorization failure",async()=>{
  domainMock.mockRejectedValue(Object.assign(new Error("forbidden"),{status:403,code:"forbidden"}));
  await expect(fetchAdminRatings()).rejects.toMatchObject({status:403});expect(legacyMock).not.toHaveBeenCalled();
 });
 it("sends cancel as an empty owner command and keeps publication conflicts visible",async()=>{
  domainMock.mockRejectedValue(Object.assign(new Error("published"),{status:409,code:"rating_already_published"}));
  await expect(cancelRatingRecalcJob(id)).rejects.toMatchObject({status:409});expect(domainMock.mock.calls[0]).toEqual([`/ratings/jobs/${id}/cancel`,{method:"POST",body:"{}"}]);
 });
});

describe("progressive table API",()=>{
 it("fetches just a summary page and keeps the publication",async()=>{
  const {fetchAdminRatingPage}=await import("./admin-ratings-api");domainMock.mockResolvedValue({ratings:[row],total:416,publication:{version_id:id,revision:4,as_of:job.as_of,date_from:job.date_from,date_to:job.date_to}});const data=await fetchAdminRatingPage({version:id,q:"Ирина",limit:50,offset:50},new AbortController().signal);expect(data.ratings[0]).toMatchObject({student_id:9,place:6,final:0});expect(domainMock.mock.calls[0][0]).toBe(`/ratings/table?version=${id}&q=${encodeURIComponent("Ирина")}&limit=50&offset=50`);expect(domainMock).toHaveBeenCalledTimes(1);
 });
 it.each(["scope","version","duplicate"])("rejects %s drift",async defect=>{
  const {fetchAdminRatingPage}=await import("./admin-ratings-api");const r=structuredClone(row);const data={ratings:[r],total:416,publication:{version_id:id,revision:4,as_of:job.as_of,date_from:job.date_from,date_to:job.date_to}};if(defect==="scope")r.rating.division_id=99;if(defect==="version")r.rating.job_id="other";if(defect==="duplicate")data.ratings.push(r);domainMock.mockResolvedValue(data);await expect(fetchAdminRatingPage({limit:50,offset:0},new AbortController().signal)).rejects.toThrow();
 });
});
