import { beforeEach, describe, expect, it, vi } from "vitest";
const domainMock = vi.fn();
let actor = { account_id: 7, organization_id: 1001, division_id: 12 };
const saved = new Map<string, string>();
let testDivision = 1000;
vi.mock("./client", () => ({ domain: (...args: unknown[]) => domainMock(...args), getIdentity: () => ({ user: actor }) }));
import { ratingsJob, ratingsJobs, ratingsOwn, ratingsAccount, ratingsAllPublished, ratingsCommand, pendingRatingCommand, mapRatingRow, mapRatingFreshness, mapRatingsReport, hasPendingRatingCommands, isActiveRatingJob, type PublishedRating } from "./ratings-shared";
import { buildRatingsReportWorkbook } from "@/lib/admin/ratings-report-export";
import { buildValueMap } from "@/lib/admin/ratings-report-utils";
import * as XLSX from "xlsx";
const id = "314b2194-1372-43df-a370-7a1b5f307422";
const ownerJob = { id, revision: 4, status: "waiting_sources", date_from: "2026-01-01", date_to: "2026-12-31", total_count: 3, processed_count: 0, created_by: 7, created_at: "2026-10-08T00:00:00Z", completed_at: null, error_code: "tests_calculation_pending", as_of: "2026-10-08T00:00:00Z", attempts: 2 };
const row: PublishedRating = {
  place: 8, profile: { account_id: 7, profile_id: 999, full_name: "Студент", class: 10, group_id: 5, group_name: "А", school_id: 3, school_name: "Школа", school_short_name: null, is_active: true },
  rating: { job_id: id, revision: 4, account_id: 7, organization_id: 1001, division_id: 12, algorithm_version: "legacy-rating-v1", input_hash: "hash", status: "ready", final_rating: 0,
    homework: { rating: 0, details: [{homework_id: 1, name: "ДЗ", deadline: "2026-10-01", score: 0, status: "Сдано", date_pass: "2026-10-01"}] },
    exams: { rating: 0, details: [{exam_id:"outside:x",exam_name:"Экзамен",exam_date:"2026-10-02",score:0,status:"Сдан",exam_type:"classic",attempt_no:2,has_appeal:true,missing_result:false,direction_id:null}] },
    tests: { rating: 0, directions: {Математика:0}, details: [{test_id:"same",title:"Тест",direction:"Математика",score:0,source:"internal"},{test_id:"same",title:"Внешний",direction:"Математика",score:25,source:"external"}] } },
};
beforeEach(() => {
  domainMock.mockReset(); actor = {...actor, division_id: ++testDivision}; saved.clear();
  vi.stubGlobal("window", {sessionStorage: {getItem:(key:string) => saved.get(key) ?? null, setItem:(key:string,value:string) => saved.set(key,value),removeItem:(key:string) => saved.delete(key), key:(i:number) => [...saved.keys()][i],get length(){return saved.size;}}});
});
describe("ratings owner boundary", () => {
  it("does not throw from journal read helpers when no division is selected", () => {
    actor = {...actor,division_id:0}; expect(pendingRatingCommand()).toBeNull(); expect(hasPendingRatingCommands()).toBe(false);
  });
  it("maps flat GET job and preserves waiting stage and diagnostics", async () => {
    domainMock.mockResolvedValue(ownerJob);
    expect(await ratingsJob(id)).toMatchObject({id,status:"waiting_sources",error_code:"tests_calculation_pending",total_students:3,processed_count:0});
    expect(domainMock.mock.calls[0][0]).toBe(`/ratings/jobs/${id}`);
  });
  it("reads owner job list, retaining all active and terminal stages", async () => {
    domainMock.mockResolvedValue({jobs:[ownerJob,{...ownerJob,status:"superseded"}]});
    const jobs = await ratingsJobs(50,100);
    expect(jobs.map(isActiveRatingJob)).toEqual([true,false]);
    expect(domainMock.mock.calls[0][0]).toBe("/ratings/jobs?limit=50&offset=100");
    expect(jobs[0].successful).toBeUndefined();
  });
  it("returns null before first publication and uses auth account IDs", async () => {
    domainMock.mockResolvedValue({rating:null,freshness:{is_stale:true,reason:"never_calculated"}});
    expect((await ratingsOwn()).rating).toBeNull();
    await ratingsAccount(7,id);
    expect(domainMock.mock.calls[1][0]).toBe(`/ratings/accounts/7?version=${id}`);
  });
  it("preserves published zero, global place and account identity distinct from profile ID", () => {
    expect(mapRatingRow(row)).toMatchObject({id:7,student_id:7,place:8,homework:0,exams:0,tests:0,final:0});
    expect(() => mapRatingRow({...row,place:0})).toThrow("некорректную");
    expect(() => mapRatingRow({...row,rating:{...row.rating,final_rating:NaN}})).toThrow("некорректную");
  });
  it("pins later pages to the first version and does not truncate at 200", async () => {
    actor = {...actor, division_id:12};
    const rows = Array.from({length:201},(_,index) => ({...row,place:index+1,profile:{...row.profile,account_id:index+1},rating:{...row.rating,account_id:index+1}}));
    domainMock.mockResolvedValueOnce({ratings:rows.slice(0,200),total:201,freshness:{is_stale:false,reason:"",version_id:id}})
      .mockResolvedValueOnce({ratings:rows.slice(200),total:201,freshness:{is_stale:false,reason:"",version_id:id}});
    expect((await ratingsAllPublished()).ratings).toHaveLength(201);
    expect(domainMock.mock.calls[1][0]).toBe(`/ratings/ratings?version=${id}&limit=200&offset=200`);
  });
  it("fails a partial page instead of returning an incomplete ranking", async () => {
    actor = {...actor, division_id:12};
    domainMock.mockResolvedValueOnce({ratings:[row],total:2,freshness:{version_id:id}}).mockResolvedValueOnce({ratings:[],total:2});
    await expect(ratingsAllPublished()).rejects.toThrow("все строки");
  });
  it.each(["version", "scope", "duplicate", "overflow"])("rejects a %s drift between report pages", async defect => {
    actor = {...actor, division_id:12};
    const second = {...row, profile:{...row.profile,account_id:8},rating:{...row.rating,account_id:8}};
    const page = {ratings:[second],total:2,freshness:{version_id:id}};
    if (defect === "version") page.freshness.version_id = "614b2194-1372-43df-a370-7a1b5f307422";
    if (defect === "scope") second.rating.division_id = 13;
    if (defect === "duplicate") page.ratings = [row];
    if (defect === "overflow") page.ratings.push({...second});
    domainMock.mockResolvedValueOnce({ratings:[row],total:2,freshness:{version_id:id}}).mockResolvedValueOnce(page);
    await expect(ratingsAllPublished()).rejects.toThrow();
  });
  it("rejects a response for a different explicit version even on the first page", async () => {
    actor = {...actor, division_id:12};
    domainMock.mockResolvedValue({ratings:[row],total:1,freshness:{version_id:id}});
    await expect(ratingsAllPublished("614b2194-1372-43df-a370-7a1b5f307422")).rejects.toThrow("одной опубликованной");
  });
  it("accepts an empty scope before its first publication", async () => {
    domainMock.mockResolvedValue({ratings:[],total:0,freshness:{is_stale:true,reason:"never_calculated"}});
    expect((await ratingsAllPublished()).ratings).toEqual([]);
  });
  it("starts with wrapped job and clears the request journal after acceptance", async () => {
    domainMock.mockResolvedValue({job:ownerJob,status_url:`/bff/ratings/jobs/${id}`});
    expect(await ratingsCommand("start","/ratings/jobs",{date_from:"2026-01-01",date_to:"2026-12-31"})).toMatchObject({id,status:"waiting_sources"});
    expect(domainMock.mock.calls[0][1].headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(pendingRatingCommand()).toBeNull();
  });
  it("retries flat owner job without assuming the start envelope", async () => {
    domainMock.mockResolvedValue(ownerJob);
    expect(await ratingsCommand(`retry:${id}`,`/ratings/jobs/${id}/retry`,{})).toMatchObject({id});
    expect(pendingRatingCommand(`retry:${id}`)).toBeNull();
  });
  it("reuses the original UUID after a lost response and refuses a different period", async () => {
    domainMock.mockRejectedValueOnce(Object.assign(new Error("lost"),{status:0,code:"transport_error"})).mockResolvedValue({job:ownerJob});
    const period = {date_from:"2026-01-01",date_to:"2026-12-31"};
    await expect(ratingsCommand("start","/ratings/jobs",period)).rejects.toMatchObject({status:0});
    const key = pendingRatingCommand()?.key;
    await expect(ratingsCommand("start","/ratings/jobs",{...period,date_to:"2026-10-01"})).rejects.toThrow("предыдущий");
    await ratingsCommand("start","/ratings/jobs",period);
    expect(domainMock.mock.calls[1][1].headers["Idempotency-Key"]).toBe(key);
    expect(pendingRatingCommand()).toBeNull();
  });
  it("retains uncertain 503 requests and clears definitive 409 rejection", async () => {
    domainMock.mockRejectedValueOnce(Object.assign(new Error("down"),{status:503})).mockRejectedValueOnce(Object.assign(new Error("active"),{status:409,code:"rating_job_active"}));
    const period={date_from:"2026-01-01",date_to:"2026-12-31"};
    await expect(ratingsCommand("start","/ratings/jobs",period)).rejects.toMatchObject({status:503});
    expect(pendingRatingCommand()).not.toBeNull();
    await expect(ratingsCommand("start","/ratings/jobs",period)).rejects.toThrow("уже выполняется");
    expect(pendingRatingCommand()).toBeNull();
  });
  it("partitions uncertainty journals between selected divisions", async () => {
    domainMock.mockRejectedValue(Object.assign(new Error("lost"),{status:0}));
    await expect(ratingsCommand("start","/ratings/jobs",{date_from:"2026-01-01",date_to:"2026-12-31"})).rejects.toThrow();
    const division = actor.division_id;
    actor = {...actor,division_id:division+1}; expect(pendingRatingCommand()).toBeNull();
    actor = {...actor,division_id:division}; expect(pendingRatingCommand()).not.toBeNull();
  });
  it("keeps existing localized transport errors when a new code has no local label", async () => {
    domainMock.mockRejectedValue(Object.assign(new Error("Понятное сообщение сервера"),{status:503,code:"new_dependency_code"}));
    await expect(ratingsOwn()).rejects.toThrow("Понятное сообщение сервера");
  });
  it("maps source freshness and configured exclusions without fabricating active jobs", () => {
    expect(mapRatingFreshness({is_stale:true,reason:"source_unavailable",version_id:id,revision:4,external_tests_mode:"dev_internal_only"})).toMatchObject({scope:"ratings",isStale:true,reason:"source_unavailable",versionId:id,activeJobId:null,externalTestsMode:"dev_internal_only"});
  });
  it("builds full report columns with collision-free internal/external test keys and string exam IDs", () => {
    const report=mapRatingsReport({period:{date_from:"2026-01-01",date_to:"2026-12-31"},students:[row],freshness:{is_stale:false,reason:"",version_id:id}});
    expect(report.students?.[0]).toMatchObject({student_id:7,place:8,final:0});
    expect(report.columns?.map(c=>c.key)).toContain("exam_outside:x");
    expect(report.columns?.filter(c=>c.kind==="test")).toHaveLength(2);
    expect(report.values?.find(c=>c.column_key==="exam_outside:x")).toMatchObject({score:0,status:expect.stringContaining("Пересдача"),details:{has_appeal:true}});
  });
  it("exports numeric zero, global place, frozen detail provenance and blank missing cells", () => {
    const report=mapRatingsReport({period:null,students:[row],freshness:{is_stale:true,reason:"source_changed",version_id:id}});
    const data={...report,period:report.period??null,students:report.students!,columns:[...report.columns!,{key:"missing",kind:"test" as const,label:"Нет ячейки"}],values:report.values!};
    const book=buildRatingsReportWorkbook(data,data.students,buildValueMap(data.values));
    const matrix=XLSX.utils.sheet_to_json<(string|number)[]>(book.Sheets["Рейтинг"],{header:1,defval:""});
    expect(matrix[1][0]).toBe(8); expect(matrix[1][1]).toBe(7); expect(matrix[1][9]).toBe(0); expect(matrix[1].at(-1)).toBe("");
    expect(book.SheetNames).toEqual(["Рейтинг","Детализация","Версия"]);
    expect(XLSX.utils.sheet_to_json(book.Sheets["Детализация"],{header:1}).toString()).toContain('"has_appeal":true');
  });
});
